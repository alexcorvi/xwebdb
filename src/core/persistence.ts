import * as u from "./customUtils";
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Index } from "./indexes";
import * as model from "./model";
import { BaseModel } from "../types";
import diffingLib from "diff-sorted-array";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";

type logType = "w" | "d";
type log = { d: string; t: logType };
type persistenceLine = {
	type: "index" | "doc" | "corrupt";
	status: "add" | "remove";
	data: any;
};

type PersistenceEventCallback = (message: string) => Promise<void>;

type PersistenceEventEmits = "readLine" | "writeLine" | "end";

export class PersistenceEvent {
	callbacks: {
		readLine: Array<PersistenceEventCallback>;
		writeLine: Array<PersistenceEventCallback>;
		end: Array<PersistenceEventCallback>;
	} = {
		readLine: [],
		writeLine: [],
		end: [],
	};

	on(event: PersistenceEventEmits, cb: PersistenceEventCallback) {
		if (!this.callbacks[event]) this.callbacks[event] = [];
		this.callbacks[event].push(cb);
	}

	async emit(event: PersistenceEventEmits, data: string) {
		let cbs = this.callbacks[event];
		if (cbs) {
			for (let i = 0; i < cbs.length; i++) {
				const cb = cbs[i];
				await cb(data);
			}
		}
	}
}

interface PersistenceOptions<G extends Partial<BaseModel>> {
	db: Datastore<G>;
	afterSerialization?: (raw: string) => string;
	beforeDeserialization?: (encrypted: string) => string;
	corruptAlertThreshold?: number;
	model?: (new () => G) & {
		new: (json: G) => G;
	};
	syncInterval?: number;
	syncToRemote?: (name: string) => remoteStore;
}

/**
 * Create a new Persistence object for database options.db
 */
export class Persistence<G extends Partial<BaseModel> = any> {
	db: Datastore<G>;
	ref: string = "";

	data: IDB;
	logs: IDB;

	RSA?: (name: string) => remoteStore;
	syncInterval = 0;
	syncInProgress = false;
	rdata?: remoteStore;
	rlogs?: remoteStore;

