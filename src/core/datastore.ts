import { Cursor } from "./cursor";
import * as customUtils from "./customUtils";
import { Index } from "./indexes";
import * as model from "./model/";
import { Persistence } from "./persistence";
import * as types from "../types";
import { Doc } from "../types/base-schema";
import { Q } from "./q";
import { remoteStore } from "./adapters/type";
import { Live } from "./live";

type MongoDBQuery = Record<string, any>;

export interface EnsureIndexOptions {
	fieldName: string;
	unique?: boolean;
	sparse?: boolean;
}

export interface DataStoreOptions<G extends typeof Doc> {
	ref: string;
	encode?(line: string): string;
	decode?(line: string): string;
	corruptAlertThreshold?: number;
	timestampData?: boolean;
	syncToRemote?: (name: string) => remoteStore;
	syncInterval?: number;
	model?: G;
	defer?: number;
	stripDefaults?: boolean;
	indexes?: string[];
}

interface UpdateOptions {
	multi?: boolean;
	upsert?: boolean;
}

export class Datastore<G extends types.Doc & { [key: string]: any }, C extends typeof Doc> {
	ref: string = "db";
	timestampData = false;
	persistence: Persistence<G, C>;
	live: Live = new Live(this);
	// rename to something denotes that it's an internal thing
	q: Q = new Q(1);
	indexes: { [key: string]: Index<G[keyof G], G> } = {
		_id: new Index({ fieldName: "_id", unique: true }),
	};
	initIndexes: string[] = [];
	model: C;
	defer: boolean = false;
	deferredWrites: G[] = [];
	deferredDeletes: string[] = [];

	constructor(options: DataStoreOptions<C>) {
		this.model = options.model || (Doc as any);
		if (options.ref) {
			this.ref = options.ref;
		}

		// Persistence handling
		this.persistence = new Persistence({
			db: this,
			model: options.model,
			encode: options.encode,
			decode: options.decode,
			corruptAlertThreshold: options.corruptAlertThreshold || 0,
			syncToRemote: options.syncToRemote,
			syncInterval: options.syncInterval,
			stripDefaults: options.stripDefaults,
		});
		this.initIndexes = options.indexes || [];
		this.timestampData = !!options.timestampData;
		if (typeof options.defer === "number" && !isNaN(options.defer)) {
			this.defer = true;
			setInterval(async () => {
				if (this.persistence.syncInProgress)
					return; // should not process deferred while sync in progress
				else this._processDeferred();
			}, options.defer);
		}
	}

	private async _processDeferred() {
		if (this.deferredDeletes.length) {
			try {
				const done = await this.persistence.deleteData(this.deferredDeletes);
				this.deferredDeletes = this.deferredDeletes.filter(
					(_id) => done.indexOf(_id) === -1
				);
			} catch (e) {
				console.error("XWebDB: processing deferred deletes error", e);
				await this.loadDatabase();
			}
		}
		if (this.deferredWrites.length) {
			try {
				const done = await this.persistence.writeNewData(this.deferredWrites);
				this.deferredWrites = this.deferredWrites.filter(
					(doc) => done.indexOf(doc._id || "") === -1
				);
			} catch (e) {
				console.error("XWebDB: processing deferred writes error", e);
				await this.loadDatabase();
			}
		}
	}

	/**
	 * Load the database from indexedDB, and trigger the execution of buffered commands if any
	 */
	public async loadDatabase() {
		const loaded = await this.persistence.loadDatabase();
		for (let index = 0; index < this.initIndexes.length; index++) {
			const fieldName = this.initIndexes[index];
			if (!this.indexes[fieldName]) {
				await this.ensureIndex({ fieldName });
			}
		}
		return loaded;
	}

	/**
	 * Get an array of all the data in the database
	 */
	public getAllData() {
		return this.indexes._id.dict.all;
	}

	/**
	 * Reset all currently defined indexes
	 */
	public resetIndexes(alsoDelete: boolean = false) {
		Object.keys(this.indexes).forEach((i) => {
			if (alsoDelete && i !== "_id") return delete this.indexes[i];
			this.indexes[i].reset();
		});
	}

