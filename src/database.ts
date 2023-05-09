/**
 * Main user API to the database
 * exposing only strongly typed methods and relevant configurations
 */

import { Datastore, EnsureIndexOptions, observable as o, observable } from "./core";
import { remoteStore } from "./core/adapters/type";
import { modifiersKeys, toDotNotation } from "./core/model/";
import {
	NOP,
	Doc,
	Filter,
	SchemaKeyProjection,
	SchemaKeySort,
	UpdateOperators,
	UpsertOperators,
	NFP,
} from "./types"; // for some reason using @types will disable some type checks
let deepOperators = modifiersKeys as (keyof UpdateOperators<{}>)[];
export interface DatabaseConfigurations<C extends typeof Doc, D extends Doc> {
	ref: string;
	model?: C;
	encode?(line: string): string;
	decode?(line: string): string;
	corruptAlertThreshold?: number;
	timestampData?: boolean;
	sync?: {
		syncToRemote?: (name: string) => remoteStore;
		syncInterval?: number;
	};
	deferPersistence?: number;
	stripDefaults?: boolean;
	indexes?: NOP<D>[];
}

export class Database<S extends Doc> {
	private ref: string;
	private model: typeof Doc;
	/**
	 * set to "public" so we can allow some level of access to core methods and properties
	 */
	public _datastore: Datastore<S, typeof Doc>;
	/**
	 * Creating a database is creating a reference for it
	 * However, the database will be loading existing data in the background
	 * use this promise to ensure that the database has actually loaded all the preexisting data
	 */
	public loaded: Promise<boolean>;

	constructor(options: DatabaseConfigurations<typeof Doc, S>) {
		this.model = options.model || Doc;
		this.ref = options.ref;
		this._datastore = new Datastore({
			ref: this.ref,
			model: this.model,
			indexes: options.indexes as any,
			encode: options.encode,
			decode: options.decode,
			corruptAlertThreshold: options.corruptAlertThreshold,
			timestampData: options.timestampData,
			syncToRemote: options.sync ? options.sync.syncToRemote : undefined,
			syncInterval: options.sync ? options.sync.syncInterval : undefined,
			defer: options.deferPersistence,
			stripDefaults: options.stripDefaults || false,
		});
		this.loaded = this._datastore.loadDatabase();
	}

	/**
	 * insert documents
	 */
	public async insert(docs: S[] | S): Promise<{ docs: S[]; number: number }> {
		const res = await this._datastore.insert(docs);
		return res;
	}

	/**
	 * Get live queries (observable)
	 * can be bidirectionally live (to and from DB)
	 * or either from or to DB
	 */
	public async live(
		filter: Filter<S> = {},
		{
			skip = 0,
			limit = 0,
			project = {},
			sort = {},
			toDB = true,
			fromDB = true,
		}: {
			skip?: number;
			limit?: number;
			sort?: SchemaKeySort<S>;
			project?: SchemaKeyProjection<S>;
			toDB?: boolean;
			fromDB?: boolean;
		} = {}
	): Promise<
		o.ObservableArray<S[]> & {
			kill: (w?: "toDB" | "fromDB") => Promise<void>;
		}
	> {
		const res = await this.read(...arguments);
		const ob = o.observable(res);
		let toDBObserver: (changes: observable.Change<S[]>[]) => void = () => undefined;
		let fromDBuid = "";

		if (toDB) {
			toDBObserver = (changes: observable.Change<S[]>[]) => {
				let operations: { [key: string]: () => Promise<any> } = {};
				for (let i = 0; i < changes.length; i++) {
					const change = changes[i];
					if (
						change.path.length === 0 ||
						change.type === "shuffle" ||
						change.type === "reverse"
					) {
						continue;
					} else if (change.path.length === 1 && change.type === "update") {
						let doc = change.snapshot[change.path[0] as number];
						let _id = change.oldValue._id;
						operations[_id] = () =>
							this.update({ _id: _id } as any, {
								$set: doc as any,
							});
					} else if (change.path.length > 1 || change.type === "update") {
						// updating specific field in document
						let doc = change.snapshot[change.path[0] as number];
						let _id = doc._id;
						operations[_id] = () =>
							this.upsert({ _id: _id } as any, {
								$set: doc as any,
								$setOnInsert: doc,
							});
					} else if (change.type === "delete") {
						// deleting
						let doc = change.oldValue;
						let _id = doc._id;
						operations[_id] = () => this.delete({ _id } as any);
					} else if (change.type === "insert") {
						// inserting
						let doc = change.value;
						let _id = doc._id;
						operations[_id] = () => this.insert(doc);
					}
				}
				const results = Object.values(operations).map((operation) => operation());
				Promise.all(results).catch((e) => {
					this._datastore.live.update(); // reversing updates to observable
					console.error(
						`XWebDB: Reflecting observable changes to database couldn't complete due to an error:`,
						e
					);
				});
			};
			ob.observe(toDBObserver);
		}

		if (fromDB) {
			fromDBuid = this._datastore.live.addLive({
				query: filter,
				toDBObserver,
				observable: ob,
			});
		}

		return {
			...ob,
			kill: async (w) => {
				if (w === "toDB" || !w) {
					await ob.unobserve(toDBObserver);
				}
				if (w === "fromDB" || !w) {
					this._datastore.live.kill(fromDBuid);
				}
			},
		};
	}

