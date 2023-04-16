import { Persistence } from "./persistence";
import diffingLib from "diff-sorted-array";
import * as u from "./customUtils";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
export type logType = "w" | "d";
type log = { d: string; t: logType };
type syncEntry = { timestamp: string; value: log };
export type conflict = {
	local: syncEntry[];
	remote: syncEntry[];
};

export class Sync {
	private p: Persistence;
	rdata: remoteStore;
	rlogs: remoteStore;
	log: IDB;

	constructor(
		persistence: Persistence,
		log: IDB,
		rdata: remoteStore,
		rlogs: remoteStore
	) {
		this.p = persistence;
		this.rdata = rdata;
		this.rlogs = rlogs;
		this.log = log;
	}

	async addToLog(d: string, t: logType, timestamp?: string) {
		timestamp = timestamp || Date.now().toString(36); // create a timestamp if not provided by a remote change

		await this.log.set(timestamp, JSON.stringify({ d, t }));
		await this.log.set(
			"$H",
			u.xxh(JSON.stringify((await this.log.keys()).sort())).toString()
		);
	}

	compareLog(
		localKeys: string[],
		remoteKeys: string[]
	): { shouldSend: string[]; shouldHave: string[] } {
		let shouldHave: string[] = [];
		let shouldSend: string[] = [];

		const diff = diffingLib.justDiff(
			localKeys.sort(),
			remoteKeys.sort(),
			diffingLib.asc
		);
		shouldHave = diff.added;
		shouldSend = diff.deleted;

		return {
			shouldHave,
			shouldSend,
		};
	}

	sync() {
		return new Promise<{
			sent: number;
			received: number;
			diff: -1 | 0 | 1;
		}>((resolve) => {
			let interval = setInterval(async () => {
				if (!this.p.syncInProgress) {
					clearInterval(interval);
					this.p.syncInProgress = true;
					let syncResult: {
						sent: number;
						received: number;
						diff: -1 | 0 | 1;
					} = { sent: 0, received: 0, diff: -1 };
					try {
						syncResult = await this._sync();
					} catch (e) {
						console.log(Error(e as any));
					}
					this.p.syncInProgress = false;
					resolve(syncResult);
				}
			}, 1);
		});
	}

	defaultResolveConflict(conflict: conflict): {
		entry: syncEntry;
		origin: "remote" | "local";
	} {
		const winnerL = conflict.local.sort((a, b) =>
			parseInt(a.timestamp, 36) > parseInt(b.timestamp, 36) ? -1 : 1
		)[0];
		const winnerR = conflict.remote.sort((a, b) =>
			parseInt(a.timestamp, 36) > parseInt(b.timestamp, 36) ? -1 : 1
		)[0];
		if (parseInt(winnerL.timestamp, 36) > parseInt(winnerR.timestamp, 36)) {
			return {
				entry: winnerL,
				origin: "local",
			};
		} else {
			return {
				entry: winnerR,
				origin: "remote",
			};
		}
	}

