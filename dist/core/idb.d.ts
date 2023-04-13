import { UseStore } from "idb-keyval";
export declare class IDB {
    store: UseStore;
    constructor(ref: string);
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
    gets(keys: string[]): Promise<string[]>;
    sets(entries: [string, string][]): Promise<void>;
    dels(keys: string[]): Promise<void>;
    keys(): Promise<IDBValidKey[]>;
    values(): Promise<string[]>;
    clear(): Promise<void>;
    length(): Promise<number>;
}
