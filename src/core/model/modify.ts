import { Doc } from "../../types";
import { Value, clone, keyedObject, validateObject } from "./common";
import { compare } from "./compare";
import { match } from "./match";

interface ModifierGroup {
	[key: string]: (obj: keyedObject<any>, field: string, value: any) => void;
}

/**
 * The signature of modifier functions is as follows
 * Their structure is always the same: recursively follow the dot notation while creating
 * the nested documents if needed, then apply the "last step modifier"
 * to know what each operator does: https://www.mongodb.com/docs/manual/reference/operator/update/
 */

const lastStepModifierFunctions: ModifierGroup = {
	$set: function (obj: keyedObject, field: string, value: Value) {
		if (!obj) return;
		obj[field] = value;
	},
	$mul: function (obj: keyedObject<number>, field: string, value: Value) {
		let base = obj[field];
		if (typeof value !== "number" || typeof base !== "number") {
			throw new Error("XWebDB: Multiply operator works only on numbers");
		}
		obj[field] = base * value;
	},
	$unset: function (obj: keyedObject, field: number | string) {
		if (Array.isArray(obj)) {
			obj.splice(Number(field), 1);
			return;
		}
		delete obj[field];
	},
	$push: function (obj: keyedObject<Value[]>, field: string, query: any) {
		// Setup
		if (!obj.hasOwnProperty(field)) obj[field] = [];
		if (!Array.isArray(obj[field]))
			throw new Error("XWebDB: Can't $push an element on non-array values");
		if (
			query !== null &&
			typeof query === "object" &&
			query.$slice &&
			query.$each === undefined
		)
			query.$each = [];

		// with modifiers
		if (query !== null && typeof query === "object" && query.$each) {
			const eachVal = query.$each;
			const sliceVal = query.$slice;
			const posVal = query.$position;
			const sortVal = query.$sort;
			const allKeys = Object.keys(query);
			// checking modifiers
			if (
				allKeys.length > 1 &&
				allKeys.filter((x) => {
					return ["$each", "$slice", "$position", "$sort"].indexOf(x) === -1;
				}).length
			)
				throw new Error(
					"XWebDB: Can only use the known modifiers $slice, $position and $sort in conjunction with $each when $push to array"
				);
			else if (!Array.isArray(eachVal))
				throw new Error("XWebDB: $each requires an array value");
			else if (sliceVal !== undefined && typeof sliceVal !== "number")
				throw new Error("XWebDB: $slice requires a number value");

			// pushing with $position
			if (posVal)
				for (let i = 0; i < eachVal.length; i++)
					obj[field].splice(posVal + i, 0, eachVal[i]);
			// pushing without $position
			else eachVal.forEach((v) => obj[field].push(v));

			// $applying sort
			if (sortVal) {
				if (typeof sortVal === "number") {
					if (sortVal === 1) obj[field].sort((a, b) => compare(a, b));
					else obj[field].sort((a, b) => compare(b, a));
				} else {
					obj[field].sort((a: any, b: any) => {
						const keys = Object.keys(sortVal);
						for (let i = 0; i < keys.length; i++) {
							const key = keys[i];
							const order = (sortVal as any)[key];
							if (order === 1) {
								const comp = compare(a[key], b[key]);
								if (comp) return comp;
							} else {
								const comp = compare(b[key], a[key]);
								if (comp) return comp;
							}
						}
						return 0;
					});
				}
			}

			// applying $slice
			if (sliceVal === 0) {
				obj[field] = [];
			} else if (typeof sliceVal === "number") {
				let start = 0;
				let end = 0;
				let n = obj[field].length;
				if (sliceVal < 0) {
					start = Math.max(0, n + sliceVal);
					end = n;
				} else if (sliceVal > 0) {
					start = 0;
					end = Math.min(n, sliceVal);
				}
				obj[field] = obj[field].slice(start, end);
			}
		}
		// without modifiers
		else {
			obj[field].push(query);
		}
	},
	$addToSet: function (obj: keyedObject<Value[]>, field: string, query: any) {
		// setup
		if (!obj.hasOwnProperty(field)) {
			obj[field] = [];
		}
		if (!Array.isArray(obj[field])) {
			throw new Error("XWebDB: Can't $addToSet an element on non-array values");
		}
		const eachVal = query ? query.$each : undefined;
		// adding
		if (query !== null && typeof query === "object" && eachVal) {
			if (Object.keys(query).length > 1)
				throw new Error(
					"XWebDB: Can't use another field in conjunction with $each on $addToSet modifier"
				);
			if (!Array.isArray(eachVal))
				throw new Error("XWebDB: $each requires an array value");
			eachVal.forEach((val) => lastStepModifierFunctions.$addToSet(obj, field, val));
		} else {
			let addToSet = true;
			for (let index = 0; index < obj[field].length; index++) {
				const element = obj[field][index];
				if (compare(element, query) === 0) {
					addToSet = false;
					break;
				}
			}
			if (addToSet) {
				obj[field].push(query);
			}
		}
	},
	$pop: function (obj: keyedObject<Value[]>, field: string, value: number) {
		if (!Array.isArray(obj[field]))
			throw new Error("XWebDB: Can't $pop an element from non-array values");
		if (typeof value !== "number" || value % 1 !== 0)
			throw new Error("XWebDB: " + value + " isn't an integer, can't use it with $pop");
		if (value === 0) return;
		if (value > 0) obj[field] = obj[field].slice(0, obj[field].length - 1);
		else obj[field] = obj[field].slice(1);
	},
	$pull: function (obj: keyedObject<Value[]>, field: string, value: Value) {
		if (!Array.isArray(obj[field]))
			throw new Error("XWebDB: Can't $pull an element from non-array values");
		let arr = obj[field];
		for (let i = arr.length - 1; i >= 0; i -= 1) if (match(arr[i], value)) arr.splice(i, 1);
	},
	$pullAll: function (obj: keyedObject<Value[]>, field: string, value: Array<any>) {
		if (!Array.isArray(obj[field]))
			throw new Error("XWebDB: Can't $pull an element from non-array values");
		let arr = obj[field];
		for (let i = arr.length - 1; i >= 0; i -= 1)
			for (let j = 0; j < value.length; j++)
				if (match(arr[i], value[j])) arr.splice(i, 1);
	},
	$inc: function (obj: keyedObject<number>, field: string, value: Value) {
		if (typeof value !== "number")
			throw new Error("XWebDB: " + value + " must be a number");
		if (typeof obj[field] !== "number") {
			if (!obj.hasOwnProperty(field)) obj[field] = value;
			else throw new Error("XWebDB: Can't use the $inc modifier on non-number fields");
		} else obj[field] = obj[field] + value;
	},
	$max: function (obj: keyedObject<number>, field: string, value: number) {
		if (typeof obj[field] === "undefined") obj[field] = value;
		else if (value > obj[field]) obj[field] = value;
	},
	$min: function (obj: keyedObject<number>, field: string, value: number) {
		if (typeof obj[field] === "undefined") obj[field] = value;
		else if (value < obj[field]) obj[field] = value;
	},
	$currentDate: function (obj: keyedObject<any>, field: string, value: any) {
		if (value === true) obj[field] = new Date();
		else if (value.$type && value.$type === "timestamp") obj[field] = Date.now();
		else if (value.$type && value.$type === "date") obj[field] = new Date();
		else throw new Error("XWebDB: Malformed $currentDate update query");
	},
	$rename: function (obj: keyedObject<any>, field: string, value: any) {
		if (Array.isArray(obj)) {
			// this is not supported by MongoDB
			// However, I've decided to support it
			let to = Number(value);
			let from = Number(field);
			obj.splice(to, 0, obj.splice(from, 1)[0]);
			return;
		}
		obj[value] = obj[field];
		delete obj[field];
	},
	$setOnInsert: function () {
		// if the operator reached here
		// it means that the update was not actually an insertion.
		// this operator is being dealt with at the datastore.ts file
	},
};

