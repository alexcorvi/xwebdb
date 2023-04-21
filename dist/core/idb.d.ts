export type UseStore = <T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>) => Promise<T>;
export declare class IDB<T> {
    private store;
    constructor(name: string);
    private pr;
    /**
     * Get a value by its key.
     * @param key
     */
    get(key: string): Promise<T | undefined>;
    /**
     * Set a value with a key.
     *
     * @param key
     * @param value
     */
    set(key: string, value: string): Promise<void>;
    /**
     * Set multiple values at once. This is faster than calling set() multiple times.
     * It's also atomic – if one of the pairs can't be added, none will be added.
     *
     * @param entries Array of entries, where each entry is an array of `[key, value]`.
     */
    sets(entries: [string, string][]): Promise<void>;
    /**
     * Get multiple values by their keys
     *
     * @param keys
     */
    gets(keys: string[]): Promise<T[]>;
    /**
     * Delete a particular key from the store.
     *
     * @param key
     */
    del(key: string): Promise<void>;
    /**
     * Delete multiple keys at once.
     *
     * @param keys List of keys to delete.
     */
    dels(keys: string[]): Promise<void>;
    /**
     * Clear all values in the store.
     *
     */
    clear(): Promise<void>;
    private eachCursor;
    /**
     * Get all keys in the store.
     *
     */
    keys(): Promise<string[]>;
    /**
     * Get all values in the store.
     */
    values(): Promise<T[]>;
    length(): Promise<number>;
}
