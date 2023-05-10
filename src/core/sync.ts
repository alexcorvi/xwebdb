/**
 * This is the synchronization class that uses the remote sync adapter
 * to send and receive data.
 * How it does it:
 *
 * Considering that the persistence layer is actually a key/value store
 * It sets the key to: {ID}_{Rev}
 * where 	{ID}: is document ID
 * 			{Rev}: is document revision
 *
 * And each database (local & remote) has a special document ($H)
 * where it stores a value that once not equal between two DBs they should sync
 *
 * When calling the _sync() method:
 * 1. it compares the local and remote $H if they are equal, it stops
 * 2. gets the difference between the two databases
 * 3. resolves conflicts by last-write wins algorithm (can't be otherwise)
 * 4. resolves errors that can be caused by unique violation constraints (also by last-write wins)
 * 5. uploads and downloads documents
 * 6. documents that win overwrite documents that lose
 * 7. sets local and remote $H
 *
 * This is a very simple synchronization protocol, but it has the following advantages
 * 		A. it uses the least amount of data overhead
 * 			i.e. there's no need for compression, logs, compaction...etc.
 * 		B. there's no need for custom conflict resolution strategies
 *
 * However, there's drawbacks:
 * 		A. Can't use custom conflict resolution strategies if there's a need
 * 		B. updates on different fields of the documents can't get merged (last write-wins always)
 * 		C. Can't get a history of the document (do we need it?)
 */

import { Persistence } from "./persistence";
import { remoteStore } from "./adapters/type";
import { Index } from "./indexes";
import * as modelling from "./model/";
import { Line } from "./idb";
import { uid } from "./customUtils";

type diff = { key: string; value: Line };

const asc = (a: string, b: string) => (a > b ? 1 : -1);

export class Sync {
	private p: Persistence<any, any>;
	private rdata: remoteStore;

	constructor(persistence: Persistence<any, any>, rdata: remoteStore) {
		this.p = persistence;
		this.rdata = rdata;
	}

	// set local $H
	async setL$(unique: string) {
		await this.p.data.set("$H", { _id: "$H" + unique });
	}

	// set remote $H
	async setR$(unique: string) {
		await this.rdata.setItem("$H", JSON.stringify({ _id: "$H" + unique }));
	}

	// uniform value for both local and remote $H
	async unify$H() {
		const unique = Math.random().toString(36).substring(2);
		await this.setL$(unique);
		await this.setR$(unique);
	}

	/**
	 * This method sits in-front of the actually _sync method
	 * It checks whether there's an already a sync in progress
	 * and whether there are deferred writes or deletes
	 */
	sync() {
		if (
			this.p.syncInProgress || // should not sync when there's already a sync in progress
			this.p.db.deferredDeletes.length + this.p.db.deferredWrites.length // should not sync when there's deferred write/deletes about to happen
		) {
			return new Promise<{ sent: number; received: number; diff: number }>((resolve) => {
				setTimeout(() => resolve(this.sync()), 0);
			});
		} else
			return new Promise<{ sent: number; received: number; diff: number }>(
				(resolve, reject) => {
					this.p.syncInProgress = true;
					this._sync()
						.then((sRes) => {
							resolve(sRes);
						})
						.catch(reject)
						.finally(() => {
							this.p.syncInProgress = false;
						});
				}
			);
	}

	/**
	 * When finding a diff, decide what to do with it:
	 * "this" means docs that should be uploaded
	 * "that" means docs that should be downloaded		--> or vice versa
	 * A. if there's a conflict (a key should be downloaded & uploaded at the same sync instance)
	 * 		Decide a winner:
	 * 			"this" wins: remove it from "that" and add it to "this"
	 * 			"that" wins: don't do anything
	 * B. No conflict: add it regularly
	 *
	 * in total: this adds and removes from two arrays,
	 * one array is of docs that should be uploaded
	 * and one of docs that should be downloaded
	 */
	private async decide(
		key: string,
		getter: (x: string) => Promise<Line>,
		thisDiffs: diff[],
		thatDiffs: diff[]
	) {
		const _id = key.split("_")[0];
		const rev = key.split("_")[1];
		const thisTime = Number(rev.substring(2));
		const conflictingIndex = thatDiffs.findIndex((x) => x.key.startsWith(_id + "_"));
		if (conflictingIndex > -1) {
			const conflicting = thatDiffs[conflictingIndex];
			const conflictingRev = conflicting.key.split("_")[1];
			const conflictingTime = Number(conflictingRev.substring(2));
			if (thisTime > conflictingTime) {
				// this wins
				thatDiffs.splice(conflictingIndex, 1); // removing that
				thisDiffs.push({
					key: key,
					value: (await getter(key)) || "",
				});
			}
			// else { }
			// otherwise .. don't add this diff, and keep that diff
			// (i.e. do nothing here, no else)
		} else {
			thisDiffs.push({
				key: key,
				value: (await getter(key)) || "",
			});
		}
	}

