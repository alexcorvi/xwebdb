import { Datastore, EnsureIndexOptions } from "./datastore";
import { BaseModel } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
import { Sync } from "./sync";
export type persistenceLine = {
    type: "index" | "doc" | "corrupt";
    status: "add" | "remove";
    data: any;
};
type PersistenceEventCallback = (message: string) => Promise<void>;
type PersistenceEventEmits = "readLine" | "writeLine" | "end";
export declare class PersistenceEvent {
    callbacks: {
        readLine: Array<PersistenceEventCallback>;
        writeLine: Array<PersistenceEventCallback>;
        end: Array<PersistenceEventCallback>;
    };
    on(event: PersistenceEventEmits, cb: PersistenceEventCallback): void;
    emit(event: PersistenceEventEmits, data: string): Promise<void>;
}
interface PersistenceOptions<G extends Partial<BaseModel<G>>> {
    db: Datastore<G>;
    encode?: (raw: string) => string;
    decode?: (encrypted: string) => string;
    corruptAlertThreshold?: number;
    model?: (new () => G) & {
        new: (json: G) => G;
    };
    syncInterval?: number;
    syncToRemote?: (name: string) => remoteStore;
    devalidateHash?: number;
}
/**
 * Create a new Persistence object for database options.db
 */
export declare class Persistence<G extends Partial<BaseModel<G>> = any> {
    db: Datastore<G>;
    ref: string;
    data: IDB<string>;
    RSA?: (name: string) => remoteStore;
    syncInterval: number;
    syncInProgress: boolean;
    sync?: Sync;
    devalidateHash: number;
    corruptAlertThreshold: number;
    encode: (s: string) => string;
    decode: (s: string) => string;
    private _model;
    constructor(options: PersistenceOptions<G>);
    writeNewIndex(newIndexes: {
        $$indexCreated: EnsureIndexOptions;
    }[]): Promise<void>;
    writeNewData(newDocs: G[]): Promise<void>;
    treatSingleLine(line: string): persistenceLine;
    /**
     * Load the database
     * 1) Create all indexes
     * 2) Insert all data
     */
    loadDatabase(): Promise<boolean>;
    readData(event: PersistenceEvent): Promise<void>;
    deleteData(_ids: string[]): Promise<void>;
    writeData(input: [string, string][]): Promise<void>;
    /**
     * Deletes all data
     * deletions will not be syncable
     */
    deleteEverything(): Promise<void>;
}
export {};