	/**
	 * Ensure an index is kept for this field. Same parameters as lib/indexes
	 * For now this function is synchronous, we need to test how much time it takes
	 * We use an async API for consistency with the rest of the code
	 */
	public async ensureIndex(options: EnsureIndexOptions): Promise<{ affectedIndex: string }> {
		options = options || {};

		if (!options.fieldName) {
			let err: any = new Error("XWebDB: Cannot create an index without a fieldName");
			err.missingFieldName = true;
			throw err;
		}
		if (this.indexes[options.fieldName]) {
			return { affectedIndex: options.fieldName };
		}

		this.indexes[options.fieldName] = new Index(options);

		// Index data
		try {
			this.indexes[options.fieldName].insert(this.getAllData());
		} catch (e) {
			delete this.indexes[options.fieldName];
			throw e;
		}

		// We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
		await this.persistence.writeNewIndex([{ $$indexCreated: options }]);
		return {
			affectedIndex: options.fieldName,
		};
	}

	/**
	 * Remove an index
	 */
	public async removeIndex(fieldName: string): Promise<{ affectedIndex: string }> {
		delete this.indexes[fieldName];
		await this.persistence.deleteData([fieldName]);
		return {
			affectedIndex: fieldName,
		};
	}

	/**
	 * Add one or several document(s) to all indexes
	 */
	public addToIndexes<T extends G>(doc: T | T[]) {
		let failingIndex = -1;
		let error;
		const keys = Object.keys(this.indexes);
		for (let i = 0; i < keys.length; i++) {
			try {
				this.indexes[keys[i]].insert(doc);
			} catch (e) {
				failingIndex = i;
				error = e;
				break;
			}
		}

		// If an error happened, we need to rollback the insert on all other indexes
		if (error) {
			for (let i = 0; i < failingIndex; i++) {
				this.indexes[keys[i]].remove(doc);
			}

			throw error;
		}
	}

	/**
	 * Remove one or several document(s) from all indexes
	 */

	public removeFromIndexes<T extends G>(doc: T | T[]) {
		Object.keys(this.indexes).forEach((i) => {
			this.indexes[i].remove(doc);
		});
	}

	/**
	 * Update one or several documents in all indexes
	 * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
	 * If one update violates a constraint, all changes are rolled back
	 */
	private updateIndexes<T extends G>(oldDoc: T, newDoc: T): void;
	private updateIndexes<T extends G>(updates: Array<{ oldDoc: T; newDoc: T }>): void;
	private updateIndexes<T extends G>(
		oldDoc: T | Array<{ oldDoc: T; newDoc: T }>,
		newDoc?: T
	) {
		let failingIndex = -1;
		let error;
		const keys = Object.keys(this.indexes);
		for (let i = 0; i < keys.length; i++) {
			try {
				this.indexes[keys[i]].update(oldDoc, newDoc);
			} catch (e) {
				failingIndex = i;
				error = e;
				break;
			}
		}

		// If an error happened, we need to rollback the update on all other indexes
		if (error) {
			for (let i = 0; i < failingIndex; i++) {
				this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
			}

			throw error;
		}
	}

	private _isBasicType(value: any) {
		return (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			value instanceof Date ||
			value === null
		);
	}

