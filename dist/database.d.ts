import { Datastore, EnsureIndexOptions, observable as o } from "./core";
import { remoteStore } from "./core/adapters/type";
import { NFP, BaseModel, Filter, SchemaKeyProjection, SchemaKeySort, UpdateOperators, UpsertOperators } from "./types";
export interface DatabaseConfigurations<S extends BaseModel<S>> {
    ref: string;
    model?: (new () => S) & {
        new: (json: S) => S;
    };
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
}
export declare class Database<S extends BaseModel<S>> {
    private ref;
    private reloadBeforeOperations;
    private model;
    _datastore: Datastore<S>;
    loaded: Promise<boolean>;
    constructor(options: DatabaseConfigurations<S>);
    private reloadFirst;
    /**
     * insert documents
     */
    insert(docs: S[] | S): Promise<{
        docs: S[];
        number: number;
    }>;
    live(filter?: Filter<NFP<S>>, { skip, limit, project, sort, toDB, fromDB, }?: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<NFP<S>>;
        project?: SchemaKeyProjection<NFP<S>>;
        toDB?: boolean;
        fromDB?: boolean;
    }): Promise<o.ObservableArray<S[]>>;
    /**
     * Find document(s) that meets a specified criteria
     */
    read(filter?: Filter<NFP<S>>, { skip, limit, project, sort, }?: {
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<NFP<S>>;
        project?: SchemaKeyProjection<NFP<S>>;
    }): Promise<S[]>;
    /**
     * Update document(s) that meets the specified criteria
     */
    update(filter: Filter<NFP<S>>, update: UpdateOperators<NFP<S>>, multi?: boolean): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Update document(s) that meets the specified criteria,
     * and do an insertion if no documents are matched
     */
    upsert(filter: Filter<NFP<S>>, update: UpsertOperators<NFP<S>>, multi?: boolean): Promise<{
        docs: S[];
        number: number;
        upsert: boolean;
    }>;
    /**
     * Count documents that meets the specified criteria
     */
    count(filter?: Filter<NFP<S>>): Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     *
     */
    delete(filter: Filter<NFP<S>>, multi?: boolean): Promise<{
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
    find: (filter?: Filter<NFP<S>>, { skip, limit, project, sort, }?: {
        skip?: number | undefined;
        limit?: number | undefined;
        sort?: import("./types/common").Partial<{ [key in { [K in keyof S]: S[K] extends Function ? never : K; }[keyof S]]: 1 | -1; } & {
            $deep: {
                [key: string]: 1 | -1;
            };
        }> | undefined;
        project?: import("./types/common").Partial<{ [key_1 in { [K in keyof S]: S[K] extends Function ? never : K; }[keyof S]]: 0 | 1; } & {
            $deep: {
                [key: string]: 0 | 1;
            };
        }> | undefined;
    }) => Promise<S[]>;
    /**
     * Count the documents matching the specified criteria
     */
    number: (filter?: Filter<NFP<S>>) => Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     */
    remove: (filter: Filter<NFP<S>>, multi?: boolean) => Promise<{
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
