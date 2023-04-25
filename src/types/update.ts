import { Keys, Partial } from "./common";
import { FieldLevelQueryOperators } from "./filter";
import { RecursivePartial, NFGP, NFP } from "./common";

export interface PushModifiers<V> {
	/**
	 * Modifies the $push and $addToSet operators to append multiple items for array updates.
	 * { ($addToSet|$push): { <field>: { $each: [ <value1>, <value2> ... ] } } }
	 */
	$each: V[];

	/**
	 * Modifies the $push operator to limit the size of updated arrays.
	 * {$push: {<field>: {$each: [ <value1>, <value2>, ... ],$slice: <num>}}}
	 */
	$slice?: number;

	/**
	 * The $sort modifier orders the elements of an array during a $push operation. To use the $sort modifier, it must appear with the $each modifier.
	 * You can pass an empty array [] to the $each modifier such that only the $sort modifier has an effect.
	 * {$push: {<field>: {$each: [ <value1>, <value2>, ... ],$sort: <sort specification>}}}
	 */
	$sort?: 1 | -1 | Partial<{ [Key in Keys<V>]: 1 | -1 }>;

	/**
	 * The $position modifier specifies the location in the array at which the $push operator insert elements. Without the $position modifier, the $push operator inserts elements to the end of the array.
	 */
	$position?: number;
}

export interface UpsertOperators<A, S = NFP<A>> extends UpdateOperators<A> {
	/**
	 * If an update operation with upsert: true results in an insert of a document, then $setOnInsert assigns the specified values to the fields in the document. If the update operation does not result in an insert, $setOnInsert does nothing.
	 * { $setOnInsert: { <field1>: <value1>, ... } },
	 *
	 */
	$setOnInsert?: S;
}

type $DeepSpecific<S, V> = {
	[P in keyof S]?: S[P] extends Array<any>
		?
				| {
						[index: number]: $DeepSpecific<S[P][0], V> | V;
				  }
				| V
		: S[P] extends object
		? $DeepSpecific<S[P], V> | V
		: V;
};

type $DeepSet<S> = {
	[P in keyof S]?: S[P] extends Array<any>
		? { [index: number]: $DeepSet<S[P][0]> | S[P][0] } | S[P]
		: S[P] extends object
		? $DeepSet<S[P]> | S[P]
		: S[P];
};

type $DeepNum<Main> = {
	[Key in keyof Main]?: Main[Key] extends Array<any>
		? { [index: number]: $DeepNum<Main[Key][0]> }
		: Main[Key] extends object
		? $DeepNum<Main[Key]>
		: Main[Key] extends number
		? number
		: never;
};

type $DeepMinMax<Main> = {
	[Key in keyof Main]?: Main[Key] extends Array<any>
		? { [index: number]: $DeepMinMax<Main[Key][0]> }
		: Main[Key] extends object
		? $DeepMinMax<Main[Key]>
		: Main[Key] extends number
		? Main[Key]
		: Main[Key] extends Date
		? Main[Key]
		: never;
};

type $DeepCurrentDate<Main> = {
	[Key in keyof Main]?: Main[Key] extends Array<any>
		? {
				[index: number]: $DeepCurrentDate<Main[Key][0]>;
		  }
		: Main[Key] extends Date
		?
				| true
				| {
						$type: "date";
				  }
		: Main[Key] extends object
		? $DeepCurrentDate<Main[Key]>
		: Main[Key] extends number
		? {
				$type: "timestamp";
		  }
		: never;
};

