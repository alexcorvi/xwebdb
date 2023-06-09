import { Dictionary } from "./dictionary";
import * as model from "./model/";
import { Doc } from "../types";

interface Pair<Doc> {
	newDoc: Doc;
	oldDoc: Doc;
}

/**
 * Type-aware projection
 */
function projectForUnique<Key>(elt: Key): string | Key {
	if (elt === null) {
		return "$NU";
	}
	if (typeof elt === "string") {
		return "$ST" + elt;
	}
	if (typeof elt === "boolean") {
		return "$BO" + elt;
	}
	if (typeof elt === "number") {
		return "$NO" + elt;
	}
	if (elt instanceof Date) {
		return "$DA" + elt.getTime();
	}

	return elt; // Arrays and objects, will check for pointer equality
}

function uniqueProjectedKeys<Key>(key: Key[]): (Key | string)[] {
	return Array.from(new Set(key.map((x) => projectForUnique(x)))).map((key) => {
		if (typeof key === "string") {
			return key.substring(3);
		} else return key;
	});
}

export class Index<Key extends S[keyof S], S extends Doc> {
	fieldName: keyof S;
	unique: boolean = false;
	sparse: boolean = false;

	dict: Dictionary<S>;

	constructor({
		fieldName,
		unique,
		sparse,
	}: {
		fieldName: keyof S;
		unique?: boolean;
		sparse?: boolean;
	}) {
		this.fieldName = fieldName;
		this.unique = !!unique;
		this.sparse = !!sparse;

		this.dict = new Dictionary({
			unique: this.unique,
			c: model.compare,
			fieldName: this.fieldName,
		});
	}

	/**
	 * Resetting an index: i.e. removing all data from it
	 */
	reset() {
		this.dict = new Dictionary({
			unique: this.unique,
			c: model.compare,
			fieldName: this.fieldName,
		});
	}

	/**
	 * Insert a new document in the index
	 * If an array is passed, we insert all its elements (if one insertion fails the index is not modified, atomic)
	 * O(log(n))
	 */
	insert(doc: S | S[]) {
		if (Array.isArray(doc)) {
			return this.insertMultipleDocs(doc);
		}

		let key = model.fromDotNotation(doc, this.fieldName as string) as Key;

		// We don't index documents that don't contain the field if the index is sparse
		if (key === undefined && this.sparse) {
			return;
		}

		if (!Array.isArray(key)) {
			this.dict.insert(key, doc);
		} else {
			// if key is an array we'll consider each item as a key, and the document will be on each of them
			// If an insert fails due to a unique constraint, roll back all inserts before it
			let keys = uniqueProjectedKeys(key) as Key[];

			let error;
			let failingIndex = -1;

			for (let i = 0; i < keys.length; i++) {
				try {
					this.dict.insert(keys[i], doc);
				} catch (e) {
					error = e;
					failingIndex = i;
					break;
				}
			}

			if (error) {
				for (let i = 0; i < failingIndex; i++) {
					this.dict.delete(keys[i], doc);
				}
				throw error;
			}
		}
	}

	/**
	 * Insert an array of documents in the index
	 * If a constraint is violated, the changes should be rolled back and an error thrown
	 *
	 */
	private insertMultipleDocs(docs: S[]) {
		let error;
		let failingI = -1;

		for (let i = 0; i < docs.length; i++) {
			try {
				this.insert(docs[i]);
			} catch (e) {
				error = e;
				failingI = i;
				break;
			}
		}

		if (error) {
			for (let i = 0; i < failingI; i++) {
				this.remove(docs[i]);
			}

			throw error;
		}
	}

	/**
	 * Remove a document from the index
	 * If an array is passed, we remove all its elements
	 * The remove operation is safe with regards to the 'unique' constraint
	 * O(log(n))
	 */
	remove(doc: S | S[]): void {
		if (Array.isArray(doc)) {
			return doc.forEach((d) => this.remove(d));
		}

		let key = model.fromDotNotation(doc, this.fieldName as string) as Key;

		if (key === undefined && this.sparse) {
			return;
		}

		if (!Array.isArray(key)) {
			this.dict.delete(key, doc);
		} else {
			uniqueProjectedKeys(key).forEach((_key) => this.dict.delete(_key, doc));
		}
	}

	/**
	 * Update a document in the index
	 * If a constraint is violated, changes are rolled back and an error thrown
	 * Naive implementation, still in O(log(n))
	 */
	update(oldDoc: S | Array<Pair<S>>, newDoc?: S) {
		if (Array.isArray(oldDoc)) {
			this.updateMultipleDocs(oldDoc);
			return;
		} else if (newDoc) {
			this.remove(oldDoc);
			try {
				this.insert(newDoc);
			} catch (e) {
				this.insert(oldDoc);
				throw e;
			}
		}
	}

	/**
	 * Update multiple documents in the index
	 * If a constraint is violated, the changes need to be rolled back
	 * and an error thrown
	 */
	private updateMultipleDocs(pairs: Pair<S>[]) {
		let failingI = -1;
		let error;

		for (let i = 0; i < pairs.length; i++) {
			this.remove(pairs[i].oldDoc);
		}

		for (let i = 0; i < pairs.length; i++) {
			try {
				this.insert(pairs[i].newDoc);
			} catch (e) {
				error = e;
				failingI = i;
				break;
			}
		}

		// If an error was raised, roll back changes in the inverse order
		if (error) {
			for (let i = 0; i < failingI; i++) {
				this.remove(pairs[i].newDoc);
			}

			for (let i = 0; i < pairs.length; i++) {
				this.insert(pairs[i].oldDoc);
			}

			throw error;
		}
	}

	/**
	 * Revert an update
	 */
	revertUpdate(oldDoc: S | Array<Pair<S>>, newDoc?: S) {
		var revert: { newDoc: S; oldDoc: S }[] = [];

		if (!Array.isArray(oldDoc) && newDoc) {
			this.update(newDoc, oldDoc);
		} else if (Array.isArray(oldDoc)) {
			oldDoc.forEach((pair) => {
				revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
			});
			this.update(revert);
		}
	}
}
