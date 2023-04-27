import {
	comparable,
	equal,
	dotNotation,
	isPrimitiveType,
	keyedObject,
} from "./common";

interface ComparisonGroup {
	[key: string]: (a: any, b: any) => boolean;
}

const arrComparison: ComparisonGroup = {
	// Specific to arrays
	$size: function (arr, size) {
		if (!Array.isArray(arr)) return false;
		if (typeof size !== "number" || size % 1 !== 0)
			throw new Error("XWebDB: $size operator called without an integer");
		return arr.length === size;
	},
	$elemMatch: function (obj: any[], value) {
		if (!Array.isArray(obj)) return false;
		let i = obj.length;
		while (i--) if (match(obj[i], value)) return true;
		return false;
	},
	$all: function (a, b) {
		if (!Array.isArray(a))
			throw new Error("XWebDB: $all must be applied on fields of type array");
		if (!Array.isArray(b))
			throw new Error("XWebDB: $all must be supplied with argument of type array");
		for (let i = 0; i < b.length; i++) if (a.indexOf(b[i]) === -1) return false;
		return true;
	},
};

const comparisonFunctions: ComparisonGroup = {
	$type: function (a, b: any) {
		if (["number", "boolean", "string", "undefined"].indexOf(b) > -1) return typeof a === b;
		else if (b === "array") return Array.isArray(a);
		else if (b === "null") return a === null;
		else if (b === "date") return a instanceof Date;
		else if (b === "object")
			return (
				typeof a === "object" &&
				!(a instanceof Date) &&
				!(a === null) &&
				!Array.isArray(a)
			);
		else return false;
	},
	$not: (a, b) => !match({ k: a }, { k: b }),
	$eq: (a, b) => equal(a, b),
	$lt: (a, b) => comparable(a, b) && a < b,
	$lte: (a, b) => comparable(a, b) && a <= b,
	$gt: (a, b) => comparable(a, b) && a > b,
	$gte: (a, b) => comparable(a, b) && a >= b,
	$mod: function (a: any, b: any) {
		if (!Array.isArray(b)) {
			throw new Error("XWebDB: malformed mod, must be supplied with an array");
		}
		if (b.length !== 2) {
			throw new Error(
				"XWebDB: malformed mod, array length must be exactly two, a divisor and a remainder"
			);
		}
		return a % b[0] === b[1];
	},
	$ne: function (a, b) {
		if (a === undefined) return true;
		return !equal(a, b);
	},
	$in: function (a, b) {
		if (!Array.isArray(b)) throw new Error("XWebDB: $in operator called with a non-array");
		for (let i = 0; i < b.length; i += 1) if (equal(a, b[i])) return true;
		return false;
	},
	$nin: function (a, b) {
		if (!Array.isArray(b)) throw new Error("XWebDB: $nin operator called with a non-array");
		return !comparisonFunctions.$in(a, b);
	},
	$regex: function (a, b) {
		if (!(b instanceof RegExp))
			throw new Error("XWebDB: $regex operator called with non regular expression");
		if (typeof a !== "string") return false;
		else return b.test(a);
	},
	$exists: function (value, exists) {
		if (exists || exists === "") exists = true;
		else exists = false;
		if (value === undefined) return !exists;
		else return exists;
	},
	...arrComparison,
};

function logicalOperator(operator: "$or" | "$nor" | "$and", obj: any, query: any[]) {
	if (!Array.isArray(query)) {
		throw new Error("XWebDB: $or/$nor/$and operators should be used with an array");
	}
	for (let i = 0; i < query.length; i += 1) {
		const matched = match(obj, query[i]);
		if (matched) {
			if (operator === "$or") return true;
			if (operator === "$nor") return false;
		} else if (operator === "$and") return false;
	}
	return operator === "$or" ? false : true;
}
const logicalOperators: keyedObject<(obj: any, query: any[]) => boolean> = {
	$and: (obj, query) => logicalOperator("$and", obj, query),
	$nor: (obj, query) => logicalOperator("$nor", obj, query),
	$or: (obj, query) => logicalOperator("$or", obj, query),
	$where: (obj, fn) => {
		if (typeof fn !== "function")
			throw new Error("XWebDB: $where operator used without a function");
		let result = (fn as any).call(obj);
		if (typeof result !== "boolean")
			throw new Error("XWebDB: $where function must return boolean");
		return result;
	},
};