	corruptAlertThreshold: number = 0.1;
	afterSerialization = (s: string) => s;
	beforeDeserialization = (s: string) => s;
	private _model:
		| ((new () => G) & {
				new: (json: G) => G;
		  })
		| undefined;
	protected _memoryIndexes: string[] = [];
	protected _memoryData: string[] = [];
	constructor(options: PersistenceOptions<G>) {
		this._model = options.model;
		this.db = options.db;
		this.ref = this.db.ref;

		this.data = new IDB(this.ref + "_" + "d");
		this.logs = new IDB(this.ref + "_" + "l");

		this.RSA = options.syncToRemote;
		this.syncInterval = options.syncInterval || 0;
		if (this.RSA) {
			this.rdata = this.RSA(this.ref + "_" + "d");
			this.rlogs = this.RSA(this.ref + "_" + "l");
			if (this.syncInterval) {
				setInterval(async () => {
					if (!this.syncInProgress) {
						this.syncInProgress = true;
						try {
							await this._sync();
						} catch (e) {
							console.log(new Error(e as any));
						}
						this.syncInProgress = false;
					}
				}, this.syncInterval);
			}
		}
		this.corruptAlertThreshold =
			options.corruptAlertThreshold !== undefined
				? options.corruptAlertThreshold
				: 0.1;

		// After serialization and before deserialization hooks with some basic sanity checks
		if (options.afterSerialization && !options.beforeDeserialization) {
			throw new Error(
				"Serialization hook defined but deserialization hook undefined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		if (!options.afterSerialization && options.beforeDeserialization) {
			throw new Error(
				"Serialization hook undefined but deserialization hook defined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		this.afterSerialization =
			options.afterSerialization || this.afterSerialization;
		this.beforeDeserialization =
			options.beforeDeserialization || this.beforeDeserialization;

		let randomString = u.randomString(113);
		if (
			this.beforeDeserialization(
				this.afterSerialization(randomString)
			) !== randomString
		) {
			throw new Error(
				"beforeDeserialization is not the reverse of afterSerialization, cautiously refusing to start data store to prevent dataloss"
			);
		}
	}

	async writeNewIndex(newIndexes: { $$indexCreated: EnsureIndexOptions }[]) {
		for (let i = 0; i < newIndexes.length; i++) {
			const doc = newIndexes[i];
			await this.writeData(
				doc.$$indexCreated.fieldName,
				this.afterSerialization(model.serialize(doc))
			);
		}
	}

	async writeNewData(newDocs: G[]) {
		for (let i = 0; i < newDocs.length; i++) {
			const doc = newDocs[i];
			await this.writeData(
				doc._id || "",
				this.afterSerialization(model.serialize(doc))
			);
		}
	}

	treatSingleLine(line: string): persistenceLine {
		let treatedLine: any;
		try {
			treatedLine = model.deserialize(this.beforeDeserialization(line));
			if (this._model) {
				treatedLine = this._model.new(treatedLine);
			}
		} catch (e) {
			return {
				type: "corrupt",
				status: "remove",
				data: false,
			};
		}
		if (treatedLine._id) {
			if (treatedLine.$$deleted === true) {
				return {
					type: "doc",
					status: "remove",
					data: { _id: treatedLine._id },
				};
			} else {
				return {
					type: "doc",
					status: "add",
					data: treatedLine,
				};
			}
		} else if (
			treatedLine.$$indexCreated &&
			treatedLine.$$indexCreated.fieldName !== undefined
		) {
			return {
				type: "index",
				status: "add",
				data: {
					fieldName: treatedLine.$$indexCreated.fieldName,
					data: treatedLine.$$indexCreated,
				},
			};
		} else if (typeof treatedLine.$$indexRemoved === "string") {
			return {
				type: "index",
				status: "remove",
				data: { fieldName: treatedLine.$$indexRemoved },
			};
		} else {
			return {
				type: "corrupt",
				status: "remove",
				data: true,
			};
		}
	}

	/**
	 * Load the database
	 * 1) Create all indexes
	 * 2) Insert all data
	 */
	async loadDatabase() {
		this.db.q.pause();
		this.db.resetIndexes();
		let corrupt = 0;
		let processed = 0;
		let err: any;

		const indexes: persistenceLine[] = [];
		const data: persistenceLine[] = [];

		const eventEmitter = new PersistenceEvent();
		eventEmitter.on("readLine", async (line) => {
			processed++;
			const treatedLine = this.treatSingleLine(line);
			if (treatedLine.type === "doc") {
				data.push(treatedLine);
			} else if (treatedLine.type === "index") {
				indexes.push(treatedLine);
			} else if (!treatedLine.data) {
				corrupt++;
			}
		});
		await this.readData(eventEmitter);

		// treat indexes first
		for (let index = 0; index < indexes.length; index++) {
			const line = indexes[index];
			if (line.status === "add") {
				this.db.indexes[line.data.fieldName] = new Index(
					line.data.data
				);
			}
			if (line.status === "remove") {
				delete this.db.indexes[line.data.fieldName];
			}
		}

		// then data
		for (let index = 0; index < data.length; index++) {
			const line = data[index];
			if (line.status === "add") {
				this.db.addToIndexes(line.data);
			}
			if (line.status === "remove") {
				this.db.removeFromIndexes(line.data);
			}
		}

		if (processed > 0 && corrupt / processed > this.corruptAlertThreshold) {
			throw new Error(
				`More than ${Math.floor(
					100 * this.corruptAlertThreshold
				)}% of the data file is corrupt, the wrong beforeDeserialization hook may be used. Cautiously refusing to start Datastore to prevent dataloss`
			);
		} else if (err) {
			throw err;
		}

		this.db.q.start();
		return true;
	}

	// ========== TODO: test the functions below
	async addToLog(d: string, t: logType, timestamp?: string) {
		timestamp = timestamp || Date.now().toString(36); // create a timestamp if not provided by a remote change

		await this.logs.set(timestamp, JSON.stringify({ d, t }));
		await this.logs.set(
			"$H",
			u.xxh(JSON.stringify((await this.logs.keys()).sort())).toString()
		);
	}

	compareLog(
		localKeys: string[],
		remoteKeys: string[]
	): { shouldSend: string[]; shouldHave: string[] } {
		let shouldHave: string[] = [];
		let shouldSend: string[] = [];

		const diff = diffingLib.justDiff(
			localKeys.sort(),
			remoteKeys.sort(),
			diffingLib.asc
		);
		shouldHave = diff.added;
		shouldSend = diff.deleted;

		return {
			shouldHave,
			shouldSend,
		};
	}

	sync() {
		return new Promise<{ sent: number; received: number }>((resolve) => {
			let interval = setInterval(async () => {
				if (!this.syncInProgress) {
					clearInterval(interval);
					this.syncInProgress = true;
					let syncResult = { sent: 0, received: 0 };
					try {
						syncResult = await this._sync();
					} catch (e) {
						console.log(Error(e as any));
					}
					this.syncInProgress = false;
					resolve(syncResult);
				}
			}, 1);
		});
	}

	private async _sync() {
		const rHash = await this.rlogs!.getItem("$H");
		const lHash = (await this.logs.get("$H")) || "0";
		if (lHash === rHash || (lHash === "0" && rHash.indexOf("10009") > -1)) {
			return { sent: 0, received: 0 };
		}
		const remoteKeys = (await this.rlogs!.keys()).filter((x) => x !== "$H");
		const localKeys = (await this.logs.keys()).filter((x) => x !== "$H");
		const diff = this.compareLog(localKeys as string[], remoteKeys);
		if (diff.shouldHave.length === 0 && diff.shouldSend.length === 0) {
			// no diff, just not the same hash
			await this.rlogs!.setItem(
				"$H",
				u.xxh(JSON.stringify(remoteKeys.sort())).toString()
			);

			await this.logs.set(
				"$H",
				u.xxh(JSON.stringify(localKeys.sort())).toString()
			);
			return { sent: 0, received: 0 };
		}

		const shouldHaves: {
			timestamp: string;
			value: log;
		}[] = (await this.rlogs!.getItems(diff.shouldHave)).map((x) => ({
			timestamp: x.key,
			value: JSON.parse(x.value),
		}));
		for (let index = 0; index < shouldHaves.length; index++) {
			const e = shouldHaves[index];
			if (e.value.t === "d") {
				await this.deleteData(e.value.d, e.timestamp);
			} else {
				if (
					shouldHaves.find(
						(x) => x.value.t === "d" && x.value.d === e.value.d
					)
				) {
					// if it has been deleted, add log only
					// TODO: samething with indexes
					await this.addToLog(e.value.d, "w", e.timestamp);
				} else {
					// otherwise write whole data (and log)
					await this.writeData(
						e.value.d,
						await this.rdata!.getItem(e.value.d),
						e.timestamp
					);
				}
			}
		}

		const shouldSend: {
			timestamp: string;
			value: log;
		}[] = await Promise.all(
			diff.shouldSend.map(async (x) => ({
				timestamp: x,
				value: JSON.parse((await this.logs.get(x)) || ""),
			}))
		);

		const deletions = shouldSend.filter((x) => x.value.t === "d");
		const writes = shouldSend.filter(
			(x) =>
				x.value.t === "w" &&
				!deletions.find((y) => y.value.d === x.value.d)
			// shouldn't be deleted on the shouldSend
			// TODO: samething with indexes
		);
		// deletions
		await this.rdata!.removeItems(deletions.map((x) => x.value.d));
		// writes
		await this.rdata!.setItems(
			await Promise.all(
				writes.map(async (x) => ({
					key: x.value.d,
					value: (await this.data.get(x.value.d)) || "",
				}))
			)
		);
		// write logs too
		await this.rlogs!.setItems(
			shouldSend.map((x) => ({
				key: x.timestamp,
				value: JSON.stringify(x.value),
			}))
		);

		// and hash
		if (shouldSend.length) {
			let allRemoteKeys = remoteKeys.concat(
				shouldSend.map((x) => x.timestamp)
			);
			await this.rlogs!.setItem(
				"$H",
				u.xxh(JSON.stringify(allRemoteKeys.sort())).toString()
			);
		}
		return {
			sent: diff.shouldSend.length,
			received: diff.shouldHave.length,
		};
	}

	// create a new file for remote API?
	// ========== TODO: test the functions above

	async readData(event: PersistenceEvent) {
		const all = await this.data.values();
		for (let i = 0; i < all.length; i++) {
			const line = all[i];
			event.emit("readLine", line);
		}
		event.emit("end", "");
	}

	async deleteData(_id: string, timestamp?: string) {
		await this.data.del(_id);
		await this.addToLog(_id, "d", timestamp);
	}
	async writeData(_id: string, data: string, timestamp?: string) {
		await this.data.set(_id, data);
		await this.addToLog(_id, "w", timestamp);
	}
	async clearData() {
		// must go through the above functions so it can get logged
		const list = await this.data.keys();
		for (let index = 0; index < list.length; index++) {
			const element = list[index] as string;
			await this.deleteData(element);
		}
	}
}

/**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */

// TODO: do idb operations in bulk for perf improvements
// TODO: devalidate same key rule after 20 minutes ? Math.floor(new Date() / (1000 * 60 * 20))
// TODO: Optional to encrypt data
// TODO: test new functions
// TODO: setup benchmark
