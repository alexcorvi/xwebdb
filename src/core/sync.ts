import { Persistence, persistenceLine } from "./persistence";
import * as u from "./customUtils";
import { remoteStore } from "./adapters/type";
import { Index } from "./indexes";
import * as modelling from "./model/";

type diff = { key: string; value: string };

const asc = (a: string, b: string) => (a > b ? 1 : -1);

export class Sync {
	private p: Persistence<any, any>;
	private rdata: remoteStore;

	constructor(persistence: Persistence<any, any>, rdata: remoteStore) {
		this.p = persistence;
		this.rdata = rdata;
	}

	// set local hash
	async setL$(keys?: string[]) {
		if (!keys) keys = (await this.p.data.keys()) as string[];
		const hash = u.xxh(JSON.stringify(keys.sort(asc))).toString();
		this.p.data.set("$H", "$H" + hash + "_" + this.ts());
	}

	// set remote hash
	async setR$(keys?: string[]) {
		if (!keys) keys = (await this.rdata.keys()) as string[];
		const hash = u.xxh(JSON.stringify(keys.sort(asc))).toString();
		this.rdata.setItem("$H", "$H" + hash + "_" + this.ts());
	}

	// time signature
	private ts() {
		return Math.floor(Date.now() / this.p.invalidateHash);
	}

	sync() {
		return new Promise<{
			sent: number;
			received: number;
			diff: -1 | 0 | 1;
		}>((resolve, reject) => {
			let interval = setInterval(async () => {
				if (
					!this.p.syncInProgress || // should not sync when there's already a sync in progress
					this.p.db.deferredDeletes.length +
						this.p.db.deferredWrites.length // should not sync when there's deferred write/deletes about to happen
				) {
					clearInterval(interval);
					this.p.syncInProgress = true;
					let syncResult: {
						sent: number;
						received: number;
						diff: -1 | 0 | 1;
					} = { sent: 0, received: 0, diff: -1 };
					let err = undefined;
					try {
						syncResult = await this._sync();
					} catch (e) {
						err = Error(e as any);
					}
					this.p.syncInProgress = false;
					if (err) reject(err);
					else resolve(syncResult);
				}
			}, 1);
		});
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
		getter: (x: string) => Promise<string>,
		thisDiffs: diff[],
		thatDiffs: diff[]
	) {
		const _id = key.split("_")[0];
		const rev = key.split("_")[1];
		const thisTime = Number(rev.substring(2));
		const conflictingIndex = thatDiffs.findIndex((x) =>
			x.key.startsWith(_id + "_")
		);
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
			// otherwise .. don't add this diff
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
		input: string
	):
		| { type: "doc"; prop: string; value: string }
		| { type: "index"; fieldName: string; sparse: boolean }
		| false {
		let line: persistenceLine = this.p.treatSingleLine(input);
		if (line.status === "remove") return false;
		try {
			if (line.type === "doc") {
				// don't cause UCV by _id (without this line all updates would trigger UCV)
				// _id UCVs conflicts are only natural
				// and solved by the fact that they are persisted on the same index
				line.data._id = null;
				this.p.db.addToIndexes(line.data);
			} else {
				this.p.db.indexes[line.data.fieldName] = new Index(
					line.data.data
				);
				this.p.db.indexes[line.data.fieldName].insert(
					this.p.db.getAllData()
				);
			}
		} catch (e) {
			if (line.type === "doc") {
				return {
					type: "doc",
					prop: (e as any).prop,
					value: (e as any).key,
				};
			} else {
				delete this.p.db.indexes[line.data.fieldName];
				return {
					type: "index",
					fieldName: line.data.fieldName,
					sparse: !!line.data.data.sparse,
				};
			}
		}
		this.p.db.removeFromIndexes(line.data);
		return false;
	}

	async _sync(force: boolean = false): Promise<{
		sent: number;
		received: number;
		diff: -1 | 0 | 1;
	}> {
		const timeSignature = this.ts().toString();
		const rHash = (await this.rdata!.getItem("$H")) || "0";
		const lHash = (await this.p.data.get("$H")) || "0";
		const hashTime = lHash.split("_")[1];
		if (
			!force &&
			hashTime === timeSignature &&
			(lHash === rHash ||
				(lHash === "0" && (rHash || "").indexOf("10009") > -1))
		) {
			return { sent: 0, received: 0, diff: -1 };
		}

		const remoteKeys = (await this.rdata!.keys())
			.filter((x) => x !== "$H")
			.sort(asc);
		const localKeys = ((await this.p.data.keys()) as string[])
			.filter((x) => x !== "$H")
			.sort(asc);

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
					(x: string) => this.rdata.getItem(x),
					remoteDiffs,
					localDiffs
				);
			} else {
				li++;
				await this.decide(
					lv,
					(x: string) => this.p.data.get(x) as any,
					localDiffs,
					remoteDiffs
				);
			}
		}

		if (remoteDiffs.length === 0 && localDiffs.length === 0) {
			await this.setL$();
			await this.setR$();
			return { sent: 0, received: 0, diff: 0 };
		}

		// downloading
		const downRemove: string[] = [];
		const downSet: [string, string][] = [];
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
					this.p.encode(
						modelling.serialize({
							$$indexCreated: {
								fieldName: uniqueProp,
								unique: false,
								sparse: this.p.db.indexes[uniqueProp].sparse,
							},
						})
					)
				);
			} else if (UCV && UCV.type === "index") {
				diff.value = this.p.encode(
					modelling.serialize({
						$$indexCreated: {
							fieldName: UCV.fieldName,
							unique: false,
							sparse: UCV.sparse,
						},
					})
				);
			}
			const oldIDRev =
				localKeys.find((key) =>
					key.toString().startsWith(diff.key.split("_")[0] + "_")
				) || "";
			if (oldIDRev) downRemove.push(oldIDRev);
			downSet.push([diff.key, diff.value]);
		}
		await this.p.data.dels(downRemove);
		await this.p.data.sets(downSet);
		await this.setL$();

		// uploading
		const upRemove: string[] = [];
		const upSet: { key: string; value: string }[] = [];
		for (let index = 0; index < localDiffs.length; index++) {
			const diff = localDiffs[index];
			const oldIDRev =
				remoteKeys.find((key) =>
					key.toString().startsWith(diff.key.split("_")[0] + "_")
				) || "";
			if (oldIDRev) upRemove.push(oldIDRev);
			upSet.push({ key: diff.key, value: diff.value });
		}
		await this.rdata.removeItems(upRemove);
		await this.rdata.setItems(upSet);
		await this.setR$();
		await this.p.loadDatabase();
		try {
			this.p.db.live.update();
		} catch (e) {
			console.error(
				`XWebDB: Could not do live updates due to an error:`,
				e
			);
		}
		return {
			sent: localDiffs.length,
			received: remoteDiffs.length,
			diff: 1,
		};
	}
}