export function match(obj: any, query: any): boolean {
	// edge-case: if query contains $operators that are comparison
	// then it should be treated as if it's a pr
	// this enables queries like: $eq $ne to be applied to objects
	let fieldLevel$ = false;
	let queryKeys = Object.keys(query);
	for (let index = 0; index < queryKeys.length; index++) {
		const key = queryKeys[index];
		if (comparisonFunctions[key]) {
			fieldLevel$ = true;
			break;
		}
	}

	// Primitive query against a primitive type
	if (isPrimitiveType(obj) || isPrimitiveType(query) || fieldLevel$)
		return matchSegment({ TMP: obj }, "TMP", query);
	// Normal query
	for (let i = 0; i < queryKeys.length; i += 1) {
		let queryKey = queryKeys[i];
		let queryValue = query[queryKey];
		if (queryKey[0] === "$") {
			let logOperatorF = logicalOperators[queryKey];
			if (!logOperatorF) throw new Error("XWebDB: Unknown logical operator " + queryKey);
			if (!logOperatorF(obj, queryValue)) return false;
		} else if (!matchSegment(obj, queryKey, queryValue)) return false;
	}
	return true;
}

/**
 * Match an object against a specific { key: value } part of a query
 * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
 */
function matchSegment(
	obj: any,
	queryKey: string,
	qVal: any,
	treatObjAsValue?: boolean
): boolean {
	const oVal = dotNotation(obj, queryKey);
	/**
	 * A. Dealing with arrays, unless forced to be treated as a values
	 * oVal = [1,2,3]
	 * if qVal = [1,2,3] .. we should skip this and go to an exact match
	 * if qVal is an object:
	 * 						1. is there an array comparison function? -> we should skip this and go to (B)
	 * 						e.g. qVal = { $size: 1 } // find a document that has a specified array of size 1
	 * 						2. there's a $ne/$nin check against values one by one (MongoDB behaves like this check: https://stackoverflow.com/questions/10907843/mongo-ne-query-with-an-array-not-working-as-expected for explanation)
	 * 						e.g. qVal = { $ne: 2 } // find a document that has a specified array that doesn't have an element "2"
	 * 						3. then match each element of the array and one of them must match, if none matches return false
	 * 						e.g. qVal = { $eq: 3 } // find a document that has a specified array that has an element "3"
	 */
	if (Array.isArray(oVal) && !treatObjAsValue) {
		// If the queryValue is an array, try to perform an exact match
		// e.g. qVal = {a: [1,2,3]} where oVal = [1,2,3] 
		if (Array.isArray(qVal)) return matchSegment(obj, queryKey, qVal, true);
		// Check if we are using an array-specific comparison function
		// e.g. qVal = {a: { $size: 3 }}
		if (qVal !== null && typeof qVal === "object" && !(qVal instanceof RegExp)) {
			let keys = Object.keys(qVal);
			for (let i = 0; i < keys.length; i += 1) {
				if (arrComparison[keys[i]]) {
					return matchSegment(obj, queryKey, qVal, true);
				}
			}
		}
		// edge case: using $ne on array
		if (qVal["$ne"]) if (oVal.indexOf(qVal["$ne"]) !== -1) return false;
		// edge case: using $nin on array
		if (Array.isArray(qVal["$nin"]))
			if (qVal["$nin"].filter((v: any) => -1 !== oVal.indexOf(v)).length) return false;
		// If not, treat it as an array of { obj, query } where there needs to be at least one match
		for (let i = 0; i < oVal.length; i += 1)
			if (matchSegment({ TMP: oVal[i] }, "TMP", qVal)) return true;
		return false;
	}

	/**
	 * B. Dealing with objects of $operators: queryValue is an actual object.
	 * e.g. qVal = { $lt: 1 }
	 * 			If there's $operator + regular fields, will throw an error
	 * 			If there's no $operator will skip this block and go to basic matching
	 */
	if (
		typeof qVal === "object" &&
		qVal !== null &&
		!(qVal instanceof RegExp) &&
		!Array.isArray(qVal)
	) {
		let keys = Object.keys(qVal);
		let firstChars = keys.map((item) => item[0]);
		let dollarFirstChars = firstChars.filter((c) => c === "$");
		if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length) {
			throw new Error("XWebDB: You cannot mix operators and normal fields");
		}
		if (dollarFirstChars.length > 0) {
			for (let i = 0; i < keys.length; i += 1) {
				if (!comparisonFunctions[keys[i]]) {
					throw new Error("XWebDB: Unknown comparison function " + keys[i]);
				}
				if (!comparisonFunctions[keys[i]](oVal, qVal[keys[i]])) {
					return false;
				}
			}
			return true;
		}
	}

	/**
	 * C. Dealing with RegExp
	 * e.g. { a: /abc/ }
	 */
	if (qVal instanceof RegExp) {
		return comparisonFunctions.$regex(oVal, qVal);
	}

	/**
	 * D. Basic equality matching
	 * e.g. { n: 12 }
	 * e.g. { a: [ 1, 2, 3 ] }
	 * e.g. { o: { k:1 } }
	 */
	if (!equal(oVal, qVal)) {
		return false;
	}

	return true;
}
