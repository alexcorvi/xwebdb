/**
 * Persistence layer (IndexedDB) class
 * writes, deletes and reads from IndexedDB
 */

import * as u from "./customUtils";
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Index } from "./indexes";
import * as model from "./model/";
import { Doc } from "../types";
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

interface PersistenceOptions<G extends Doc, C extends typeof Doc> {
	db: Datastore<G, C>;
	encode?: (raw: string) => string;
	decode?: (encrypted: string) => string;
	corruptAlertThreshold?: number;
	model?: typeof Doc;
	syncInterval?: number;
	syncToRemote?: (name: string) => remoteStore;
	invalidateHash?: number;
	stripDefaults?: boolean;
}

/**
 * Create a new Persistence object for database options.db
 */
export class Persistence<G extends Doc, C extends typeof Doc> {
	db: Datastore<G, C>;
	ref: string = "";
	data: IDB<string>;
	RSA?: (name: string) => remoteStore;
	syncInterval = 0;
	syncInProgress = false;
	sync?: Sync;
	invalidateHash: number = 0;
	corruptAlertThreshold: number = 0.1;
	encode = (s: string) => s;
	decode = (s: string) => s;
	stripDefaults: boolean = false;
	private _model: typeof Doc | undefined;
	constructor(options: PersistenceOptions<G, C>) {
		this._model = options.model;
		this.db = options.db;
		this.ref = this.db.ref;
		this.stripDefaults = options.stripDefaults || false;
		this.data = new IDB(this.ref);

		this.RSA = options.syncToRemote;
		this.invalidateHash = options.invalidateHash || 0;
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
					if (err) throw new Error(err as any);
				}
			}, this.syncInterval);
		}

		this.corruptAlertThreshold =
			options.corruptAlertThreshold !== undefined ? options.corruptAlertThreshold : 0.1;

		// encode and decode hooks with some basic sanity checks
		if (options.encode && !options.decode) {
			throw new Error(
				"XWebDB: encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		if (!options.encode && options.decode) {
			throw new Error(
				"XWebDB: decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent dataloss"
			);
		}
		this.encode = options.encode || this.encode;
		this.decode = options.decode || this.decode;

		let randomString = u.randomString(113);
		if (this.decode(this.encode(randomString)) !== randomString) {
			throw new Error(
				"XWebDB: encode is not the reverse of decode, cautiously refusing to start data store to prevent dataloss"
			);
		}
	}

	/**
	 * serializes & writes a new index using the $$ notation.
	 */
	async writeNewIndex(newIndexes: { $$indexCreated: EnsureIndexOptions }[]) {
		return await this.writeData(
			newIndexes.map((x) => [x.$$indexCreated.fieldName, this.encode(model.serialize(x))])
		);
	}

	/**
	 * Copies, strips all default data, and serializes documents then writes it.
	 */
	async writeNewData(newDocs: G[]) {
		if (this.stripDefaults) {
			newDocs = model.deserialize(model.serialize({ t: newDocs })).t; // avoid triggering live queries when stripping default
			for (let index = 0; index < newDocs.length; index++) {
				let doc = newDocs[index];
				if (doc._stripDefaults) {
					newDocs[index] = doc._stripDefaults();
				}
			}
		}

		return await this.writeData(
			newDocs.map((x) => [x._id || "", this.encode(model.serialize(x))])
		);
	}

	/**
	 * Processing single line (i.e. value) from IndexedDB
	 * returns type of line: "index" | "doc" | "corrupt"
	 * and what to do with it: "add" (to indexes) | "remove" (from indexes)
	 */
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
		if (treatedLine._id && !(treatedLine.$$indexCreated || treatedLine.$$indexRemoved)) {
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
	 * 1. Reset all indexes
	 * 2. Create all indexes
	 * 3. Add data to indexes
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
				this.db.indexes[line.data.fieldName] = new Index(line.data.data);
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
				`XWebDB: More than ${Math.floor(
					100 * this.corruptAlertThreshold
				)}% of the data file is corrupt, the wrong decode hook might have been used. Cautiously refusing to start Datastore to prevent dataloss`
			);
		} else if (err) {
			throw err;
		}

		this.db.q.start();
		return true;
	}

	/**
	 * Reads data from the database
	 * (excluding $H: keys hash and documents that actually $deleted)
	 */
	readData(event: PersistenceEvent): Promise<null> {
		return new Promise((resolve, reject) => {
			this.data.valuesSequential(
				(line) => {
					if (!line.startsWith("$H") && line !== "$deleted")
						event.emit("readLine", line);
				},
				() => {
					event.emit("end", "");
					resolve(null);
				}
			);
		});
	}

	/**
	 * Given that IndexedDB documents ID has the following structure:
	 * {ID}_{Rev}
	 * 		where 	{ID} is the actual document ID
	 * 				{Rev} is a random string of two characters + timestamp
	 *
	 * Deletes data (in bulk)
	 * by
	 * 		1. getting all the document (or index) old revisions and deleting them
	 * 		2. then setting a new document with the same ID but a newer rev with the $deleted value
	 * 		3. then updating the keys hash
	 */
	async deleteData(_ids: string[]) {
		if (!this.RSA) {
			await this.data.dels(_ids);
			return _ids;
		}
		const keys = await this.data.keys();
		const oldIDRevs: string[] = [];
		const newIDRevs: string[] = [];

		for (let index = 0; index < _ids.length; index++) {
			const _id = _ids[index];
			const oldIDRev = keys.find((key) => key.toString().startsWith(_id + "_")) || "";
			const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = _id + "_" + newRev;
			oldIDRevs.push(oldIDRev);
			newIDRevs.push(newIDRev);
			keys.splice(keys.indexOf(oldIDRev), 1);
			keys.push(newIDRev);
		}
		await this.data.dels(oldIDRevs);
		await this.data.sets(newIDRevs.map((x) => [x, "$deleted"]));
		if (this.sync) await this.sync.setL$(keys);
		return _ids;
	}

	/**
	 * Given that IndexedDB documents ID has the following structure:
	 * {ID}_{Rev}
	 * 		where 	{ID} is the actual document ID
	 * 				{Rev} is a random string of two characters + timestamp
	 *
	 * writes data (in bulk) (inserts & updates)
	 * by: 	1. getting all the document (or index) old revisions and deleting them
	 * 		2. then setting a new document with the same ID but a newer rev with the new value
	 * 			(i.e. a serialized version of the document)
	 * 		3. then updating the keys hash
	 */
	async writeData(input: [string, string][]) {
		if (!this.RSA) {
			await this.data.sets(input);
			return input.map((x) => x[0]);
		}
		const keys = await this.data.keys();
		const oldIDRevs: string[] = [];
		const newIDRevsData: [string, string][] = [];

		for (let index = 0; index < input.length; index++) {
			const element = input[index];
			const oldIDRev =
				keys.find((key) => key.toString().startsWith(element[0] + "_")) || "";
			const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = element[0] + "_" + newRev;
			oldIDRevs.push(oldIDRev);
			newIDRevsData.push([newIDRev, element[1]]);
			keys.splice(keys.indexOf(oldIDRev), 1);
			keys.push(newIDRev);
		}
		await this.data.dels(oldIDRevs);
		await this.data.sets(newIDRevsData);
		if (this.sync) await this.sync.setL$(keys);
		return input.map((x) => x[0]);
	}

	/**
	 * Deletes all data
	 * deletions will NOT sync
	 */
	async deleteEverything() {
		await this.data.clear();
	}
}
