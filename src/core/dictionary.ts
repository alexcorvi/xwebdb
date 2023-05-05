/**
 * This is a data structure that is much similar to SortedDictionary in C#
 * Except for minor differences.
 * 		1.	It can hold multiple values per key
 * 		2.	Binary search for insertion & deletion
 *
 * Complexity Notations:
 * 		# Get: O(1)
 * 		# Insert: O(log n)
 * 		# Delete: O(log n)
 */

type CompareFunction<K> = (a: K, b: K) => number;

// handles conversion of keys into strings if they aren't of a comparable type
function unify<A>(key: A): A {
	let t = typeof key;
	if (t === "number" || t === "string" || t === "bigint") {
		return key as any;
	} else return JSON.stringify([[[key]]]) as any;
}

export class Dictionary<D extends object> {
	keys: D[keyof D][] = [];
	documents: Map<D[keyof D], D[]> = new Map();
	comparator: CompareFunction<any>;
	fieldName: keyof D;
	unique: boolean = false;
	constructor({
		fieldName,
		unique,
		c,
	}: {
		fieldName: keyof D;
		unique: boolean;
		c: CompareFunction<D[keyof D]>;
	}) {
		this.fieldName = fieldName;
		this.comparator = c;
		this.unique = unique;
	}
	has(key: D[keyof D]) {
		return this.documents.has(unify(key));
	}
	insert(key: D[keyof D], document: D) {
		key = unify(key);
		if (this.documents.get(key) && this.unique) {
			const err = new Error(
				`XWebDB: Can't insert key ${key}, it violates the unique constraint`
			) as any;
			err.key = key;
			err.prop = this.fieldName;
			err.errorType = "uniqueViolated";
			throw err;
		}
		const index = this.findInsertionIndex(key);
		if (this.keys[index] !== key) {
			this.keys.splice(index, 0, key);
		}
		let list = this.documents.get(key);
		if (!list) {
			list = [];
			this.documents.set(key, list);
		}
		list.push(document);
	}
	get(key: D[keyof D] | D[keyof D][]): D[] {
		if (Array.isArray(key)) return key.map((x) => this.get(unify(x))).flat(1);
		return this.documents.get(unify(key)) || [];
	}
	public delete(key: D[keyof D], document: D): boolean {
		key = unify(key);
		const index = this.binarySearch(key);
		if (index === -1) {
			return false;
		}
		const bucket = this.documents.get(key) || [];
		bucket.splice(bucket.indexOf(document), 1);
		if (bucket.length === 0) {
			this.keys.splice(index, 1);
			this.documents.delete(key);
		}
		return true;
	}

	public findInsertionIndex(key: D[keyof D]): number {
		key = unify(key);
		let low = 0;
		let high = this.keys.length;
		while (low < high) {
			const mid = Math.floor((low + high) / 2);
			if (this.comparator(this.keys[mid], key) === -1) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}
		return low;
	}

	private binarySearch(key: D[keyof D]): number {
		key = unify(key);
		let low = 0;
		let high = this.keys.length - 1;
		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			if (this.comparator(this.keys[mid], key) === 0) {
				return mid;
			} else if (this.comparator(this.keys[mid], key) === -1) {
				low = mid + 1;
			} else {
				high = mid - 1;
			}
		}
		return -1;
	}

	$in(keys: D[keyof D][]): D[] {
		keys = keys.map((x) => unify(x));
		let matched: D[] = [];
		for (let index = 0; index < keys.length; index++) {
			let key = unify(keys[index]);
			matched = matched.concat(this.get(key));
		}
		return matched.filter((x, i) => matched.indexOf(x) === i);
	}

	$nin(dismissKeys: D[keyof D][]): D[] {
		dismissKeys = dismissKeys.map((x) => unify(x));
		let values: D[] = [];
		for (let index = 0; index < this.keys.length; index++) {
			let k = unify(this.keys[index]);
			if (!dismissKeys.includes(k)) values = values.concat(this.get(k));
		}
		return values;
	}
	$ne(dismissKey: D[keyof D]): D[] {
		dismissKey = unify(dismissKey);
		let values: D[] = [];
		for (let index = 0; index < this.keys.length; index++) {
			const k = unify(this.keys[index]);
			if (this.comparator(dismissKey, k) !== 0) values = values.concat(this.get(k));
		}
		return values;
	}
	betweenBounds(
		gt: D[keyof D],
		gtInclusive: boolean,
		lt: D[keyof D],
		ltInclusive: boolean
	): D[] {
		let startIndex = 0;
		let endIndex = this.keys.length - 1;
		let matchedIndexes: number[] = [];
		while (startIndex <= endIndex) {
			let midIndex = Math.floor((startIndex + endIndex) / 2);
			let current = this.keys[midIndex];
			if (current < gt || (!gtInclusive && current === gt)) {
				startIndex = midIndex + 1;
			} else if (current > lt || (!ltInclusive && current === lt)) {
				endIndex = midIndex - 1;
			} else {
				// Found a value in range
				matchedIndexes.push(midIndex);
				// Look for more values in range to the left of the current index
				for (let i = midIndex - 1; i >= startIndex; i--) {
					let current = this.keys[i];
					if (current < gt || (!gtInclusive && current === gt)) {
						break;
					}
					matchedIndexes.push(i);
				}
				// Look for more values in range to the right of the current index
				for (let i = midIndex + 1; i <= endIndex; i++) {
					let current = this.keys[i];
					if (current > lt || (!ltInclusive && current === lt)) {
						break;
					}
					matchedIndexes.push(i);
				}
				break;
			}
		}
		matchedIndexes.sort(this.comparator);
		let data: D[] = [];
		for (let i = 0; i < matchedIndexes.length; i++) {
			const foundIndex = matchedIndexes[i];
			data = data.concat(this.get(this.keys[foundIndex]));
		}
		return data;
	}
	boundedQuery(query: any) {
		return this.betweenBounds(
			query["$gt"] || query["$gte"],
			!!query["$gte"],
			query["$lt"] || query["$lte"],
			!!query["$lte"]
		);
	}
	get all(): D[] {
		return Array.from(this.documents.values()).flat();
	}
	get numberOfKeys() {
		return this.keys.length;
	}
	get size() {
		return this.all.length;
	}
}
