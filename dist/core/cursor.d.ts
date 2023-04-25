import { Datastore } from "./datastore";
import { Doc, SchemaKeyProjection, SchemaKeySort } from "../types";
/**
 * Create a new cursor for this collection
 */
export declare class Cursor<G extends Doc, C extends typeof Doc> {
    private db;
    private query;
    private _limit;
    private _skip;
    private _sort;
    private _projection;
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
    projection(projection: SchemaKeyProjection<G>): this;
    /**
     * Apply the projection
     */
    private _project;
    /**
     * Get all matching elements
     * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
     *
     */
    __exec_unsafe(): Promise<G[]>;
    private _exec;
    exec(): Promise<G[]>;
}
