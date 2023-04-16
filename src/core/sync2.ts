import { Persistence } from "./persistence";
import * as u from "./customUtils";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
type diff = { key: string; value: string };

const asc = (a: string, b: string) => (a > b ? 1 : -1);

export class Sync {
	private p: Persistence;
	rdata: remoteStore;

	constructor(
		persistence: Persistence,
		rdata: remoteStore,
	) {
		this.p = persistence;
		this.rdata = rdata;
	}

	async setLocalHash(keys?: string[]) {
		if (!keys) keys = (await this.p.data.keys()) as string[];
		const hash = u.xxh(JSON.stringify(keys.sort(asc))).toString();
		this.p.data.set("$H", hash);
	}

	async setRemoteHash(keys?: string[]) {
		if (!keys) keys = (await this.rdata.keys()) as string[];
		const hash = u.xxh(JSON.stringify(keys.sort(asc))).toString();
		this.rdata.setItem("$H", hash);
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

	async brace(
		key: string,
		getter: (x: string) => Promise<string>,
		thisDiffs: diff[],
		thatDiffs: diff[]
	) {
		const _id = key.split("_")[0];
		const rev = key.split("_")[1];
		const thisTime = Number(rev.substring(2));
		const conflictingIndex = thatDiffs.findIndex((x) =>
			x.key.startsWith(_id+"_")
		);
		if (conflictingIndex > -1) {
			const conflicting = thatDiffs[conflictingIndex];
			const conflictingRev = conflicting.key.split("_")[1];
			const conflictingTime = Number(conflictingRev.substring(2));
			if (thisTime > conflictingTime) {
				// this wins
				thatDiffs.splice(conflictingIndex, 1); // removing remote
				thisDiffs.push({
					key: key,
					value: (await getter(key)) || "",
				});
			}
			// otherwise .. don't add to local diff
		} else {
			thisDiffs.push({
				key: key,
				value: (await getter(key)) || "",
			});
		}

		return { thisDiffs, thatDiffs };
	}

	async _sync(): Promise<{
		sent: number;
		received: number;
		diff: -1 | 0 | 1;
	}> {
		const rHash = await this.rdata!.getItem("$H");
		const lHash = (await this.p.data.get("$H")) || "0";
		if (
			lHash === rHash ||
			(lHash === "0" && (rHash || "").indexOf("10009") > -1)
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
				const b = await this.brace(
					rv,
					(x: string) => this.rdata.getItem(x),
					remoteDiffs,
					localDiffs
				);
			} else {
				li++;
				const b = await this.brace(
					lv,
					(x: string) => this.p.data.get(x) as any,
					localDiffs,
					remoteDiffs
				);
			}
		}

		if (remoteDiffs.length === 0 && localDiffs.length === 0) {
			await this.setLocalHash();
			await this.setRemoteHash();
			return { sent: 0, received: 0, diff: 0 };
		}

		// downloading
		// TODO: do it in bulk
		for (let index = 0; index < remoteDiffs.length; index++) {
			const diff = remoteDiffs[index];
			const oldIDRev =
				localKeys.find((key) =>
					key.toString().startsWith(diff.key.split("_")[0] + "_")
				) || "";
			if (oldIDRev) await this.p.data.del(oldIDRev);
			await this.p.data.set(diff.key, diff.value);
		}
		await this.setLocalHash();

		// uploading
		// TODO: do it in bulk
		const downRemoveKeys: string[] = [];
		const downSetKeys: { key: string; value: string }[] = [];
		for (let index = 0; index < localDiffs.length; index++) {
			const diff = localDiffs[index];
			const oldIDRev =
				remoteKeys.find((key) =>
					key.toString().startsWith(diff.key.split("_")[0]+"_")
				) || "";
			if (oldIDRev) downRemoveKeys.push(oldIDRev);
			downSetKeys.push({ key: diff.key, value: diff.value });
		}
		await this.rdata.removeItems(downRemoveKeys);
		await this.rdata.setItems(downSetKeys);
		await this.setRemoteHash();
		await this.p.loadDatabase();
		return {
			sent: localDiffs.length,
			received: remoteDiffs.length,
			diff: 1,
		};
	}
}
