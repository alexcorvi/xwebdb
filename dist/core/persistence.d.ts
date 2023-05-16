/**
 * Persistence layer class
 * Actual IndexedDB operations are in "idb.ts"
 * This class mainly process data and prepares it prior idb.ts
 */
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Doc } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB, Line } from "./idb";
import { Sync } from "./sync";
interface PersistenceOptions<G extends Doc, C extends typeof Doc> {
    db: Datastore<G, C>;
    encode?: (raw: string) => string;
    decode?: (encrypted: string) => string;
    corruptAlertThreshold?: number;
    model?: typeof Doc;
    syncInterval?: number;
    syncToRemote?: (name: string) => remoteStore;
    stripDefaults?: boolean;
}
/**
 * Create a new Persistence object for database options.db
 */
export declare class Persistence<G extends Doc, C extends typeof Doc> {
    db: Datastore<G, C>;
    ref: string;
    data: IDB;
    RSA?: (name: string) => remoteStore;
    syncInterval: number;
    syncInProgress: boolean;
    sync?: Sync;
    corruptAlertThreshold: number;
    encode: (s: string) => string;
    decode: (s: string) => string;
    stripDefaults: boolean;
    _model: typeof Doc;
    shouldEncode: boolean;
    constructor(options: PersistenceOptions<G, C>);
    /**
     * serializes & writes a new index using the $$ notation.
     */
    writeNewIndex(newIndexes: {
        $$indexCreated: EnsureIndexOptions;
    }[]): Promise<string[]>;
    /**
     * Copies, strips all default data, and serializes documents then writes it.
     */
    writeNewData(newDocs: G[]): Promise<string[]>;
    /**
     * Load the database
     * 1. Reset all indexes
     * 2. Create all indexes
     * 3. Add data to indexes
     */
    loadDatabase(): Promise<boolean>;
    /**
     * Reads data from the database
     * (excluding $H and documents that actually $deleted)
     */
    readData(): Promise<(Line | null)[]>;
    /**
     * Given that IndexedDB documents ID has the following structure:
     * {ID}_{Rev}
     * 		where 	{ID} is the actual document ID
     * 				{Rev} is a random string of two characters + timestamp
     *
     * Deletes data (in bulk)
     * by
     * 		1. getting all the document (or index) old revisions and deleting them
     * 		2. then setting a new document with the same ID but a newer rev with the $deleted value
     * 		3. then setting $H to a value indicating that a sync operation should progress
     */
    deleteData(_ids: string[]): Promise<string[]>;
    /**
     * Given that IndexedDB documents ID has the following structure:
     * {ID}_{Rev}
     * 		where 	{ID} is the actual document ID
     * 				{Rev} is a random string of two characters + timestamp
     *
     * writes data (in bulk) (inserts & updates)
     * by: 	1. getting all the document (or index) old revisions and deleting them
     * 		2. then setting a new document with the same ID but a newer rev with the new value
     * 			(i.e. a serialized version of the document)
     * 		3. then setting $H to a value indicating that a sync operation should progress
     */
    writeData(input: [string, Line][]): Promise<string[]>;
    /**
     * Deletes all data
     * deletions will NOT sync
     */
    deleteEverything(): Promise<void>;
}
export {};
