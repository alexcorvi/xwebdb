/**
 * Main user API to the database
 * exposing only strongly typed methods and relevant configurations
 */
import { Datastore, EnsureIndexOptions, observable as o } from "./core";
import { remoteStore } from "./core/adapters/type";
import { NOP, Doc, Filter, SchemaKeyProjection, SchemaKeySort, UpdateOperators, UpsertOperators, NFP } from "./types";
export interface DatabaseConfigurations<C extends typeof Doc, D extends Doc> {
    ref: string;
    model?: C;
    encode?(line: string): string;
    decode?(line: string): string;
    corruptAlertThreshold?: number;
    timestampData?: boolean;
    sync?: {
        syncToRemote?: (name: string) => remoteStore;
        syncInterval?: number;
    };
    deferPersistence?: number;
    stripDefaults?: boolean;
    indexes?: NOP<D>[];
    cacheLimit?: number;
}
export declare class Database<S extends Doc> {
    private ref;
    private model;
    /**
     * set to "public" so we can allow some level of access to core methods and properties
     */
    _datastore: Datastore<S, typeof Doc>;
    /**
     * Creating a database is creating a reference for it
     * However, the database will be loading existing data in the background
     * use this promise to ensure that the database has actually loaded all the preexisting data
     */
    loaded: Promise<boolean>;
    constructor(options: DatabaseConfigurations<typeof Doc, S>);
    /**
     * insert documents
     */
    insert(docs: S[] | S): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Get live queries (observable)
     * can be bidirectionally live (to and from DB)
     * or either from or to DB
     */
    live(filter?: Filter<S>, { skip, limit, project, sort, toDB, fromDB, }?: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<S>;
        project?: SchemaKeyProjection<S>;
        toDB?: boolean;
        fromDB?: boolean;
    }): Promise<o.ObservableArray<S[]> & {
        kill: (w?: "toDB" | "fromDB") => Promise<void>;
    }>;
    /**
     * Find document(s) that meets a specified criteria
     */
    read(filter?: Filter<S>, { skip, limit, project, sort, }?: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<S>;
        project?: SchemaKeyProjection<S>;
    }): Promise<S[]>;
    /**
     * Update document(s) that meets the specified criteria
     */
    update(filter: Filter<S>, update: UpdateOperators<S>, multi?: boolean): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Update document(s) that meets the specified criteria,
     * and do an insertion if no documents are matched
     */
    upsert(filter: Filter<S>, update: UpsertOperators<S>, multi?: boolean): Promise<{
        docs: S[];
        number: number;
        upsert: boolean;
    }>;
    /**
     * Count documents that meets the specified criteria
     */
    count(filter?: Filter<S>): Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     *
     */
    delete(filter: Filter<S>, multi?: boolean): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Create an index specified by options
     */
    createIndex(options: EnsureIndexOptions & {
        fieldName: keyof NFP<S>;
    }): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Remove an index by passing the field name that it is related to
     */
    removeIndex(fieldName: string & keyof NFP<S>): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Reload database from the persistence layer
     */
    reload(): Promise<{}>;
    /**
     * Synchronies the database with remote source using the remote adapter
     */
    sync(): Promise<{
        sent: number;
        received: number;
        diff: number;
    }>;
    /**
     * Forcefully sync the database with remote source using the remote adapter
     * bypassing: 	A. a check to see whether other sync action is in progress
     * 				B. a check to see whether there are deferred writes/deletes
     * 				C. a check to see whether local DB and remote source have same $H
     * Use this with caution, and only if you know what you're doing
     */
    forceSync(): Promise<{
        sent: number;
        received: number;
        diff: 0 | 1 | -1;
    }>;
    /**
     * true: there's a sync in progress
     * false: there's no sync in progress
     */
    get syncInProgress(): boolean;
    /**
     * Create document
     */
    create: (docs: S[] | S) => Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Find documents that meets a specified criteria
     */
    find: (filter?: Filter<S>, { skip, limit, project, sort, }?: {
        skip?: number | undefined;
        limit?: number | undefined;
        sort?: SchemaKeySort<S> | undefined;
        project?: SchemaKeyProjection<S> | undefined;
    }) => Promise<S[]>;
    /**
     * Count the documents matching the specified criteria
     */
    number: (filter?: Filter<S>) => Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     */
    remove: (filter: Filter<S>, multi?: boolean) => Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Create an index specified by options
     */
    ensureIndex: (options: EnsureIndexOptions & {
        fieldName: keyof NFP<S>;
    }) => Promise<{
        affectedIndex: string;
    }>;
}