	/**
	 * Find document(s) that meets a specified criteria
	 */
	public async read(
		filter: Filter<S> = {},
		{
			skip = 0,
			limit = 0,
			project = {},
			sort = {},
		}: {
			skip?: number;
			limit?: number;
			sort?: SchemaKeySort<S>;
			project?: SchemaKeyProjection<S>;
		} = {}
	): Promise<S[]> {
		filter = toDotNotation(filter);
		sort = toDotNotation(sort);
		project = toDotNotation(project);

		const cursor = this._datastore.cursor(filter);
		if (sort) {
			cursor.sort(sort as any);
		}
		if (skip) {
			cursor.skip(skip);
		}
		if (limit) {
			cursor.limit(limit);
		}
		if (project) {
			cursor.projection(project as any);
		}
		return await cursor.exec();
	}

	/**
	 * Update document(s) that meets the specified criteria
	 */
	public async update(
		filter: Filter<S>,
		update: UpdateOperators<S>,
		multi: boolean = false
	): Promise<{ docs: S[]; number: number }> {
		filter = toDotNotation(filter || {});
		for (let index = 0; index < deepOperators.length; index++) {
			const operator = deepOperators[index];
			if (update[operator]) {
				update[operator] = toDotNotation(update[operator]!) as any;
			}
		}
		const res = await this._datastore.update(filter, update, {
			multi,
			upsert: false,
		});
		return res;
	}

	/**
	 * Update document(s) that meets the specified criteria,
	 * and do an insertion if no documents are matched
	 */
	public async upsert(
		filter: Filter<S>,
		update: UpsertOperators<S>,
		multi: boolean = false
	): Promise<{ docs: S[]; number: number; upsert: boolean }> {
		filter = toDotNotation(filter || {});
		for (let index = 0; index < deepOperators.length; index++) {
			const operator = deepOperators[index];
			if (update[operator]) {
				update[operator] = toDotNotation(update[operator]!) as any;
			}
		}
		const res = await this._datastore.update(filter, update, {
			multi,
			upsert: true,
		});
		return res;
	}

	/**
	 * Count documents that meets the specified criteria
	 */
	public async count(filter: Filter<S> = {}): Promise<number> {
		filter = toDotNotation(filter || {});
		return await this._datastore.count(filter);
	}

	/**
	 * Delete document(s) that meets the specified criteria
	 *
	 */
	public async delete(
		filter: Filter<S>,
		multi: boolean = false
	): Promise<{ docs: S[]; number: number }> {
		filter = toDotNotation(filter || {});
		const res = await this._datastore.remove(filter, {
			multi: multi || false,
		});
		return res;
	}

	/**
	 * Create an index specified by options
	 */
	public async createIndex(
		options: EnsureIndexOptions & { fieldName: keyof NFP<S> }
	): Promise<{ affectedIndex: string }> {
		return await this._datastore.ensureIndex(options);
	}

	/**
	 * Remove an index by passing the field name that it is related to
	 */
	public async removeIndex(
		fieldName: string & keyof NFP<S>
	): Promise<{ affectedIndex: string }> {
		return await this._datastore.removeIndex(fieldName);
	}

	/**
	 * Reload database from the persistence layer (if it exists)
	 */
	async reload(): Promise<{}> {
		await this._datastore.persistence.loadDatabase();
		return {};
	}

	/**
	 * Synchronies the database with remote source using the remote adapter
	 */
	async sync() {
		if (!this._datastore.persistence.sync) {
			throw new Error(
				"XWebDB: Can not perform sync operation unless provided with remote DB adapter"
			);
		}
		return await this._datastore.persistence.sync.sync();
	}

	/**
	 * Forcefully sync the database with remote source using the remote adapter
	 * bypassing: 	A. a check to see whether other sync action is in progress
	 * 				B. a check to see whether there are deferred writes/deletes
	 * 				C. a check to see whether local DB and remote source have same $H
	 * Use this with caution, and only if you know what you're doing
	 */
	async forceSync() {
		if (!this._datastore.persistence.sync) {
			throw new Error(
				"XWebDB: Can not perform sync operation unless provided with remote DB adapter"
			);
		}
		return await this._datastore.persistence.sync._sync(true);
	}

	/**
	 * true: there's a sync in progress
	 * false: there's no sync in progress
	 */
	get syncInProgress() {
		return this._datastore.persistence.syncInProgress;
	}

	/**
	 * Create document
	 */
	create = this.insert;
	/**
	 * Find documents that meets a specified criteria
	 */
	find = this.read;

	/**
	 * Count the documents matching the specified criteria
	 */
	number = this.count;

	/**
	 * Delete document(s) that meets the specified criteria
	 */
	remove = this.delete;

	/**
	 * Create an index specified by options
	 */
	ensureIndex = this.createIndex;
}