export interface UpdateOperators<A, S = NFGP<A>, D = NFP<A>> {
	/**
	 * Sets the value of a field in a document.
	 * { $set: { <field1>: <value1>, ... } }
	 */
	$set?: Partial<
		S & {
			$deep: $DeepSet<S>;
		}
	>;
	/**
	 * Removes the specified field from a document.
	 * { $unset: { <field1>: "", ... } }
	 */
	$unset?: Partial<
		{ [key in Keys<S>]: "" } & {
			$deep: $DeepSpecific<S, "">;
		}
	>;
	/**
	 * Increments the value of the field by the specified amount.
	 * { $inc: { <field1>: <amount1>, <field2>: <amount2>, ... } }
	 */
	$inc?: Partial<
		{
			[Key in Keys<S>]: S[Key] extends number ? number : never;
		} & { $deep: $DeepNum<S> }
	>;
	/**
	 * Multiplies the value of the field by the specified amount.
	 * { $mul: { field: <number> } }
	 */
	$mul?: Partial<
		{
			[Key in Keys<S>]: S[Key] extends number ? number : never;
		} & { $deep: $DeepNum<S> }
	>;
	/**
	 * Renames a field.
	 * {$rename: { <field1>: <newName1>, <field2>: <newName2>, ... } }
	 */
	$rename?: Partial<
		UpdateOperatorsOnSchema<S, string> & {
			$deep: $DeepSpecific<S, string>;
		}
	>;
	/**
	 * Only updates the field if the specified value is less than the existing field value.
	 * { $min: { <field1>: <value1>, ... } }
	 */
	$min?: Partial<
		{
			[Key in Keys<S>]: S[Key] extends number
				? S[Key]
				: S[Key] extends Date
				? S[Key]
				: never;
		} & { $deep: $DeepMinMax<S> }
	>;
	/**
	 * Only updates the field if the specified value is greater than the existing field value.
	 * { $max: { <field1>: <value1>, ... } }
	 */
	$max?: Partial<
		{
			[Key in Keys<S>]: S[Key] extends number
				? S[Key]
				: S[Key] extends Date
				? S[Key]
				: never;
		} & { $deep: $DeepMinMax<S> }
	>;
	/**
	 * Sets the value of a field to current date, either as a Date or a Timestamp.
	 * { $currentDate: { <field1>: <typeSpecification1>, ... } }
	 */
	$currentDate?: Partial<
		{
			[Key in Keys<D>]: D[Key] extends Date
				? true | { $type: "date" }
				: D[Key] extends number
				? { $type: "timestamp" }
				: never;
		} & { $deep: $DeepCurrentDate<D> }
	>;
	/**
	 * Adds elements to an array only if they do not already exist in the set.
	 * { $addToSet: { <field1>: <value1>, ... } }
	 */
	//TODO: implement $deep on the operators and modifiers below
	$addToSet?: Partial<{
		[Key in Keys<S>]: S[Key] extends Array<infer U>
			?
					| U
					| {
							$each: U[];
					  }
			: never;
	}>;
	/**
	 * The $pop operator removes the first or last element of an array. Pass $pop a value of -1 to remove the first element of an array and 1 to remove the last element in an array.
	 * { $pop: { <field>: <-1 | 1>, ... } }
	 */
	$pop?: Partial<{
		[Key in Keys<S>]: S[Key] extends Array<infer U> ? -1 | 1 : never;
	}>;
	/**
	 * Removes all array elements that match a specified query.
	 * { $pull: { <field1>: <value|condition>, <field2>: <value|condition>, ... } }
	 */
	$pull?: Partial<{
		[Key in Keys<S>]: S[Key] extends Array<infer U>
			? Partial<U> | FieldLevelQueryOperators<U>
			: never;
	}>;
	/**
	 * The $pullAll operator removes all instances of the specified values from an existing array. Unlike the $pull operator that removes elements by specifying a query, $pullAll removes elements that match the listed values.
	 * { $pullAll: { <field1>: [ <value1>, <value2> ... ], ... } }
	 */
	$pullAll?: Partial<{
		[Key in Keys<S>]: S[Key] extends Array<infer U> ? U[] : never;
	}>;
	/**
	 * The $push operator appends a specified value to an array.
	 * { $push: { <field1>: <value1>, ... } }
	 */
	$push?: Partial<{
		[Key in Keys<S>]: S[Key] extends Array<infer U>
			? U | PushModifiers<U>
			: never;
	}>;
}

export type UpdateOperatorsOnSchema<S, V> = Partial<{ [key in Keys<S>]: V }>;
