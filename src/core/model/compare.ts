import { Value } from "./common";

/**
 * compareNSB works for numbers, strings and booleans (for when both values have the same type)
 */
export type NSB = number | string | boolean;
export function compareNSB<T extends NSB>(a: T, b: T) {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
export function compareArrays(a: Value[], b: Value[]): 0 | 1 | -1 {
	for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
		let comp = compare(a[i], b[i]);
		if (comp !== 0) {
			return comp;
		}
	}
	// Common section was identical, longest one wins
	return compareNSB(a.length, b.length);
}
/**
 * Compare anything
 * type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
 * Return -1 if a < b, 1 if a > b and 0 if a === b
 * (note that equality here is NOT the same as defined in areThingsEqual!)
 */
export function compare(a: any, b: any): 0 | 1 | -1 {
	// undefined
	if (a === undefined) return b === undefined ? 0 : -1;
	if (b === undefined) return 1; // "a" is defined
	// null
	if (a === null) return b === null ? 0 : -1;
	if (b === null) return 1; // "a" isn't null or any of the above
	// other types
	let ta = typeof a;
	let tb = typeof b;
	// Numbers
	if (ta === "number") return typeof b === "number" ? compareNSB(a, b) : -1;
	if (tb === "number") return 1; // "a" isn't a number or any of the above
	// Strings
	if (ta === "string") return tb === "string" ? compareNSB(a, b) : -1;
	if (tb === "string") return 1; // "a" isn't a string or any of the above
	// Booleans
	if (ta === "boolean") return tb === "boolean" ? compareNSB(a, b) : -1;
	if (tb === "boolean") return 1; // "a" isn't a boolean or any of the above
	// Dates
	if (a instanceof Date) return b instanceof Date ? compareNSB(a.getTime(), b.getTime()) : -1;
	if (b instanceof Date) return 1; // "a" isn't Date or any of the above
	// Arrays (first element is most significant and so on)
	if (Array.isArray(a)) return Array.isArray(b) ? compareArrays(a, b) : -1;
	if (Array.isArray(b)) return 1; // "a" isn't an array or any of the above
	// Objects
	let aKeys = Object.keys(a).sort();
	let bKeys = Object.keys(b).sort();
	for (let i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
		let comp = compare(a[aKeys[i]], b[bKeys[i]]);
		if (comp !== 0) return comp; // first key wins
	}
	return compareNSB(aKeys.length, bKeys.length); // by keys length if common part is the same
}