	/**
	 * This checks whether an update would cause a unique constraint violation
	 * by actually adding to indexes (if it's a doc)
	 * or by creating a new index (if it's an index)
	 */
	private UCV(
		input: Line
	):
		| { type: "doc"; prop: string; value: string }
		| { type: "index"; fieldName: string; sparse: boolean }
		| false {
		try {
			if (!input.$$indexCreated) {
				input = modelling.clone(input, this.p._model)
				// i.e. document
				// don't cause UCV by _id (without this line all updates would trigger UCV)
				// _id UCVs conflicts are only natural
				// and solved by the fact that they are persisted on the same key
				input._id = uid();
				this.p.db.addToIndexes(input);
				this.p.db.removeFromIndexes(input);
			} else {
				this.p.db.indexes[input.$$indexCreated.fieldName] = new Index(
					input.$$indexCreated
				);
				this.p.db.indexes[input.$$indexCreated.fieldName].insert(
					this.p.db.getAllData()
				);
				delete this.p.db.indexes[input.$$indexCreated.fieldName];
			}
		} catch (e) {
			if (!input.$$indexCreated) {
				return {
					type: "doc",
					prop: (e as any).prop,
					value: (e as any).key,
				};
			} else {
				delete this.p.db.indexes[input.$$indexCreated.fieldName];
				return {
					type: "index",
					fieldName: input.$$indexCreated.fieldName,
					sparse: !!input.$$indexCreated.sparse,
				};
			}
		}
		return false;
	}

	/**
	 * Compare the local and remote $H
	 * if there's a difference:
	 * 		A. get a diff of the keys
	 * 		B. decide which documents to upload and to download (using the above strategy)
	 * 		C. Sets remote and local $H
	 * 		D. returns the number of sent and received documents
	 * 			in addition to a number indicating whether this method actually did a sync
	 * 			-1: $H are equal, didn't do anything
	 * 			0: $H are different, but keys are equal, just updated the $H
	 * 			1: found a diff in documents and did a full synchronization process.
	 */
	async _sync(force: boolean = false): Promise<{
		sent: number;
		received: number;
		diff: -1 | 0 | 1;
	}> {
		const r$H = (await this.rdata!.getItem("$H")) || "0";
		const l$H = JSON.stringify((await this.p.data.get("$H")) || 0);
		if (!force && (l$H === r$H || (l$H === "0" && (r$H || "").indexOf("10009") > -1))) {
			return { sent: 0, received: 0, diff: -1 };
		}

		const remoteKeys = (await this.rdata!.keys()).sort(asc);
		const localKeys = ((await this.p.data.keys()) as string[]).sort(asc);

		remoteKeys.splice(remoteKeys.indexOf("$H"), 1); // removing $H
		localKeys.splice(localKeys.indexOf("$H"), 1);

		const remoteDiffs: diff[] = [];
		const localDiffs: diff[] = [];

		const rl = remoteKeys.length;
		let ri = 0;
		const ll = localKeys.length;
		let li = 0;
		while (ri < rl || li < ll) {
			let rv = remoteKeys[ri];
			let lv = localKeys[li];
			if (rv === lv) {
				ri++;
				li++;
				continue;
			} else if (li === ll || asc(lv, rv) > 0) {
				ri++;
				await this.decide(
					rv,
					async (x: string) =>
						modelling.deserialize(this.p.decode(await this.rdata.getItem(x))),
					remoteDiffs,
					localDiffs
				);
			} else {
				li++;
				await this.decide(
					lv,
					async (x: string) => (await this.p.data.get(x))!,
					localDiffs,
					remoteDiffs
				);
			}
		}

		if (remoteDiffs.length === 0 && localDiffs.length === 0) {
			// set local $H to remote $H value
			await this.setL$(r$H.replace(/.*\$H(.*)"}/,"$1"));
			return { sent: 0, received: 0, diff: 0 };
		}

		// downloading
		const downRemove: string[] = [];
		const downSet: [string, Line][] = [];
		for (let index = 0; index < remoteDiffs.length; index++) {
			const diff = remoteDiffs[index];
			const UCV = this.UCV(diff.value);

			// if unique constraint violations occurred
			// make the key non-unique
			// any other implementation would result in unjustified complexity
			if (UCV && UCV.type === "doc") {
				const uniqueProp = UCV.prop;
				await this.p.data.set(
					localKeys.find((x) => x.startsWith(uniqueProp + "_")) || "",
					{
						_id: uniqueProp,
						$$indexCreated: {
							fieldName: uniqueProp,
							unique: false,
							sparse: this.p.db.indexes[uniqueProp].sparse,
						},
					}
				);
			} else if (UCV && UCV.type === "index") {
				diff.value = {
					$$indexCreated: {
						fieldName: UCV.fieldName,
						unique: false,
						sparse: UCV.sparse,
					},
					_id: UCV.fieldName,
				};
			}
			const diff_id_ = diff.key.split("_")[0] + "_";
			const oldIDRev = localKeys.find((key) => key.startsWith(diff_id_)) || "";
			if (oldIDRev) downRemove.push(oldIDRev);
			downSet.push([diff.key, diff.value]);
		}
		await this.p.data.dels(downRemove);
		await this.p.data.sets(downSet);

		// uploading
		const upRemove: string[] = [];
		const upSet: { key: string; value: string }[] = [];
		for (let index = 0; index < localDiffs.length; index++) {
			const diff = localDiffs[index];
			const diff_id_ = diff.key.split("_")[0] + "_";
			const oldIDRev = remoteKeys.find((key) => key.startsWith(diff_id_)) || "";
			if (oldIDRev) upRemove.push(oldIDRev);
			upSet.push({ key: diff.key, value: this.p.encode(modelling.serialize(diff.value)) });
		}
		await this.rdata.removeItems(upRemove);
		await this.rdata.setItems(upSet);

		await this.p.loadDatabase();
		try {
			this.p.db.live.update();
		} catch (e) {
			console.error(`XWebDB: Could not do live updates due to an error:`, e);
		}

		await this.unify$H();
		return {
			sent: localDiffs.length,
			received: remoteDiffs.length,
			diff: 1,
		};
	}
}
