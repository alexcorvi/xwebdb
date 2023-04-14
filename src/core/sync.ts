import { Persistence } from "./persistence";
export type logType = "w" | "d";
type log = { d: string; t: logType };
import diffingLib from "diff-sorted-array";
import * as u from "./customUtils";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";

export class Sync {

    private p: Persistence;
	rdata: remoteStore;
	rlogs: remoteStore;
    log: IDB

    constructor(persistence:Persistence, log: IDB , rdata: remoteStore, rlogs: remoteStore) {
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
        return new Promise<{ sent: number; received: number }>((resolve) => {
            let interval = setInterval(async () => {
                if (!this.p.syncInProgress) {
                    clearInterval(interval);
                    this.p.syncInProgress = true;
                    let syncResult = { sent: 0, received: 0 };
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
    
    async _sync() {
        const rHash = await this.rlogs!.getItem("$H");
        const lHash = (await this.log.get("$H")) || "0";
        if (lHash === rHash || (lHash === "0" && (rHash || '').indexOf("10009") > -1)) {
            return { sent: 0, received: 0 };
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
            return { sent: 0, received: 0 };
        }
    
        const shouldHaves: {
            timestamp: string;
            value: log;
        }[] = (await this.rlogs!.getItems(diff.shouldHave)).map((x) => ({
            timestamp: x.key,
            value: JSON.parse(x.value),
        }));
        for (let index = 0; index < shouldHaves.length; index++) {
            const e = shouldHaves[index];
            if (e.value.t === "d") {
                await this.p.deleteData(e.value.d, e.timestamp);
            } else {
                if (
                    shouldHaves.find(
                        (x) => x.value.t === "d" && x.value.d === e.value.d
                    )
                ) {
                    // if it has been deleted, add log only
                    await this.addToLog(e.value.d, "w", e.timestamp);
                } else {
                    // otherwise write whole data (and log)
                    await this.p.writeData(
                        e.value.d,
                        await this.rdata!.getItem(e.value.d),
                        e.timestamp
                    );
                }
            }
        }
    
        const shouldSend: {
            timestamp: string;
            value: log;
        }[] = await Promise.all(
            diff.shouldSend.map(async (x) => ({
                timestamp: x,
                value: JSON.parse((await this.log.get(x)) || ""),
            }))
        );
    
        const deletions = shouldSend.filter((x) => x.value.t === "d");
        const writes = shouldSend.filter(
            (x) =>
                x.value.t === "w" &&
                !deletions.find((y) => y.value.d === x.value.d)
            // shouldn't be deleted on the shouldSend
        );
        // deletions
        await this.rdata!.removeItems(deletions.map((x) => x.value.d));
        // writes
        await this.rdata!.setItems(
            await Promise.all(
                writes.map(async (x) => ({
                    key: x.value.d,
                    value: (await this.p.data.get(x.value.d)) || "",
                }))
            )
        );
        // write logs too
        await this.rlogs!.setItems(
            shouldSend.map((x) => ({
                key: x.timestamp,
                value: JSON.stringify(x.value),
            }))
        );
    
        // and hash
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
        };
    }
}