	async _sync(): Promise<{
		sent: number;
		received: number;
		diff: -1 | 0 | 1;
	}> {
		const rHash = await this.rlogs!.getItem("$H");
		const lHash = (await this.log.get("$H")) || "0";
		if (
			lHash === rHash ||
			(lHash === "0" && (rHash || "").indexOf("10009") > -1)
		) {
			return { sent: 0, received: 0, diff: -1 };
		}
		const remoteKeys = (await this.rlogs!.keys()).filter((x) => x !== "$H");
		const localKeys = (await this.log.keys()).filter((x) => x !== "$H");
		const diff = this.compareLog(localKeys as string[], remoteKeys);
		if (diff.shouldHave.length === 0 && diff.shouldSend.length === 0) {
			// no diff, just not the same hash
			await this.rlogs!.setItem(
				"$H",
				u.xxh(JSON.stringify(remoteKeys.sort())).toString()
			);

			await this.log.set(
				"$H",
				u.xxh(JSON.stringify(localKeys.sort())).toString()
			);
			return { sent: 0, received: 0, diff: 0 };
		}

		const shouldHaves: syncEntry[] = (
			await this.rlogs!.getItems(diff.shouldHave)
		).map((x) => ({
			timestamp: x.key,
			value: JSON.parse(x.value),
		}));
		const shouldSend: syncEntry[] = await Promise.all(
			diff.shouldSend.map(async (x) => ({
				timestamp: x,
				value: JSON.parse((await this.log.get(x)) || ""),
			}))
		);

		const conflicts: {
			[key: string]: conflict;
		} = {};
		const winners: {
			[key: string]: string;
		} = {};

		// find conflicts
		for (let index = 0; index < shouldHaves.length; index++) {
			const r = shouldHaves[index];
			if (!shouldSend.find((x) => x.value.d === r.value.d)) continue;
			const id = r.value.d;
			if (!conflicts[id]) conflicts[id] = { local: [], remote: [] };
			conflicts[id].remote.push(r);
		}
		for (let index = 0; index < shouldSend.length; index++) {
			const r = shouldSend[index];
			if (!shouldHaves.find((x) => x.value.d === r.value.d)) continue;
			const id = r.value.d;
			if (!conflicts[id]) conflicts[id] = { local: [], remote: [] };
			conflicts[id].local.push(r);
		}

		// process conflicts
		for (const docID in conflicts) {
			const conflict = conflicts[docID];
			const resolved = this.defaultResolveConflict(conflict);
			if (resolved.entry.value.t === "d") {
				winners[docID] = "del";
			} else if (resolved.origin === "local") {
				winners[docID] =
					(await this.p.data.get(resolved.entry.value.d)) || "";
			} else {
				winners[docID] =
					(await this.rdata!.getItem(resolved.entry.value.d)) || "";
			}
		}

		// process shouldHave
		for (let index = 0; index < shouldHaves.length; index++) {
			const e = shouldHaves[index];
			const conflict = winners[e.value.d];
			if (conflict) {
				if (conflict === "del") {
					this.p.deleteData(e.value.d, e.timestamp);
				} else {
					this.p.writeData(e.value.d, conflict, e.timestamp);
				}
				continue;
			}
			if (e.value.t === "d") {
				await this.p.deleteData(e.value.d, e.timestamp);
			} else {
				const deletedWrite = shouldHaves.find(
					(x) => x.value.t === "d" && x.value.d === e.value.d
				);
				if (deletedWrite) {
					// if it has been deleted, add log only
					await this.addToLog(e.value.d, "w", e.timestamp);
				} else {
					// otherwise bring and write whole data (and log)
					const remoteData = await this.rdata!.getItem(e.value.d);
					await this.p.writeData(e.value.d, remoteData, e.timestamp);
				}
			}
		}

		// process shouldSend
		const deletions = shouldSend.filter(
			(x) => x.value.t === "d" && !winners[x.value.d] // skip conflicts
		);
		const writes = shouldSend.filter(
			(x) =>
				x.value.t === "w" &&
				!deletions.find((y) => y.value.d === x.value.d) && // skip write + delete
				!winners[x.value.d] // skip conflicts
		);
		const conflictShouldSendDeletions = Object.keys(winners).filter(
			(docID) => winners[docID] === "del"
		);
		const conflictShouldWrites = Object.keys(winners)
			.filter((docID) => winners[docID] !== "del")
			.map((x) => Promise.resolve({ key: x, value: winners[x] }));
		await this.rdata!.removeItems(
			deletions.map((x) => x.value.d).concat(conflictShouldSendDeletions)
		);
		await this.rdata!.setItems(
			await Promise.all(
				writes
					.map(async (x) => ({
						key: x.value.d,
						value: (await this.p.data.get(x.value.d)) || "",
					}))
					.concat(conflictShouldWrites)
			)
		);
		await this.rlogs!.setItems(
			shouldSend.map((x) => {
				// edge case 1
				if (
					Object.keys(winners).find(
						(docID) =>
							docID === x.value.d && winners[docID] !== "del"
					)
				) {
					// if a remove has lost, send a modified log
					// so the other client wouldn't remove when receiving it
					// instead it will try to get an update
					// and it will get one that it wrote itself
					// to the remote DB (the middleware)
					x.value.t = "w";
				}
				// edge case 2
				if (
					Object.keys(winners).find(
						(docID) =>
							docID === x.value.d && winners[docID] === "del"
					)
				) {
					// if a remove has won, send a modified log
					// so the other client wouldn't try to download when receiving it
					// instead it will try to delete local item
					x.value.t = "d";
				}
				return { key: x.timestamp, value: JSON.stringify(x.value) };
			})
		);

		// updating remote hash
		// shouldHaves only             => no need to update (local hash updates automatically)
		// shouldSend only              => hash (old remote keys + shouldSend keys)
		// shouldHaves + shouldSends    => hash (old remote keys + shouldSend keys)
		if (shouldSend.length) {
			let allRemoteKeys = remoteKeys.concat(
				shouldSend.map((x) => x.timestamp)
			);
			await this.rlogs!.setItem(
				"$H",
				u.xxh(JSON.stringify(allRemoteKeys.sort())).toString()
			);
		}

		return {
			sent: diff.shouldSend.length,
			received: diff.shouldHave.length,
			diff: 1,
		};
	}
}
