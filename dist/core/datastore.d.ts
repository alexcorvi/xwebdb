import { Cursor } from "./cursor";
import { Index } from "./indexes";
import { Persistence } from "./persistence";
import * as types from "../types";
import { Doc } from "../types/base-schema";
import { Q } from "./q";
import { remoteStore } from "./adapters/type";
import { Live } from "./live";
import { Cache } from "./cache";
type MongoDBQuery = Record<string, any>;
export interface EnsureIndexOptions {
    fieldName: string;
    unique?: boolean;
    sparse?: boolean;
}
export interface DataStoreOptions<G extends typeof Doc> {
    ref: string;
    encode?(line: string): string;
    decode?(line: string): string;
    corruptAlertThreshold?: number;
    timestampData?: boolean;
    syncToRemote?: (name: string) => remoteStore;
    syncInterval?: number;
    model?: G;
    defer?: number;
    stripDefaults?: boolean;
    indexes?: string[];
    cacheLimit?: number;
}
interface UpdateOptions {
    multi?: boolean;
    upsert?: boolean;
}
export declare class Datastore<G extends types.Doc & {
    [key: string]: any;
}, C extends typeof Doc> {
    ref: string;
    timestampData: boolean;
    persistence: Persistence<G, C>;
    live: Live;
    q: Q;
    indexes: {
        [key: string]: Index<G[keyof G], G>;
    };
    initIndexes: string[];
    model: C;
    defer: boolean;
    deferredWrites: G[];
    deferredDeletes: string[];
    cache: Cache<G>;
    constructor(options: DataStoreOptions<C>);
    private _processDeferred;
    /**
     * Load the database from indexedDB, and trigger the execution of buffered commands if any
     */
    loadDatabase(): Promise<boolean>;
    /**
     * Get an array of all the data in the database
     */
    getAllData(): G[];
    /**
     * Reset all currently defined indexes
     */
    resetIndexes(alsoDelete?: boolean): void;
    /**
     * Ensure an index is kept for this field. Same parameters as lib/indexes
     * For now this function is synchronous, we need to test how much time it takes
     * We use an async API for consistency with the rest of the code
     */
    ensureIndex(options: EnsureIndexOptions): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Remove an index
     */
    removeIndex(fieldName: string): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Add one or several document(s) to all indexes
     */
    addToIndexes<T extends G>(doc: T | T[]): void;
    /**
     * Remove one or several document(s) from all indexes
     */
    removeFromIndexes<T extends G>(doc: T | T[]): void;
    /**
     * Update one or several documents in all indexes
     * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
     * If one update violates a constraint, all changes are rolled back
     */
    private updateIndexes;
    fromDict(query: MongoDBQuery): G[] | null;
    /**
     * Return the list of candidates for a given query
     * Crude implementation for now, we return the candidates given by the first usable index if any
     * We try the following query types, in this order: basic match, $in match, comparison match
     * One way to make it better would be to enable the use of multiple indexes if the first usable index
     * returns too much data. I may do it in the future.
     *
     * Returned candidates will be scanned to find and remove all expired documents
     */
    getCandidates(query: MongoDBQuery): G[];
    /**
     * Insert a new document
     */
    insert(newDoc: G | G[]): Promise<types.Result<G>>;
    /**
     * Create a new _id that's not already in use
     */
    private createNewId;
    /**
     * Count all documents matching the query
     */
    count(query: any): Promise<number>;
    /**
     * Find all documents matching the query
     */
    find(query: any): Promise<G[]>;
    /**
     * Find all documents matching the query
     */
    cursor(query: any): Cursor<G, C>;
    /**
     * Update all docs matching query
     */
    private _update;
    update(query: any, updateQuery: any, options: UpdateOptions): Promise<types.Result<G> & {
        upsert: boolean;
    }>;
    /**
     * Remove all docs matching the query
     * For now very naive implementation (similar to update)
     */
    private _remove;
    remove(query: any, options?: {
        multi: boolean;
    }): Promise<types.Result<G>>;
}
export {};
