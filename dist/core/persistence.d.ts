import { Datastore, EnsureIndexOptions } from "./datastore";
import { Doc } from "../types";
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
interface PersistenceOptions<G extends Doc, C extends typeof Doc> {
    db: Datastore<G, C>;
    encode?: (raw: string) => string;
    decode?: (encrypted: string) => string;
    corruptAlertThreshold?: number;
    model?: typeof Doc;
    syncInterval?: number;
    syncToRemote?: (name: string) => remoteStore;
    devalidateHash?: number;
    stripDefaults: boolean;
}
/**
 * Create a new Persistence object for database options.db
 */
export declare class Persistence<G extends Doc, C extends typeof Doc> {
    db: Datastore<G, C>;
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
    stripDefaults: boolean;
    private _model;
    constructor(options: PersistenceOptions<G, C>);
    writeNewIndex(newIndexes: {
        $$indexCreated: EnsureIndexOptions;
    }[]): Promise<string[]>;
    writeNewData(newDocs: G[]): Promise<string[]>;
    treatSingleLine(line: string): persistenceLine;
    /**
     * Load the database
     * 1) Create all indexes
     * 2) Insert all data
     */
    loadDatabase(): Promise<boolean>;
    readData(event: PersistenceEvent): Promise<void>;
    deleteData(_ids: string[]): Promise<string[]>;
    writeData(input: [string, string][]): Promise<string[]>;
    /**
     * Deletes all data
     * deletions will not be syncable
     */
    deleteEverything(): Promise<void>;
}
export {};
