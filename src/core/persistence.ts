/**
 * Persistence layer class
 * Actual IndexedDB operations are in "idb.ts"
 * This class mainly process data and prepares it prior idb.ts
 */

import * as u from "./customUtils";
import { Datastore, EnsureIndexOptions } from "./datastore";
import { Index } from "./indexes";
import * as model from "./model/";
import { Doc } from "../types";
import { remoteStore } from "./adapters/type";
import { IDB, Line } from "./idb";
import { Sync } from "./sync";

interface PersistenceOptions<G extends Doc, C extends typeof Doc> {
	db: Datastore<G, C>;
	encode?: (raw: string) => string;
	decode?: (encrypted: string) => string;
	corruptAlertThreshold?: number;
	model?: typeof Doc;
	syncInterval?: number;
	syncToRemote?: (name: string) => remoteStore;
	stripDefaults?: boolean;
}

/**
 * Create a new Persistence object for database options.db
 */
export class Persistence<G extends Doc, C extends typeof Doc> {
	db: Datastore<G, C>;
	ref: string = "";
	data: IDB;
	RSA?: (name: string) => remoteStore;
	syncInterval = 0;
	syncInProgress = false;
	sync?: Sync;
	corruptAlertThreshold: number = 0.1;
	encode = (s: string) => s;
	decode = (s: string) => s;
	stripDefaults: boolean = false;
	_model: typeof Doc = Doc;
	shouldEncode: boolean = false;
	constructor(options: PersistenceOptions<G, C>) {
		this._model = options.model || this._model;
		this.db = options.db;
		this.ref = this.db.ref;
		this.data = new IDB(this.ref);
		this.stripDefaults = options.stripDefaults || false;

		this.RSA = options.syncToRemote;
		this.syncInterval = options.syncInterval || 0;
		if (this.RSA) {
			const remoteData = this.RSA(this.ref);
			this.sync = new Sync(this, remoteData);
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
				"XWebDB: encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent data loss"
			);
		}
		if (!options.encode && options.decode) {
			throw new Error(
				"XWebDB: decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent data loss"
			);
		}
		this.encode = options.encode || this.encode;
		this.decode = options.decode || this.decode;

		let randomString = u.uid();
		if (this.decode(this.encode(randomString)) !== randomString) {
			throw new Error(
				"XWebDB: encode is not the reverse of decode, cautiously refusing to start data store to prevent data loss"
			);
		}
		this.shouldEncode = !!options.encode && !!options.decode;
	}

	/**
	 * serializes & writes a new index using the $$ notation.
	 */
	async writeNewIndex(newIndexes: { $$indexCreated: EnsureIndexOptions }[]) {
		return await this.writeData(
			newIndexes.map((x) => [
				x.$$indexCreated.fieldName,
				{ _id: x.$$indexCreated.fieldName, ...x },
			])
		);
	}

	/**
	 * Copies, strips all default data, and serializes documents then writes it.
	 */
	async writeNewData(newDocs: G[]) {
		// stripping defaults
		newDocs = model.deserialize(model.serialize({ t: newDocs })).t; // avoid triggering live queries when stripping default
		for (let index = 0; index < newDocs.length; index++) {
			let doc = newDocs[index];
			if (doc._stripDefaults) {
				newDocs[index] = doc._stripDefaults();
			}
		}

		return await this.writeData(newDocs.map((x) => [x._id, x]));
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

		const data: Doc[] = [];

		const persisted = await this.readData();
		for (let index = 0; index < persisted.length; index++) {
			processed++;
			const line = persisted[index];
			if (line === null) {
				corrupt++;
				continue;
			}
			if (line.$$indexCreated) {
				this.db.indexes[line.$$indexCreated.fieldName] = new Index({
					fieldName: line.$$indexCreated.fieldName as any,
					unique: line.$$indexCreated.unique,
					sparse: line.$$indexCreated.sparse,
				});
			} else {
				data.push(this._model.new(line));
			}
		}

		for (let index = 0; index < data.length; index++) {
			const line = data[index];
			this.db.addToIndexes(line as G);
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
	 * (excluding $H and documents that actually $deleted)
	 */
	async readData() {
		let all = await this.data.documents();
		let res: (Line | null)[] = [];
		for (let index = 0; index < all.length; index++) {
			let line = all[index];
			// corrupt
			if (typeof line !== "object" || line === null) {
				res.push(null);
				continue;
			}
			// skip $H & deleted documents
			if ((line._id && line._id.startsWith("$H")) || line.$$deleted) continue;
			// skip lines that is neither an index nor document
			if (line._id === undefined && line.$$indexCreated === undefined) continue;
			// decode encoded
			if (line._encoded) line = model.deserialize(this.decode(line._encoded));
			res.push(line);
		}
		return res;
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
	 * 		3. then setting $H to a value indicating that a sync operation should progress
	 */
	async deleteData(_ids: string[]) {
		if (!this.RSA) {
			await this.data.delBulk(_ids);
			return _ids;
		}
		const oldIDRevs: string[] = [];
		const newIDRevs: [string, { _id: string; _rev: string; $$deleted: true }][] = [];
		for (let index = 0; index < _ids.length; index++) {
			const _id = _ids[index];
			const oldIDRev = (await this.data.byID(_id)) || "";
			const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = _id + "_" + newRev;
			oldIDRevs.push(oldIDRev.toString());
			newIDRevs.push([newIDRev, { _id, _rev: newRev, $$deleted: true }]);
		}
		await this.data.delBulk(oldIDRevs);
		await this.data.setBulk(newIDRevs);
		if (this.sync) await this.sync.setL$("updated");
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
	 * 		3. then setting $H to a value indicating that a sync operation should progress
	 */
	async writeData(input: [string, Line][]) {
		if (!this.RSA) {
			if (this.shouldEncode)
				input = input.map((x) => [
					x[0],
					{ _id: x[1]._id, _encoded: this.encode(model.serialize(x[1])) },
				]);
			await this.data.setBulk(input);
			return input.map((x) => x[0]);
		}
		const oldIDRevs: string[] = [];
		const newIDRevsData: [string, Line][] = [];

		for (let index = 0; index < input.length; index++) {
			const element = input[index];
			const oldIDRev = (await this.data.byID(element[0])) || "";
			const newRev = Math.random().toString(36).substring(2, 4) + Date.now();
			const newIDRev = element[0] + "_" + newRev;
			element[1]._rev = newRev;
			oldIDRevs.push(oldIDRev.toString());
			if (this.shouldEncode) {
				element[1] = {
					_encoded: this.encode(model.serialize(element[1])),
					_id: element[1]._id,
					_rev: element[1]._rev,
				};
			}
			newIDRevsData.push([newIDRev, element[1]]);
		}
		await this.data.delBulk(oldIDRevs);
		await this.data.setBulk(newIDRevsData);
		if (this.sync) await this.sync.setL$("updated");
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
