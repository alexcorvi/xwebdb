/**
 * Promise-base interface for interacting with indexedDB
 */

export type UseStore = <T>(
	txMode: IDBTransactionMode,
	callback: (store: IDBObjectStore) => T | PromiseLike<T>
) => Promise<T>;

export class IDB<T> {
	private store: UseStore;

	constructor(name: string) {
		const request = indexedDB.open(name);
		request.onupgradeneeded = () => request.result.createObjectStore(name);
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
	get(key: string): Promise<T | undefined> {
		return this.store("readonly", (store) => this.pr(store.get(key)));
	}

	/**
	 * Set a value with a key.
	 */
	set(key: string, value: string): Promise<void> {
		return this.store("readwrite", (store) => {
			store.put(value, key);
			return this.pr(store.transaction);
		});
	}

	/**
	 * Set multiple values at once. This is faster than calling set() multiple times.
	 * It's also atomic – if one of the pairs can't be added, none will be added.
	 */
	sets(entries: [string, string][]): Promise<void> {
		return this.store("readwrite", (store) => {
			entries.forEach((entry) => store.put(entry[1], entry[0]));
			return this.pr(store.transaction);
		});
	}

	/**
	 * Delete multiple keys at once.
	 *
	 */
	dels(keys: string[]): Promise<void> {
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
	values(): Promise<T[]> {
		return this.store("readonly", async (store) => {
			// Fast path for modern browsers
			if (store.getAll) {
				return this.pr(store.getAll() as IDBRequest<T[]>);
			}

			const items: T[] = [];

			await this.eachCursor(store, (cursor) => items.push(cursor.value as T));
			return items;
		});
	}

	/**
	 * Gets 1 key that starts with a specific index
	*/
	async startsWith(prefix: string) {
		return this.store("readonly", async (store) => {
			return await this.pr(
				store.getKey(IDBKeyRange.bound(prefix, prefix + "\uffff", false, true))
			);
		});
	}

	/**
	 * Get length of the DB
	*/
	async length() {
		return (await this.keys()).length;
	}
}
