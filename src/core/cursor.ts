/**
 * Cursor class is responsible for querying documents
 * as well as sorting, skipping, limiting, and projections
 */

import { Datastore } from "./datastore";
import * as model from "./model/";
import { Doc, SchemaKeyProjection, SchemaKeySort } from "../types";
export class Cursor<G extends Doc, C extends typeof Doc> {
	private db: Datastore<G, C>;
	private _query: { [key: string]: any };
	private _limit: number | undefined;
	private _skip: number | undefined;
	private _sort: undefined | SchemaKeySort<G>;
	private _proj: undefined | SchemaKeyProjection<G>;

	constructor(db: Datastore<G, C>, query?: any) {
		this.db = db;
		this._query = query || {};
	}

	/**
	 * Set a limit to the number of results
	 */
	limit(limit: number) {
		this._limit = limit;
		return this;
	}

	/**
	 * Skip a the number of results
	 */
	skip(skip: number) {
		this._skip = skip;
		return this;
	}

	/**
	 * Sort results of the query
	 */
	sort(sortQuery: SchemaKeySort<G>) {
		this._sort = sortQuery;
		return this;
	}

	/**
	 * Add the use of a projection
	 */
	project(projection: SchemaKeyProjection<G>) {
		this._proj = projection;
		return this;
	}

	/**
	 * Apply the projection
	 */
	private _doProject(documents: G[]): G[] {
		if (this._proj === undefined || Object.keys(this._proj).length === 0) return documents;
		return model.project(documents, this._proj, this.db.model);
	}

	/**
	 * Apply sorting
	 */
	private _doSort(documents: G[]) {
		if (this._sort === undefined || Object.keys(this._sort).length === 0) return documents;
		return model.sort(documents, this._sort);
	}

	/**
	 * Executes the query
	 * Will return pointers to matched elements (shallow copies)
	 * hence its called "unsafe"
	 */
	__exec_unsafe() {
		let res: G[] = [];
		// try cached
		let cached = this.db.cache.get(this._query);
		if (!cached) {
			// no cached: match candidates
			const candidates = this.db.getCandidates(this._query);
			for (let i = 0; i < candidates.length; i++) {
				if (model.match(candidates[i], this._query)) {
					res.push(candidates[i]);
				}
			}
			// store in cache
			this.db.cache.storeOrProspect(this._query, res);
		}
		// cached found: use it
		else res = cached;

		// Apply all sorts
		if (this._sort) {
			res = this._doSort(res);
		}

		// Applying limit and skip
		if (this._limit || this._skip) {
			const limit = this._limit || res.length;
			const skip = this._skip || 0;
			res = res.slice(skip, skip + limit);
		}

		// Apply projection
		if (this._proj) {
			res = this._doProject(res);
		}

		return res;
	}

	/**
	 * Executes the query safely (i.e. cloning documents)
	 */
	exec() {
		const originalsArr = this.__exec_unsafe();
		const res: G[] = [];
		for (let index = 0; index < originalsArr.length; index++) {
			res.push(model.clone(originalsArr[index], this.db.model));
		}
		return res;
	}
}
