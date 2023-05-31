/**
 * Promise-base interface for interacting with indexedDB
 * This is where actual operations to IndexedDB occurs
 */
import { Doc } from "../types";
import { EnsureIndexOptions } from "./datastore";
export type Line = Partial<Doc & {
    $$indexCreated?: EnsureIndexOptions;
}> & Record<string, any>;
interface PersistenceLayer {
    get(key: string): Promise<Line | undefined>;
    getBulk(keys: string[]): Promise<(Line | undefined)[]>;
    set(key: string, value: Line): Promise<void>;
    setBulk(entries: [string, Line][]): Promise<void>;
    delBulk(keys: string[]): Promise<void>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
    documents(): Promise<Line[]>;
    byID(_id: string): Promise<IDBValidKey | undefined>;
}
export type UseStore = <T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>) => Promise<T>;
export declare class IDB implements PersistenceLayer {
    private store;
    constructor(name: string);
    /**
     * Converts IDB requests/transactions to promises.
     */
    private pr;
    /**
     * Converts cursor iterations to promises
     */
    private eachCursor;
    /**
     * Get a value by its key.
     */
    get(key: string): Promise<Line | undefined>;
    /**
     * Get values for a given set of keys
    */
    getBulk(keys: string[]): Promise<(Line | undefined)[]>;
    /**
     * Set a value with a key.
     */
    set(key: string, value: Line): Promise<void>;
    /**
     * Set multiple values at once. This is faster than calling set() multiple times.
     * It's also atomic – if one of the pairs can't be added, none will be added.
     */
    setBulk(entries: [string, Line][]): Promise<void>;
    /**
     * Delete multiple keys at once.
     *
     */
    delBulk(keys: string[]): Promise<void>;
    /**
     * Clear all values in the store.
     *
     */
    clear(): Promise<void>;
    /**
     * Get all keys in the store.
     */
    keys(): Promise<string[]>;
    /**
     * Get all documents in the store.
     */
    documents(): Promise<Line[]>;
    /**
     * Get key by ID (since keys are ID_REV)
     */
    byID(_id: string): Promise<IDBValidKey | undefined>;
    /**
     * Get length of the DB
     */
    length(): Promise<number>;
}
export {};