	fromDict(query: MongoDBQuery) {
		let qClone: MongoDBQuery = JSON.parse(JSON.stringify(query));
		let entries = Object.entries(qClone);
		if (entries.length && entries[0][0][0] !== "$") qClone = { $noTL: [qClone] };
		for (let [topLevel, arr] of Object.entries(qClone)) {
			if (topLevel !== "$noTL" && topLevel !== "$and") continue;
			for (let index = 0; index < arr.length; index++) {
				const segment = arr[index];
				for (let [field, v] of Object.entries(segment) as any) {
					let index = this.indexes[field];
					if (!index) continue;
					if (!v || Object.keys(v).length === 0 || Object.keys(v)[0][0] !== "$")
						v = { $eq: v };
					let entries: [string, MongoDBQuery][] = Object.entries(v!);
					for (let [o, c] of entries) {
						if (
							o === "$not" &&
							c !== null &&
							typeof c == "object" &&
							Object.keys(c)
						) {
							// negate and put outside $not
							if (c["$eq"]) (o = "$ne") && (c = c["$eq"]);
							if (c["$ne"]) (o = "$eq") && (c = c["$ne"]);
							if (c["$in"]) (o = "$nin") && (c = c["$in"]);
							if (c["$nin"]) (o = "$in") && (c = c["$nin"]);
							if (c["$gt"]) (o = "$lte") && (c = c["$gt"]) && (v["$lte"] = c);
							if (c["$lte"]) (o = "$gt") && (c = c["$lte"]) && (v["$gt"] = c);
							if (c["$lt"]) (o = "$gte") && (c = c["$lt"]) && (v["$gte"] = c);
							if (c["$gte"]) (o = "$lt") && (c = c["$gte"]) && (v["$lt"] = c);
						}
						// use dict functions
						if (o === "$eq") return index.dict.get(c as any);
						if (o === "$in") return index.dict.$in(c as any);
						if (v["$gt"] || v["$lt"] || v["$gte"] || v["lte"]) {
							// if there are bounding matchers skip $ne & $nin
							// since bounded matchers should technically be less & faster
							continue;
						}
						if (o === "$ne") return index.dict.$ne(c as any);
						if (o === "$nin") return index.dict.$nin(c as any);
					}
					if (v["$gt"] || v["$lt"] || v["$gte"] || v["lte"]) {
						return index.dict.betweenBounds(
							v["$gt"] || v["$gte"],
							!!v["$gte"],
							v["$lt"] || v["$lte"],
							!!v["$lte"]
						);
					}
				}
			}
		}
		return null;
	}

	/**
	 * Return the list of candidates for a given query
	 * Crude implementation for now, we return the candidates given by the first usable index if any
	 * We try the following query types, in this order: basic match, $in match, comparison match
	 * One way to make it better would be to enable the use of multiple indexes if the first usable index
	 * returns too much data. I may do it in the future.
	 *
	 * Returned candidates will be scanned to find and remove all expired documents
	 */
	getCandidates(query: MongoDBQuery): G[] {
		return this.fromDict(query) || this.getAllData();
	}

	/**
	 * Insert a new document
	 */
	public async insert(newDoc: G | G[]): Promise<types.Result<G>> {
		// unify input to array
		let w = Array.isArray(newDoc) ? newDoc : [newDoc];
		/**
		 * Clone all documents, add _id, add timestamps and validate
		 * then add to indexes
		 * if an error occurred rollback everything
		*/
		let cloned: G[] = [];
		let failingI = -1;
		let error;
		for (let index = 0; index < w.length; index++) {
			cloned[index] = model.clone(w[index], this.model);
			if (cloned[index]._id === undefined) {
				cloned[index]._id = this.createNewId();
			}
			if( this.timestampData) {
				let now = new Date();
				if (cloned[index].createdAt === undefined) {
					cloned[index].createdAt = now;
				}
				if (cloned[index].updatedAt === undefined) {
					cloned[index].updatedAt = now;
				}
			}
			model.validateObject(cloned[index]);
			try {
				this.addToIndexes(cloned[index]);
			} catch (e) {
				error = e;
				failingI = index;
				break;
			}
		}
		if (error) {
			for (let i = 0; i < failingI; i++) {
				this.removeFromIndexes(cloned[i]);
			}
			throw error;
		}
		try {
			this.live.update();
		} catch (e) {
			console.error(`XWebDB: Could not do live updates due to an error:`, e);
		}
		if (this.defer) this.deferredWrites.push(...cloned);
		else await this.persistence.writeNewData(cloned);
		return {
			docs: model.clone(cloned, this.model),
			number: cloned.length,
		};
	}

	/**
	 * Create a new _id that's not already in use
	 */
	private createNewId() {
		let newID = customUtils.uid();
		if (this.indexes._id.dict.has(newID as any)) {
			newID = this.createNewId();
		}
		return newID;
	}

	/**
	 * Count all documents matching the query
	 */
	public async count(query: any): Promise<number> {
		const cursor = new Cursor(this, query);
		return (await cursor.exec()).length;
	}

	/**
	 * Find all documents matching the query
	 */
	public async find(query: any): Promise<G[]> {
		const cursor = new Cursor<G, C>(this, query);
		const docs = await cursor.exec();
		return docs;
	}

