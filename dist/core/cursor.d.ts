/**
 * Cursor class is responsible for querying documents
 * as well as sorting, skipping, limiting, and projections
 */
import { Datastore } from "./datastore";
import { Doc, SchemaKeyProjection, SchemaKeySort } from "../types";
export declare class Cursor<G extends Doc, C extends typeof Doc> {
    private db;
    private _query;
    private _limit;
    private _skip;
    private _sort;
    private _proj;
    constructor(db: Datastore<G, C>, query?: any);
    /**
     * Set a limit to the number of results
     */
    limit(limit: number): this;
    /**
     * Skip a the number of results
     */
    skip(skip: number): this;
    /**
     * Sort results of the query
     */
    sort(sortQuery: SchemaKeySort<G>): this;
    /**
     * Add the use of a projection
     */
    project(projection: SchemaKeyProjection<G>): this;
    /**
     * Apply the projection
     */
    private _doProject;
    /**
     * Apply sorting
     */
    private _doSort;
    /**
     * Executes the query
     * Will return pointers to matched elements (shallow copies)
     * hence its called "unsafe"
     */
    __exec_unsafe(): G[];
    /**
     * Executes the query safely (i.e. cloning documents)
     */
    exec(): G[];
}
