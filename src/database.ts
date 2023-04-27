import {
	Datastore,
	EnsureIndexOptions,
	observable as o,
	observable,
} from "./core";
import { remoteStore } from "./core/adapters/type";
import { addLive, kill, liveUpdate } from "./core/live";
import { lastStepModifierFunctions } from "./core/model";
import {
	Doc,
	Filter,
	SchemaKeyProjection,
	SchemaKeySort,
	UpdateOperators,
	UpsertOperators,
	NFP,
} from "./types"; // for some reason using @types will disable some type checks

let deepOperators = Object.keys(lastStepModifierFunctions) as (keyof UpdateOperators<{}>)[];

export interface DatabaseConfigurations<C extends typeof Doc> {
	ref: string;
	model?: C;
	encode?(line: string): string;
	decode?(line: string): string;
	corruptAlertThreshold?: number;
	timestampData?: boolean;
	reloadBeforeOperations?: boolean;
	sync?: {
		syncToRemote?: (name: string) => remoteStore;
		syncInterval?: number;
		devalidateHash?: number;
	};
	deferPersistence?: number;
	stripDefaults?: boolean;
}

export class Database<S extends Doc> {
	private ref: string;
	private reloadBeforeOperations: boolean = false;
	private model: typeof Doc;
	public _datastore: Datastore<S, typeof Doc>;
	public loaded: Promise<boolean>;

	constructor(options: DatabaseConfigurations<typeof Doc>) {
		this.model = options.model || Doc;
		this.ref = options.ref;
		this.reloadBeforeOperations = !!options.reloadBeforeOperations;
		this._datastore = new Datastore({
			ref: this.ref,
			model: this.model,
			encode: options.encode,
			decode: options.decode,
			corruptAlertThreshold: options.corruptAlertThreshold,
			timestampData: options.timestampData,
			syncToRemote: options.sync ? options.sync.syncToRemote : undefined,
			syncInterval: options.sync ? options.sync.syncInterval : undefined,
			devalidateHash: options.sync
				? options.sync.devalidateHash
				: undefined,
			defer: options.deferPersistence || 0,
			stripDefaults: options.stripDefaults || false,
		});
		this.loaded = this._datastore.loadDatabase();
	}
	private async reloadFirst() {
		if (!this.reloadBeforeOperations) return;
		await this.reload();
	}

	/**
	 * insert documents
	 */
	public async insert(docs: S[] | S): Promise<{ docs: S[]; number: number }> {
		await this.reloadFirst();
		const res = await this._datastore.insert(docs);
		return res;
	}

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
		let toDBObserver: (changes: observable.Change<S[]>[]) => void = () =>
			undefined;
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
					} else if (
						change.path.length === 1 &&
						change.type === "update"
					) {
						let doc = change.snapshot[change.path[0] as number];
						let _id = change.oldValue._id;
						operations[_id] = () =>
							this.update({ _id: _id } as any, {
								$set: doc as any,
							});
					} else if (
						change.path.length > 1 ||
						change.type === "update"
					) {
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
				const results = Object.values(operations).map((operation) =>
					operation()
				);
				Promise.all(results).catch((e) => {
					liveUpdate();
					console.error(
						`XWebDB: Reflecting observable changes to database couldn't complete due to an error:`,
						e
					);
				});
			};
			ob.observe(toDBObserver);
		}

		if (fromDB) {
			fromDBuid = addLive({
				queryFilter: filter,
				queryOptions: { skip, limit, project, sort },
				database: this,
				toDBObserver,
				observable: ob,
			});
		}

		return {
			...ob,
			async kill(w) {
				if (w === "toDB" || !w) {
					await ob.unobserve(toDBObserver);
				}
				if (w === "fromDB" || !w) {
					kill(fromDBuid);
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
		filter = fixDeep(filter);
		sort = fixDeep(sort);
		project = fixDeep(project);

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
		await this.reloadFirst();
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
		filter = fixDeep(filter || {});
		for (let index = 0; index < deepOperators.length; index++) {
			const operator = deepOperators[index];
			if (update[operator]) {
				update[operator] = fixDeep(update[operator]!) as any;
			}
		}
		await this.reloadFirst();
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
		filter = fixDeep(filter || {});
		for (let index = 0; index < deepOperators.length; index++) {
			const operator = deepOperators[index];
			if (update[operator]) {
				update[operator] = fixDeep(update[operator]!) as any;
			}
		}
		await this.reloadFirst();
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
		filter = fixDeep(filter || {});
		await this.reloadFirst();
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
		filter = fixDeep(filter || {});
		await this.reloadFirst();
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
		await this.reloadFirst();
		return await this._datastore.ensureIndex(options);
	}

	/**
	 * Remove an index by passing the field name that it is related to
	 */
	public async removeIndex(
		fieldName: string & keyof NFP<S>
	): Promise<{ affectedIndex: string }> {
		await this.reloadFirst();
		return await this._datastore.removeIndex(fieldName);
	}

	/**
	 * Reload database from the persistence layer (if it exists)
	 */
	async reload(): Promise<{}> {
		await this._datastore.persistence.loadDatabase();
		return {};
	}

	async sync() {
		if (!this._datastore.persistence.sync) {
			throw new Error(
				"XWebDB: Can not perform sync operation unless provided with remote DB adapter"
			);
		}
		await this.reloadFirst();
		return await this._datastore.persistence.sync.sync();
	}

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

function fixDeep<T extends object>(input: T): T {
	const output: { [key: string]: any } = {};
	function flattenObject(obj: { [key: string]: any }, prefix: string = "") {
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				const nestedKey = prefix ? `${prefix}.${key}` : key;
				const value = obj[key];
				/**
				 * Recursion should stop at
				 * 1. arrays
				 * 2. empty objects
				 * 3. objects that have operators
				 * 4. Null values
				 */
				if (
					!Array.isArray(value) &&
					typeof value === "object" &&
					value !== null &&
					Object.keys(value).length &&
					Object.keys(value).filter((x) => x[0] === "$").length === 0
				) {
					flattenObject(value, nestedKey);
				} else {
					output[nestedKey] = value;
				}
			}
		}
	}
	flattenObject((input as any).$deep);
	const result = Object.assign<T, Filter<any>>(input, output);
	delete result.$deep;
	return result;
}
