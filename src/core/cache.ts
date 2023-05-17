/**
 * Caching class
 * using a javascript Map, dHash of the query as a key, result (and usage counter) as value
 * call "get" to get from cache (would return undefined) if not found
 * call "storeOrProspect" on every query that hasn't been found in cache
 * call "evict" to validate specific query or all queries from this cache
 */

import { Doc, Filter } from "../types";
import { dHash } from "./customUtils";
export class Cache<S extends Doc> {
	cached: Map<number, S[]> = new Map();
	prospected: Record<number, number> = {};

	limit: number;

	constructor(limit: number = 1000) {
		this.limit = limit;
	}

	/**
	 * Generates a unique cache key for a given query.
	 * @param query The query object.
	 * @returns The cache key.
	 */
	toKey(query: Filter<S>): number {
		return dHash(JSON.stringify(query));
	}

	/**
	 * Retrieves the cached results for a given query.
	 * @param query The query object.
	 * @returns The cached results or undefined if not found.
	 */
	get(query: Filter<S>): S[] | undefined {
		let hashed = this.toKey(query);
		let cached = this.cached.get(hashed);
		if (cached) {
			this.prospected[hashed]++;
			return cached;
		} else return undefined;
	}

	/**
	 * Stores or prospects a query and its results in the cache.
	 * @param query The query object.
	 * @param res The results to be cached.
	 */
	storeOrProspect(query: Filter<S>, res: S[]): void {
		let newHashed = this.toKey(query);
		if (this.cached.has(newHashed)) {
			return;
		}
		if (this.prospected[newHashed]) {
			this.prospected[newHashed]++;
			this.cached.set(newHashed, res);
			if (this.cached.size > this.limit) {
				let leastUsed = { usage: Infinity, key: 0 };
				for (const key of this.cached.keys()) {
					// if it's just 2, then it has only prospected then added
					if (this.prospected[key] === 2 && key !== newHashed) {
						this.cached.delete(key);
						leastUsed.key = 0;
						break;
					} else if (this.prospected[key] < leastUsed.usage) {
						leastUsed.usage = this.prospected[key];
						leastUsed.key = key;
					}
				}
				if (leastUsed.key !== 0) this.cached.delete(leastUsed.key);
			}
		} else {
			this.prospected[newHashed] = 1;
		}
	}

	/**
	 * Evicts the cached results for a given query or clears the entire cache.
	 * @param query Optional query object to evict specific results.
	 */
	evict(query?: Filter<S>): void {
		if (query) {
			this.cached.delete(this.toKey(query));
		} else {
			this.cached.clear();
		}
	}
}