// to work down on $operators with dot notation (or not)
// we have to chase down the field recursively until not "." exists in it
// this is done throw this singleton and function
const modifierFunctions: ModifierGroup = {};
export const modifiersKeys = Object.keys(lastStepModifierFunctions);
for (let index = 0; index < modifiersKeys.length; index++) {
	const $name = modifiersKeys[index];
	modifierFunctions[$name] = (obj: any, field: string, query: any) => {
		var fieldParts = typeof field === "string" ? field.split(".") : field;
		// reached target
		if (fieldParts.length === 1) {
			lastStepModifierFunctions[$name](obj, field, query);
		}
		// still following dot notation
		else {
			if (obj[fieldParts[0]] === undefined) {
				if ($name === "$unset") return; // already unset
				obj[fieldParts[0]] = {}; // create it
			}
			let next = fieldParts.slice(1).join(".");
			modifierFunctions[$name](obj[fieldParts[0]], next, query);
		}
	};
}

/**
 * Modify a DB object according to an update query
 */
export function modify<G extends Doc, C extends typeof Doc>(
	obj: G,
	updateQuery: any,
	model: C
): G {
	const keys = Object.keys(updateQuery);
	const firstChars = keys.map((x) => x.charAt(0));
	const dollarFirstChars = firstChars.filter((x) => x === "$");
	if (keys.indexOf("_id") !== -1 && updateQuery._id !== obj._id)
		throw new Error("XWebDB: You cannot change a document's _id");
	if (dollarFirstChars.length !== 0 && dollarFirstChars.length !== firstChars.length)
		throw new Error("XWebDB: You cannot mix modifiers and normal fields");
	let newDoc: G;
	if (dollarFirstChars.length === 0) {
		// Simply replace the object with the update query contents
		newDoc = clone(updateQuery, model);
		newDoc._id = obj._id;
	} else {
		// Apply modifiers
		const modifiers = Array.from(new Set(keys));
		newDoc = clone(obj, model);
		for (let index = 0; index < modifiers.length; index++) {
			const modifier = modifiers[index];
			const modArgument = updateQuery[modifier];
			if (!modifierFunctions[modifier])
				throw new Error("XWebDB: Unknown modifier " + modifier);
			if (typeof modArgument !== "object")
				throw new Error("XWebDB: Modifier " + modifier + "'s query must be an object");
			const fields = Object.keys(modArgument);
			for (let index = 0; index < fields.length; index++) {
				const field = fields[index];
				modifierFunctions[modifier](newDoc, field, modArgument[field]);
			}
		}
	}
	// Check result is valid and return it
	validateObject(newDoc);
	if (obj._id !== newDoc._id) throw new Error("XWebDB: You cannot change a document's _id");
	return newDoc;
}
