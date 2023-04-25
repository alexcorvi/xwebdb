import { Datastore, EnsureIndexOptions, observable as o } from "./core";
import { remoteStore } from "./core/adapters/type";
import { Doc, Filter, SchemaKeyProjection, SchemaKeySort, UpdateOperators, UpsertOperators, NFP } from "./types";
export interface DatabaseConfigurations<C extends typeof Doc> {
    ref: string;
    model?: C;
    encode?(line: string): string;
    decode?(line: string): string;
    corruptAlertThreshold?: number;
    timestampData?: boolean;
    reloadBeforeOperations?: boolean;
    sync?: {
        syncToRemote?: (name: string) => remoteStore;
        syncInterval?: number;
        devalidateHash?: number;
    };
    deferPersistence?: number;
    stripDefaults?: boolean;
}
export declare class Database<S extends Doc> {
    private ref;
    private reloadBeforeOperations;
    private model;
    _datastore: Datastore<S, typeof Doc>;
    loaded: Promise<boolean>;
    constructor(options: DatabaseConfigurations<typeof Doc>);
    private reloadFirst;
    /**
     * insert documents
     */
    insert(docs: S[] | S): Promise<{
        docs: S[];
        number: number;
    }>;
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
     * Reload database from the persistence layer (if it exists)
     */
    reload(): Promise<{}>;
    sync(): Promise<{
        sent: number;
        received: number;
        diff: 0 | 1 | -1;
    }>;
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
