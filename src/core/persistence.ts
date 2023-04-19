import * as u from "./customUtils";
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Index } from "./indexes";
import * as model from "./model";
import { BaseModel } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB } from "./idb";
import { Sync } from "./sync";

export type persistenceLine = {
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
	devalidateHash?: number;
}

/**
 * Create a new Persistence object for database options.db
 */
export class Persistence<G extends Partial<BaseModel<G>> = any> {
	db: Datastore<G>;
	ref: string = "";
	data: IDB<string>;
	RSA?: (name: string) => remoteStore;
	syncInterval = 0;
	syncInProgress = false;
	sync?: Sync;
	devalidateHash: number = 0;
	corruptAlertThreshold: number = 0.1;
	encode = (s: string) => s;
	decode = (s: string) => s;
	private _model:
		| ((new () => G) & {
				new: (json: G) => G;
		  })
		| undefined;
	constructor(options: PersistenceOptions<G>) {
		this._model = options.model;
		this.db = options.db;
		this.ref = this.db.ref;

		this.data = new IDB(this.ref);

		this.RSA = options.syncToRemote;
		this.devalidateHash = options.devalidateHash || 0;
		this.syncInterval = options.syncInterval || 0;
		if (this.RSA) {
			const rdata = this.RSA(this.ref);
			this.sync = new Sync(this, rdata);
		}

		if (this.RSA && this.syncInterval) {
			setInterval(async () => {
				if (!this.syncInProgress) {
					let err = undefined;
					this.syncInProgress = true;
					try {
						await this.sync!._sync();
					} catch (e) {
						err = e;
					}
					this.syncInProgress = false;
					if(err) throw new Error(err as any)
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
		await this.writeData(
			newIndexes.map((x) => [
				x.$$indexCreated.fieldName,
				this.encode(model.serialize(x)),
			])
		);
	}

	async writeNewData(newDocs: G[]) {
		await this.writeData(
			newDocs.map((x) => [x._id || "", this.encode(model.serialize(x))])
		);
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
		this.db.resetIndexes(true);
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
			if ((!line.startsWith("$H")) && line !== "$deleted")
				event.emit("readLine", line);
		}
		event.emit("end", "");
	}

	async deleteData(_ids: string[]) {
		if (!this.RSA) return this.data.dels(_ids);
		const keys = (await this.data.keys()) as string[];
		const oldIDRevs: string[] = [];
		const newIDRevs: string[] = [];

		for (let index = 0; index < _ids.length; index++) {
			const _id = _ids[index];
			const oldIDRev =
				keys.find((key) => key.toString().startsWith(_id + "_")) || "";
			const newRev =
				Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = _id + "_" + newRev;
			oldIDRevs.push(oldIDRev);
			newIDRevs.push(newIDRev);
			keys.splice(keys.indexOf(oldIDRev), 1);
			keys.push(newIDRev);
		}
		await this.data.dels(oldIDRevs);
		await this.data.sets(newIDRevs.map((x) => [x, "$deleted"]));
		if (this.sync) await this.sync.setLocalHash(keys);
	}
	async writeData(input: [string, string][]) {
		if (!this.RSA) return this.data.sets(input);
		const keys = (await this.data.keys()) as string[];
		const oldIDRevs: string[] = [];
		const newIDRevsData: [string, string][] = [];

		for (let index = 0; index < input.length; index++) {
			const element = input[index];
			const oldIDRev =
				keys.find((key) =>
					key.toString().startsWith(element[0] + "_")
				) || "";
			const newRev =
				Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = element[0] + "_" + newRev;
			oldIDRevs.push(oldIDRev);
			newIDRevsData.push([newIDRev, element[1]]);
			keys.splice(keys.indexOf(oldIDRev), 1);
			keys.push(newIDRev);
		}
		await this.data.dels(oldIDRevs);
		await this.data.sets(newIDRevsData);
		if (this.sync) await this.sync.setLocalHash(keys);
	}
	/**
	 * Deletes all data
	 * deletions will not be syncable
	 */
	async deleteEverything() {
		await this.data.clear();
	}
}
