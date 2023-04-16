import * as u from "./customUtils";
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Index } from "./indexes";
import * as model from "./model";
import { BaseModel } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
import { Sync } from "./sync2";

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

interface PersistenceOptions<G extends Partial<BaseModel<G>>> {
	db: Datastore<G>;
	encode?: (raw: string) => string;
	decode?: (encrypted: string) => string;
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
export class Persistence<G extends Partial<BaseModel<G>> = any> {
	db: Datastore<G>;
	ref: string = "";

	data: IDB;

	RSA?: (name: string) => remoteStore;
	syncInterval = 0;
	syncInProgress = false;
	sync?: Sync;

	corruptAlertThreshold: number = 0.1;
	encode = (s: string) => s;
	decode = (s: string) => s;
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

		this.RSA = options.syncToRemote;
		this.syncInterval = options.syncInterval || 0;
		if (this.RSA) {
			const rdata = this.RSA(this.ref + "_" + "d");
			const rlogs = this.RSA(this.ref + "_" + "l");
			this.sync = new Sync(
				this,
				new IDB(this.ref + "_" + "l"),
				rdata,
				rlogs
			);
		}

		if (this.RSA && this.syncInterval) {
			setInterval(async () => {
				if (!this.syncInProgress) {
					this.syncInProgress = true;
					try {
						await this.sync!._sync();
					} catch (e) {
						console.log(new Error(e as any));
					}
					this.syncInProgress = false;
				}
			}, this.syncInterval);
		}

		this.corruptAlertThreshold =
			options.corruptAlertThreshold !== undefined
				? options.corruptAlertThreshold
				: 0.1;

		// encode and decode hooks with some basic sanity checks
		if (options.encode && !options.decode) {
			throw new Error(
				"encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		if (!options.encode && options.decode) {
			throw new Error(
				"decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		this.encode = options.encode || this.encode;
		this.decode = options.decode || this.decode;

		let randomString = u.randomString(113);
		if (this.decode(this.encode(randomString)) !== randomString) {
			throw new Error(
				"encode is not the reverse of decode, cautiously refusing to start data store to prevent dataloss"
			);
		}
	}

	async writeNewIndex(newIndexes: { $$indexCreated: EnsureIndexOptions }[]) {
		for (let i = 0; i < newIndexes.length; i++) {
			const doc = newIndexes[i];
			await this.writeData(
				doc.$$indexCreated.fieldName,
				this.encode(model.serialize(doc))
			);
		}
	}

	async writeNewData(newDocs: G[]) {
		for (let i = 0; i < newDocs.length; i++) {
			const doc = newDocs[i];
			await this.writeData(
				doc._id || "",
				this.encode(model.serialize(doc))
			);
		}
	}

	treatSingleLine(line: string): persistenceLine {
		let treatedLine: any;
		try {
			treatedLine = model.deserialize(this.decode(line));
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
		if (
			treatedLine._id &&
			!(treatedLine.$$indexCreated || treatedLine.$$indexRemoved)
		) {
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
				)}% of the data file is corrupt, the wrong decode hook might have been used. Cautiously refusing to start Datastore to prevent dataloss`
			);
		} else if (err) {
			throw err;
		}

		this.db.q.start();
		return true;
	}

	async readData(event: PersistenceEvent) {
		const all = await this.data.values();
		for (let i = 0; i < all.length; i++) {
			const line = all[i];
			if (isNaN(Number(line)) && line !== "$deleted")
				event.emit("readLine", line);
		}
		event.emit("end", "");
	}

	async deleteData(_id: string, timestamp?: string) {
		await this.data.del(_id);
		if (this.sync) {
			await this.sync.addToLog(_id, "d", timestamp);
		}
	}
	async writeData(_id: string, data: string, timestamp?: string) {
		await this.data.set(_id, data);
		if (this.sync) {
			await this.sync.addToLog(_id, "w", timestamp);
		}
	}
	async clearData() {
		// must go through the above functions so it can get logged
		const list = await this.data.keys();
		for (let index = 0; index < list.length; index++) {
			const element = list[index] as string;
			await this.deleteData(element);
		}
	}
	/**
	 * Deletes all data and logs
	 * deletions will not be syncable
	 */
	async deleteEverything() {
		await this.data.clear();
		await this.sync?.log.clear();
	}
}
