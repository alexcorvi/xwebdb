import { Doc } from "../../types";
import { serialize } from "./serialize";

export interface keyedObject<G = Value> {
	[key: string]: G;
}

export type PrimitiveValue = number | string | boolean | undefined | null | Date;
export type Value = Doc | keyedObject | Array<PrimitiveValue | keyedObject> | PrimitiveValue;

/**
 * Check a key throw an error if the key is non valid
 */
export function validateKey(key: string | number, v: Value) {
	if (typeof key === "number") key = key.toString();
	if (
		key[0] === "$" &&
		!(key === "$$date" && typeof v === "number") &&
		!(key === "$$deleted" && v === true) &&
		!(key === "$$indexCreated") &&
		!(key === "$$indexRemoved")
	)
		throw new Error("XWebDB: Field names cannot begin with the $ character");

	if (key.indexOf(".") !== -1) throw new Error("XWebDB: Field names cannot contain a .");
}

/**
 * Check a DB object and throw an error if it's not valid
 * Works by applying the above checkKey function to all fields recursively
 */
export function validateObject(obj: Value) {
	if (Array.isArray(obj)) obj.forEach((sub) => validateObject(sub));
	else if (isKeyedObject(obj) && !(obj instanceof Date))
		for (const [key, value] of Object.entries(obj)) {
			validateKey(key, value);
			validateObject(value);
		}
}

/**
 * Tells if an object is a primitive type or a "real" object
 * Arrays are considered primitive
 */
export function isPrimitiveType(obj: Value) {
	return !isKeyedObject(obj);
}

export function isKeyedObject(obj: Value): obj is keyedObject {
	return (
		typeof obj === "object" && obj !== null && !(obj instanceof Date) && !Array.isArray(obj)
	);
}

/**
 * Deep copy a DB object
 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
 * where the keys are valid, i.e. don't begin with $ and don't contain a dot
 */
export function clone<T>(obj: T, model: typeof Doc, strictKeys: boolean = false): T {
	let t = typeof obj;
	if (t === "boolean" || t === "number" || t === "string") return obj;
	if (obj === null || obj instanceof Date) return obj;
	if (Array.isArray(obj)) return obj.map((sub) => clone(sub, model, strictKeys)) as any;
	if (typeof obj === "object") {
		let res: keyedObject = {};
		Object.entries(obj).forEach(([key, val]) => {
			if (!strictKeys || (key[0] !== "$" && key.indexOf(".") === -1)) {
				res[key] = clone(val, model, strictKeys);
			}
		});
		if (res.hasOwnProperty("_id")) {
			return model.new(res) as any;
		} else {
			return res as any;
		}
	}
	return JSON.parse(JSON.stringify({ temp: obj })).temp;
}

export function dotNotation(obj: any, field: string | string[]): any {
	const fieldParts = typeof field === "string" ? field.split(".") : field;
	// field cannot be empty so that means we should return undefined so that nothing can match
	if (!obj) return undefined;
	if (fieldParts.length === 0) return obj;
	// got it
	if (fieldParts.length === 1) return obj[fieldParts[0]];
	if (Array.isArray(obj[fieldParts[0]])) {
		// If the next field is an integer, return only this item of the array
		let i = parseInt(fieldParts[1], 10);
		if (typeof i === "number" && !isNaN(i)) {
			return dotNotation(obj[fieldParts[0]][i], fieldParts.slice(2));
		}
		// Return the array of values
		let objects = new Array();
		for (let i = 0; i < obj[fieldParts[0]].length; i += 1) {
			objects.push(dotNotation(obj[fieldParts[0]][i], fieldParts.slice(1)));
		}
		return objects;
	} else {
		return dotNotation(obj[fieldParts[0]], fieldParts.slice(1));
	}
}

export function equal<A, B>(a: A, b: B): boolean {
	let ta = typeof a;
	let tb = typeof b;
	// Strings, booleans, numbers, null
	if (a === null || ta === "string" || ta === "boolean" || ta === "number")
		return a === (b as any);
	if (b === null || tb === "string" || tb === "boolean" || tb === "number")
		return a === (b as any);
	// Dates
	if (a instanceof Date || b instanceof Date) {
		return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	}
	// Arrays (no match since arrays are used as a $in)
	// undefined (no match since they mean field doesn't exist and can't be serialized)
	if (
		(!(Array.isArray(a) && Array.isArray(b)) && (Array.isArray(a) || Array.isArray(b))) ||
		a === undefined ||
		b === undefined
	) {
		return false;
	}
	// objects are checked by serialization, placing inside temp to prevent any possible runtime errors
	let aS = serialize({ temp: a }, true);
	let bS = serialize({ temp: b }, true);
	return aS === bS;
}

export function comparable<T, D>(a: T, b: D): boolean {
	let ta = typeof a;
	let tb = typeof b;
	if (
		ta !== "string" &&
		ta !== "number" &&
		tb !== "string" &&
		tb !== "number" &&
		!(a instanceof Date) &&
		!(b instanceof Date)
	) {
		return false;
	}
	if (ta !== tb) {
		return false;
	}
	return true;
}
