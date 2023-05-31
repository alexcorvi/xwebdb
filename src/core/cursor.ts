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
	private _projection: undefined | SchemaKeyProjection<G>;

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
	projection(projection: SchemaKeyProjection<G>) {
		this._projection = projection;
		return this;
	}

	/**
	 * Apply the projection
	 */
	private _doProject(documents: G[]): G[] {
		// no projection criteria defined: return same
		if (this._projection === undefined || Object.keys(this._projection).length === 0)
			return documents;

		let res: G[] = [];
		// exclude _id from consistency checking
		let keepId = this._projection._id !== 0;
		delete this._projection._id;

		let keys = Object.keys(this._projection);

		// Check for consistency
		// either all are 0, or all are -1
		let actions: number[] = keys.map((k) => (this._projection as any)[k]).sort();
		if (actions[0] !== actions[actions.length - 1]) {
			throw new Error("XWebDB: Can't both keep and omit fields except for _id");
		}

		// Do the actual projection
		for (let index = 0; index < documents.length; index++) {
			const doc = documents[index];
			let toPush: Record<string, any> = {};
			if (actions[0] === 1) {
				// pick-type projection
				toPush = { $set: {} };
				for (let index = 0; index < keys.length; index++) {
					const key = keys[index];
					toPush.$set[key] = model.fromDotNotation(doc, key);
					if (toPush.$set[key] === undefined) {
						delete toPush.$set[key];
					}
				}
				toPush = model.modify({} as any, toPush, this.db.model);
			} else {
				// omit-type projection
				toPush = { $unset: {} };
				keys.forEach((k) => (toPush.$unset[k] = true));
				toPush = model.modify(doc, toPush, this.db.model);
			}

			if (keepId) {
				// by default will keep _id
				toPush._id = doc._id;
			} else {
				// unless defined otherwise
				delete toPush._id;
			}
			res.push(toPush as any);
		}

		return res;
	}

	/**
	 * Apply sorting
	 */
	private _doSort(documents: G[]) {
		return documents.sort((a, b) => {
			// for each sorting criteria
			// if it's either -1 or 1 return it
			// if it's neither try the next one
			for (const [key, direction] of Object.entries(this._sort || {})) {
				let compare =
					direction *
					model.compare(model.fromDotNotation(a, key), model.fromDotNotation(b, key));
				if (compare !== 0) {
					return compare;
				}
			}
			// no difference found in any criteria
			return 0;
		});
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
		if (this._projection) {
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