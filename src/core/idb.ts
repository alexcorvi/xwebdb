/**
 * Promise-base interface for interacting with indexedDB
 * This is where actual operations to IndexedDB occurs
 */

import { Doc } from "../types";
import { EnsureIndexOptions } from "./datastore";

export type Line = Partial<Doc & { $$indexCreated?: EnsureIndexOptions }> & Record<string, any>;

export type UseStore = <T>(
	txMode: IDBTransactionMode,
	callback: (store: IDBObjectStore) => T | PromiseLike<T>
) => Promise<T>;

export class IDB {
	private store: UseStore;

	constructor(name: string) {
		const request = indexedDB.open(name);
		request.onupgradeneeded = function () {
			this.result.createObjectStore(name).createIndex("idIndex", "_id", { unique: true });
		};
		const dbp = this.pr(request);
		this.store = (txMode, callback) =>
			dbp.then((db) =>
				callback(
					db.transaction(name, txMode, { durability: "relaxed" }).objectStore(name)
				)
			);
	}

	/**
	 * Converts IDB requests/transactions to promises.
	 */
	private pr<T>(req: IDBRequest<T> | IDBTransaction): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			// @ts-ignore - file size hacks
			req.oncomplete = req.onsuccess = () => resolve(req.result);
			// @ts-ignore - file size hacks
			req.onabort = req.onerror = () => reject(req.error);
		});
	}

	/**
	 * Converts cursor iterations to promises
	 */
	private eachCursor(
		store: IDBObjectStore,
		callback: (cursor: IDBCursorWithValue) => void
	): Promise<void> {
		store.openCursor().onsuccess = function () {
			if (!this.result) return;
			callback(this.result);
			this.result.continue();
		};
		return this.pr(store.transaction);
	}

	/**
	 * Get a value by its key.
	 */
	get(key: string): Promise<Line | undefined> {
		return this.store("readonly", (store) => this.pr(store.get(key)));
	}

	/**
	 * Get values for a given set of keys
	*/
	async getBulk(keys: string[]): Promise<(Line | undefined)[]> {
		return this.store("readonly", async (store) => {
			return Promise.all(keys.map((x) => this.pr(store.get(x))));
		});
	}

	/**
	 * Set a value with a key.
	 */
	set(key: string, value: Line): Promise<void> {
		return this.store("readwrite", (store) => {
			store.put(value, key);
			return this.pr(store.transaction);
		});
	}

	/**
	 * Set multiple values at once. This is faster than calling set() multiple times.
	 * It's also atomic – if one of the pairs can't be added, none will be added.
	 */
	setBulk(entries: [string, Line][]): Promise<void> {
		return this.store("readwrite", (store) => {
			entries.forEach((entry) => store.put(entry[1], entry[0]));
			return this.pr(store.transaction);
		});
	}

	/**
	 * Delete multiple keys at once.
	 *
	 */
	delBulk(keys: string[]): Promise<void> {
		return this.store("readwrite", (store: IDBObjectStore) => {
			keys.forEach((key: string) => store.delete(key));
			return this.pr(store.transaction);
		});
	}

	/**
	 * Clear all values in the store.
	 *
	 */
	clear(): Promise<void> {
		return this.store("readwrite", (store) => {
			store.clear();
			return this.pr(store.transaction);
		});
	}

	/**
	 * Get all keys in the store.
	 */
	keys(): Promise<string[]> {
		return this.store("readonly", async (store) => {
			// Fast path for modern browsers
			if (store.getAllKeys) {
				return this.pr(store.getAllKeys() as IDBRequest<string[]>);
			}

			const items: string[] = [];

			await this.eachCursor(store, (cursor) => items.push(cursor.key as string));
			return items;
		});
	}

	/**
	 * Get all values in the store.
	 */
	values(): Promise<Line[]> {
		return this.store("readonly", async (store) => {
			// Fast path for modern browsers
			if (store.getAll) {
				return this.pr(store.getAll() as IDBRequest<Line[]>);
			}

			const items: Line[] = [];

			await this.eachCursor(store, (cursor) => items.push(cursor.value as Line));
			return items;
		});
	}

	/**
	 * Get key by ID (since keys are ID_REV)
	 */
	async byID(_id: string) {
		return this.store("readonly", (store) => {
			return this.pr(store.index("idIndex").getKey(_id));
		});
	}

	/**
	 * Get length of the DB
	 */
	async length() {
		return (await this.keys()).length;
	}
}
