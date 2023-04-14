import { Datastore, EnsureIndexOptions } from "./datastore";
import { BaseModel } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
import { Sync } from "./sync";
declare type persistenceLine = {
    type: "index" | "doc" | "corrupt";
    status: "add" | "remove";
    data: any;
};
declare type PersistenceEventCallback = (message: string) => Promise<void>;
declare type PersistenceEventEmits = "readLine" | "writeLine" | "end";
export declare class PersistenceEvent {
    callbacks: {
        readLine: Array<PersistenceEventCallback>;
        writeLine: Array<PersistenceEventCallback>;
        end: Array<PersistenceEventCallback>;
    };
    on(event: PersistenceEventEmits, cb: PersistenceEventCallback): void;
    emit(event: PersistenceEventEmits, data: string): Promise<void>;
}
interface PersistenceOptions<G extends Partial<BaseModel>> {
    db: Datastore<G>;
    encode?: (raw: string) => string;
    decode?: (encrypted: string) => string;
    corruptAlertThreshold?: number;
    model?: (new () => G) & {
        new: (json: G) => G;
    };
    syncInterval?: number;
    syncToRemote?: (name: string) => remoteStore;
}
/**
 * Create a new Persistence object for database options.db
 */
export declare class Persistence<G extends Partial<BaseModel> = any> {
    db: Datastore<G>;
    ref: string;
    data: IDB;
    RSA?: (name: string) => remoteStore;
    syncInterval: number;
    syncInProgress: boolean;
    sync?: Sync;
    corruptAlertThreshold: number;
    encode: (s: string) => string;
    decode: (s: string) => string;
    private _model;
    protected _memoryIndexes: string[];
    protected _memoryData: string[];
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
    deleteData(_id: string, timestamp?: string): Promise<void>;
    writeData(_id: string, data: string, timestamp?: string): Promise<void>;
    clearData(): Promise<void>;
}
export {};
/**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */
