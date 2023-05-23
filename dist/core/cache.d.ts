/**
 * Caching class
 * using a javascript Map, dHash of the query as a key, result (and usage counter) as value
 * call "get" to get from cache (would return undefined) if not found
 * call "storeOrProspect" on every query that hasn't been found in cache
 * call "evict" to validate specific query or all queries from this cache
 */
import { Doc, Filter } from "../types";
export declare class Cache<S extends Doc> {
    cached: Map<number, S[]>;
    prospected: Record<number, number>;
    limit: number;
    constructor(limit?: number);
    /**
     * Generates a unique cache key for a given query.
     * @param query The query object.
     * @returns The cache key.
     */
    toKey(query: Filter<S>): number;
    /**
     * Retrieves the cached results for a given query.
     * @param query The query object.
     * @returns The cached results or undefined if not found.
     */
    get(query: Filter<S>): S[] | undefined;
    /**
     * Stores or prospects a query and its results in the cache.
     * @param query The query object.
     * @param res The results to be cached.
     */
    storeOrProspect(query: Filter<S>, res: S[]): void;
    /**
     * Evicts the cached results for a given query or clears the entire cache.
     * @param query Optional query object to evict specific results.
     */
    evict(query?: Filter<S>): void;
}