	/**
	 * Find all documents matching the query
	 */
	public cursor(query: any): Cursor<G, C> {
		const cursor = new Cursor<G, C>(this, query);
		return cursor;
	}

	/**
	 * Update all docs matching query
	 */
	private async _update(
		query: any,
		updateQuery: any,
		options: UpdateOptions
	): Promise<types.Result<G> & { upsert: boolean }> {
		let multi = options.multi !== undefined ? options.multi : false;
		let upsert = options.upsert !== undefined ? options.upsert : false;

		const cursor = new Cursor(this, query);
		cursor.limit(1);
		const res = cursor.__exec_unsafe();
		if (res.length > 0) {
			let numReplaced = 0;
			const candidates = this.getCandidates(query);
			const modifications = [];

			// Preparing update (if an error is thrown here neither the datafile nor
			// the in-memory indexes are affected)
			for (let i = 0; i < candidates.length; i++) {
				if ((multi || numReplaced === 0) && model.match(candidates[i], query)) {
					numReplaced++;
					let createdAt = candidates[i].createdAt;
					let modifiedDoc = model.modify<G, C>(
						candidates[i],
						updateQuery,
						this.model
					);
					if (createdAt) {
						modifiedDoc.createdAt = createdAt as any;
					}
					if (
						this.timestampData &&
						updateQuery.updatedAt === undefined &&
						(!updateQuery.$set || updateQuery.$set.updatedAt === undefined)
					) {
						modifiedDoc.updatedAt = new Date();
					}
					modifications.push({
						oldDoc: candidates[i],
						newDoc: modifiedDoc,
					});
				}
			}

			// Change the docs in memory
			this.updateIndexes(modifications);
			try {
				this.live.update();
			} catch (e) {
				console.error(`XWebDB: Could not do live updates due to an error:`, e);
			}
			// Update indexedDB
			const updatedDocs = modifications.map((x) => x.newDoc);
			if (this.defer) this.deferredWrites.push(...updatedDocs);
			else await this.persistence.writeNewData(updatedDocs);
			return {
				number: updatedDocs.length,
				docs: updatedDocs.map((x) => model.clone(x, this.model)),
				upsert: false,
			};
		} else if (res.length === 0 && upsert) {
			if (!updateQuery.$setOnInsert) {
				throw new Error("XWebDB: $setOnInsert modifier is required when upserting");
			}
			let toBeInserted = model.clone(updateQuery.$setOnInsert, this.model, true);
			const newDoc = await this.insert(toBeInserted);
			return { ...newDoc, upsert: true };
		} else {
			return {
				number: 0,
				docs: [],
				upsert: false,
			};
		}
	}

	async update(
		query: any,
		updateQuery: any,
		options: UpdateOptions
	): Promise<types.Result<G> & { upsert: boolean }> {
		return await this.q.add(() => this._update(query, updateQuery, options));
	}

	/**
	 * Remove all docs matching the query
	 * For now very naive implementation (similar to update)
	 */
	private async _remove(query: any, options?: { multi: boolean }): Promise<types.Result<G>> {
		let numRemoved = 0;
		const removedDocs: { $$deleted: true; _id?: string }[] = [];
		const removedFullDoc: G[] = [];
		let multi = options ? !!options.multi : false;
		const candidates = this.getCandidates(query);
		candidates.forEach((d) => {
			if (model.match(d, query) && (multi || numRemoved === 0)) {
				numRemoved++;
				removedFullDoc.push(model.clone(d, this.model));
				removedDocs.push({ $$deleted: true, _id: d._id });
				this.removeFromIndexes(d);
			}
		});
		try {
			this.live.update();
		} catch (e) {
			console.error(`XWebDB: Could not do live updates due to an error:`, e);
		}
		let d = removedDocs.map((x) => x._id || "");
		if (this.defer) this.deferredDeletes.push(...d);
		else await this.persistence.deleteData(d);
		return {
			number: numRemoved,
			docs: removedFullDoc,
		};
	}

	public async remove(query: any, options?: { multi: boolean }): Promise<types.Result<G>> {
		return this.q.add(() => this._remove(query, options));
	}
}
