import { Persistence } from "./persistence";
export declare type logType = "w" | "d";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
export declare class Sync {
    private p;
    rdata: remoteStore;
    rlogs: remoteStore;
    log: IDB;
    constructor(persistence: Persistence, log: IDB, rdata: remoteStore, rlogs: remoteStore);
    addToLog(d: string, t: logType, timestamp?: string): Promise<void>;
    compareLog(localKeys: string[], remoteKeys: string[]): {
        shouldSend: string[];
        shouldHave: string[];
    };
    sync(): Promise<{
        sent: number;
        received: number;
    }>;
    _sync(): Promise<{
        sent: number;
        received: number;
    }>;
}
