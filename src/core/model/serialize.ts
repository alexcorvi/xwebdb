import { validateKey } from "./common";

/**
 * Serialize an object to be persisted to a one-line string
 * Accepted primitive types: Number, String, Boolean, Date, null
 * Accepted secondary types: Objects, Arrays
 */
export function serialize<T>(obj: T, ignoreCheckKey: boolean = false): string {
	return JSON.stringify(obj, function (key, value) {
		if(!ignoreCheckKey) validateKey(key, value);
		if (value === undefined) return undefined;
		if (value === null) return null;
		if (typeof this[key].getTime === "function") return { $$date: this[key].getTime() };
		return value;
	});
}

/**
 * From a one-line representation of an object generate by the serialize function
 * Return the object itself
 */
export function deserialize(rawData: string) {
	return JSON.parse(rawData, function (key, val) {
		if (key === "$$date") return new Date(val);
		let t = typeof val;
		if (t === "string" || t === "number" || t === "boolean" || val === null) return val;
		if (val && val.$$date) return val.$$date;
		return val;
	});
}