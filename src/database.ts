import {
	Datastore,
	EnsureIndexOptions,
	observable as o,
	observable,
} from "./core";
import { remoteStore } from "./core/adapters/type";
import { addLive } from "./core/live";
import {
	NFP,
	BaseModel,
	Filter,
	SchemaKeyProjection,
	SchemaKeySort,
	UpdateOperators,
	UpsertOperators,
} from "./types"; // for some reason using @types will disable some type checks

export interface DatabaseConfigurations<S extends BaseModel> {
	ref: string;
	model?: (new () => S) & {
		new: (json: S) => S;
	};
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
}

export class Database<S extends BaseModel> {
	private ref: string;
	private reloadBeforeOperations: boolean = false;
	private model: (new () => S) & {
		new: (json: S) => S;
	};
	public _datastore: Datastore<S>;
	public loaded: Promise<boolean>;

	constructor(options: DatabaseConfigurations<S>) {
		this.model =
			options.model ||
			(BaseModel as (new () => S) & {
				new: (json: S) => S;
			});

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
		const res = await this._datastore.insert(docs as any);
		return res;
	}

	public async live(
		filter: Filter<NFP<S>> = {},
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
			sort?: SchemaKeySort<NFP<S>>;
			project?: SchemaKeyProjection<NFP<S>>;
			toDB?: boolean;
			fromDB?: boolean;
		} = {}
	): Promise<o.ObservableArray<S[]>> {
		const res = await this.read(...arguments);
		const ob = o.observable(res);
		let toDBObserver: (changes: observable.Change<S[]>[]) => void = () =>
			undefined;

		if (toDB) {
			toDBObserver = (changes: observable.Change<S[]>[]) => {
				let operations: { [key: string]: () => Promise<any> } = {};
				for (let i = 0; i < changes.length; i++) {
					const change = changes[i];
					if (change.path.length > 1 || change.type === "update") {
						// updating
						let doc = change.snapshot[change.path[0] as number];
						let _id = doc._id;
						operations[_id] = () =>
							this.upsert({ _id: _id } as any, {
								$set: doc as any,
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
				const results = Object.values(operations).map(
					(operation) => operation
				);
				Promise.all(results).catch((e) => {
					console.error(
						`XWebDB: Reflecting observable changes to database couldn't complete due to an error:`,
						e
					);
				});
			};
			ob.observe(toDBObserver);
		}

		if (fromDB) {
			addLive({
				queryFilter: filter,
				queryOptions: { skip, limit, project, sort },
				database: this,
				toDBObserver,
				observable: ob,
			});
		}

		return ob;
	}

	/**
	 * Find document(s) that meets a specified criteria
	 */
	public async read(
		filter: Filter<NFP<S>> = {},
		{
			skip = 0,
			limit = 0,
			project = {},
			sort = {},
		}: {
			skip?: number;
			limit?: number;
			sort?: SchemaKeySort<NFP<S>>;
			project?: SchemaKeyProjection<NFP<S>>;
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
		filter: Filter<NFP<S>>,
		update: UpdateOperators<NFP<S>>,
		multi: boolean = false
	): Promise<{ docs: S[]; number: number }> {
		filter = fixDeep(filter || {});
		if (update.$set) {
			update.$set = fixDeep(update.$set);
		}
		if (update.$unset) {
			update.$unset = fixDeep(update.$unset);
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
		filter: Filter<NFP<S>>,
		update: UpsertOperators<NFP<S>>,
		multi: boolean = false
	): Promise<{ docs: S[]; number: number; upsert: boolean }> {
		filter = fixDeep(filter || {});
		if (update.$set) {
			update.$set = fixDeep(update.$set);
		}
		if (update.$unset) {
			update.$unset = fixDeep(update.$unset);
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
	public async count(filter: Filter<NFP<S>> = {}): Promise<number> {
		filter = fixDeep(filter || {});
		await this.reloadFirst();
		return await this._datastore.count(filter);
	}

	/**
	 * Delete document(s) that meets the specified criteria
	 *
	 */
	public async delete(
		filter: Filter<NFP<S>>,
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
				"Can not perform sync operation unless provided with remote DB adapter"
			);
		}
		await this.reloadFirst();
		return await this._datastore.persistence.sync.sync();
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

function fixDeep<T extends Filter<any>>(input: T): T {
	const result = Object.assign<T, Filter<any>>(input, input.$deep);
	delete result.$deep;
	return result;
}
