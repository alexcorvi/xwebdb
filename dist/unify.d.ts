import { UseStore } from "idb-keyval";
import Q from "p-queue";
/**
 * @license
 * Copyright Daniel Imms <http://www.growingwiththeweb.com>
 * Released under MIT license. See LICENSE in the project root for details.
 */
type CompareFunction<K> = (a: K, b: K) => number;
declare class Node<K, V> {
    left: Node<K, V> | null;
    right: Node<K, V> | null;
    height: number | null;
    value: V[];
    key: K;
    /**
     * Creates a new AVL Tree node.
     * @param key The key of the new node.
     * @param value The value of the new node.
     */
    constructor(key: K, value: V);
    /**
     * Performs a right rotate on this node.
     * @return The root of the sub-tree; the node where this node used to be.
     * @throws If Node.left is null.
     */
    rotateRight(): Node<K, V>;
    /**
     * Performs a left rotate on this node.
     * @return The root of the sub-tree; the node where this node used to be.
     * @throws If Node.right is null.
     */
    rotateLeft(): Node<K, V>;
    /**
     * Convenience function to get the height of the left child of the node,
     * returning -1 if the node is null.
     * @return The height of the left child, or -1 if it doesn't exist.
     */
    get leftHeight(): number;
    /**
     * Convenience function to get the height of the right child of the node,
     * returning -1 if the node is null.
     * @return The height of the right child, or -1 if it doesn't exist.
     */
    get rightHeight(): number;
    executeOnEveryNode(fn: (node: Node<K, V>) => void): void;
    /**
     * Get all data for a key between bounds
     * Return it in key order
     */
    betweenBounds(query: any, lbm: Node<K, V>["getLowerBoundMatcher"], ubm: Node<K, V>["getLowerBoundMatcher"]): V[];
    /**
     * Return a function that tells whether a given key matches a lower bound
     */
    getLowerBoundMatcher(query: any): (key: K) => boolean;
    /**
     * Return a function that tells whether a given key matches an upper bound
     */
    getUpperBoundMatcher(query: any): (key: K) => boolean;
    private compareKeys;
    numberOfKeys(): number;
} /**
 * Represents how balanced a node's left and right children are.
 */
/**
 * Represents how balanced a node's left and right children are.
 */
/**
 * Represents how balanced a node's left and right children are.
 */
/**
 * Represents how balanced a node's left and right children are.
 */
declare class AvlTree<K, V> {
    protected _root: Node<K, V> | null;
    private _size;
    private _compare;
    unique: boolean;
    /**
     * Creates a new AVL Tree.
     * @param _compare An optional custom compare function.
     */
    constructor(compare?: CompareFunction<K>, unique?: boolean);
    /**
     * Compares two keys with each other.
     * @param a The first key to compare.
     * @param b The second key to compare.
     * @return -1, 0 or 1 if a < b, a == b or a > b respectively.
     */
    private _defaultCompare;
    /**
     * Inserts a new node with a specific key into the tree.
     * @param key The key being inserted.
     * @param value The value being inserted.
     */
    insert(key: K, value: V): void;
    /**
     * Inserts a new node with a specific key into the tree.
     * @param key The key being inserted.
     * @param root The root of the tree to insert in.
     * @return The new tree root.
     */
    private _insert;
    /**
     * Deletes a node with a specific key from the tree.
     * @param key The key being deleted.
     */
    delete(key: K, doc: V): void;
    /**
     * Deletes a node with a specific key from the tree.
     * @param key The key being deleted.
     * @param root The root of the tree to delete from.
     * @return The new tree root.
     */
    private _delete;
    /**
     * Gets the value of a node within the tree with a specific key.
     * @param key The key being searched for.
     * @return The value of the node (which may be undefined), or null if it
     * doesn't exist.
     */
    get(key: K): V[];
    /**
     * Gets the value of a node within the tree with a specific key.
     * @param key The key being searched for.
     * @param root The root of the tree to search in.
     * @return The value of the node or null if it doesn't exist.
     */
    private _get;
    /**
     * Gets whether a node with a specific key is within the tree.
     * @param key The key being searched for.
     * @return Whether a node with the key exists.
     */
    contains(key: K): boolean;
    /**
     * @return The minimum key in the tree or null if there are no nodes.
     */
    findMinimum(): K | null;
    /**
     * Gets the maximum key in the tree or null if there are no nodes.
     */
    findMaximum(): K | null;
    get numberOfKeys(): number;
    /**
     * Gets the size of the tree.
     */
    get size(): number;
    /**
     * Gets whether the tree is empty.
     */
    get isEmpty(): boolean;
    /**
     * Gets the minimum value node, rooted in a particular node.
     * @param root The node to search.
     * @return The node with the minimum key in the tree.
     */
    private _minValueNode;
    /**
     * Gets the maximum value node, rooted in a particular node.
     * @param root The node to search.
     * @return The node with the maximum key in the tree.
     */
    private _maxValueNode;
    /**
     * Gets the balance state of a node, indicating whether the left or right
     * sub-trees are unbalanced.
     * @param node The node to get the difference from.
     * @return The BalanceState of the node.
     */
    private _getBalanceState;
    executeOnEveryNode(fn: (bst: Node<K, V>) => void): void;
    betweenBounds(query: any, lbm?: (query: any) => (key: K) => boolean, ubm?: (query: any) => (key: K) => boolean): V[];
}
declare namespace customUtils {
    function uid(): string;
    function randomString(len: number): string;
    /**
     * Return an array with the numbers from 0 to n-1, in a random order
     */
    function getRandomArray(n: number): number[];
    /**
     * XXHash32
     */
    function xxh(str: string, seed?: number): number;
}
declare namespace model {
    interface keyedObject {
        [key: string]: Value;
    }
    type PrimitiveValue = number | string | boolean | undefined | null | Date;
    type Value = keyedObject | Array<PrimitiveValue | keyedObject> | PrimitiveValue; /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    /**
     * Check a DB object and throw an error if it's not valid
     * Works by applying the above checkKey function to all fields recursively
     */
    function checkObject(obj: Value): void;
    /**
     * Serialize an object to be persisted to a one-line string
     * For serialization/deserialization, we use the native JSON parser and not eval or Function
     * That gives us less freedom but data entered in the database may come from users
     * so eval and the like are not safe
     * Accepted primitive types: Number, String, Boolean, Date, null
     * Accepted secondary types: Objects, Arrays
     */
    function serialize<T>(obj: T): string;
    /**
     * From a one-line representation of an object generate by the serialize function
     * Return the object itself
     */
    function deserialize(rawData: string): any;
    /**
     * Deep copy a DB object
     * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
     * where the keys are valid, i.e. don't begin with $ and don't contain a .
     */
    function deepCopy<T>(obj: T, model: (new () => any) & {
        new: (json: any) => any;
    }, strictKeys?: boolean): T;
    /**
     * Tells if an object is a primitive type or a "real" object
     * Arrays are considered primitive
     */
    function isPrimitiveType(obj: Value): boolean;
    /**
     * Utility functions for comparing things
     * Assumes type checking was already done (a and b already have the same type)
     * compareNSB works for numbers, strings and booleans
     */
    type NSB = number | string | boolean;
    function compareNSB<T extends NSB>(a: T, b: T): 1 | -1 | 0;
    function compareThings<V>(a: V, b: V, _compareStrings?: typeof compareNSB): 0 | 1 | -1; // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    /**
     * Modify a DB object according to an update query
     */
    function modify<G extends {
        _id?: string;
    }>(obj: G, updateQuery: any, model: (new () => G) & {
        new: (json: G) => G;
    }): G;
    // ==============================================================
    // Finding documents
    // ==============================================================
    /**
     * Get a value from object with dot notation
     */
    function getDotValue(obj: any, field: string): any;
    function areThingsEqual<A, B>(a: A, b: B): boolean; /**
     * Check that two values are comparable
     */
    /**
     * Check that two values are comparable
     */
    /**
     * Check that two values are comparable
     */
    /**
     * Check that two values are comparable
     */
    function match(obj: any, query: any): boolean; /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
    /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
    /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
    /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
}
declare class BaseModel<T = any> {
    _id: string;
    updatedAt?: Date;
    createdAt?: Date;
    static new<T>(this: new () => T, data: Partial<NFP<T>>): T;
}
type NFPN<T> = {
    [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
type NFP<T> = Pick<T, NFPN<T>>;
type Keys<O> = keyof O;
type Partial<T> = {
    [P in keyof T]?: T[P];
};
interface AnyFieldOperators<V> {
    $type?: "string" | "number" | "boolean" | "undefined" | "array" | "null" | "date" | "object";
    /**
     * Specifies equality condition. The $eq operator matches documents where the value of a field equals the specified value.
     * {field: { $eq: <value> }}
     */
    $eq?: V;
    /**
     * The $in operator selects the documents where the value of a field equals any value in the specified array.
     * { field: { $in: [<value1>, <value2>, ... <valueN> ] } }
     */
    $in?: V[];
    /**
     * $ne selects the documents where the value of the field is not equal (i.e. !=) to the specified value. This includes documents that do not contain the field.
     * {field: {$ne:value}}
     */
    $ne?: V;
    /**
     * $nin selects the documents where: the field value is not in the specified array or the field does not exist.
     * { field: { $nin: [ <value1>, <value2> ... <valueN> ]} }
     */
    $nin?: V[];
    /**
     * $not performs a logical NOT operation on the specified <operator-expression> and selects the documents that do not match the <operator-expression>. This includes documents that do not contain the field.
     * { field: { $not: { <operator-expression> } } }
     */
    $not?: FieldLevelQueryOperators<V>;
    /**
     * When <boolean> is true, $exists matches the documents that contain the field, including documents where the field value is null. If <boolean> is false, the query returns only the documents that do not contain the field.
     * { field: { $exists: <boolean> } }
     */
    $exists?: boolean;
}
interface StringOperators<V> extends AnyFieldOperators<V> {
    /**
     * Provides regular expression capabilities for pattern matching strings in queries. MongoDB uses Perl compatible regular expressions (i.e. “PCRE” ) version 8.41 with UTF-8 support.
     * {field:{$regex: /pattern/<options>}}
     */
    $regex?: RegExp;
}
interface NumberOperators<V> extends AnyFieldOperators<V> {
    /**
     * $gt selects those documents where the value of the field is greater than (i.e. >) the specified value.
     * {field: {$gt:value}}
     */
    $gt?: V;
    /**
     * $gte selects the documents where the value of the field is greater than or equal to (i.e. >=) a specified value
     * {field: {$gte:value}}
     */
    $gte?: V;
    /**
     * $lt selects the documents where the value of the field is less than (i.e. <) the specified value.
     * {field: {$lt:value}}
     */
    $lt?: V;
    /**
     * $lte selects the documents where the value of the field is less than or equal to (i.e. <=) the specified value.
     * {field: {$lte:value}}
     */
    $lte?: V;
    /**
     * Select documents where the value of a field divided by a divisor has the specified remainder (i.e. perform a modulo operation to select documents). To specify a $mod expression, use the following syntax:
     * { field: { $mod: [ divisor, remainder ] } }
     */
    $mod?: [number, number];
}
type InnerArrayOperators<V> = V extends Date ? NumberOperators<V> : V extends number ? NumberOperators<V> : V extends string ? StringOperators<V> : AnyFieldOperators<V>;
interface TotalArrayOperators<V> extends AnyFieldOperators<V> {
    /**
     * The $all operator selects the documents where the value of a field is an array that contains all the specified elements.
     *{ field: { $all: [ <value1> , <value2> ... ] } }
     */
    $all?: Array<V>;
    /**
     * The $elemMatch operator matches documents that contain an array field with at least one element that matches all the specified query criteria.
     * { <field>: { $elemMatch: { <query1>, <query2>, ... } } }
     */
    $elemMatch?: FieldLevelQueryOperators<V>;
    /**
     * The $size operator matches any array with the number of elements specified by the argument. For example:{ field: { $size: 2 } }
     */
    $size?: number;
}
type ArrayOperators<V> = TotalArrayOperators<V> & InnerArrayOperators<V>;
interface TopLevelQueryOperators<S> {
    /**
     * $and performs a logical AND operation on an array of two or more expressions (e.g. <expression1>, <expression2>, etc.) and selects the documents that satisfy all the expressions in the array. The $and operator uses short-circuit evaluation. If the first expression (e.g. <expression1>) evaluates to false, MongoDB will not evaluate the remaining expressions.
     * { $and: [ { <expression1> }, { <expression2> } , ... , { <expressionN> } ] }
     */
    $and?: SchemaKeyFilters<S>[];
    /**
     * $nor performs a logical NOR operation on an array of one or more query expression and selects the documents that fail all the query expressions in the array. The $nor has the following syntax:
     * { $nor: [ { <expression1> }, { <expression2> }, ...  { <expressionN> } ] }
     */
    $nor?: SchemaKeyFilters<S>[];
    /**
     * The $or operator performs a logical OR operation on an array of two or more expressions and selects the documents that satisfy at least one of the expressions. The $or has the following syntax:
     * { $or: [ { <expression1> }, { <expression2> }, ... , { <expressionN> } ] }
     */
    $or?: SchemaKeyFilters<S>[];
    /**
     * Use the $where operator to pass either a string containing a JavaScript function to the query system. The $where provides greater flexibility, but requires that the database processes the JavaScript expression or function for each document in the collection. Reference the document in the JavaScript expression or function using this.
     */
    $where?: (this: S) => boolean;
    /**
     * Use this operator when trying to apply filter on a deeply nested properties, like: "employee.address.street".
     * {$deep: {"employee.address.street": {$eq: "Bedford Mount"}}}
     */
    $deep?: {
        [key: string]: SchemaKeyFilters<any>;
    };
}
type FieldLevelQueryOperators<V> = V extends Array<any> ? ArrayOperators<V[0]> : V extends Date ? NumberOperators<V> : V extends number ? NumberOperators<V> : V extends string ? StringOperators<V> : AnyFieldOperators<V>;
type SchemaKeyFilters<S> = Partial<{
    [key in Keys<S>]: FieldLevelQueryOperators<S[key]> | S[key];
}>;
type Filter<S> = SchemaKeyFilters<S> | TopLevelQueryOperators<S>;
type SchemaKeySort<S> = Partial<{
    [key in Keys<S>]: -1 | 1;
} & {
    $deep: {
        [key: string]: -1 | 1;
    };
}>;
type SchemaKeyProjection<S> = Partial<{
    [key in Keys<S>]: 0 | 1;
} & {
    $deep: {
        [key: string]: 0 | 1;
    };
}>;
interface PushModifiers<V> {
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
    $sort?: 1 | -1 | Partial<{
        [Key in Keys<V>]: 1 | -1;
    }>;
    /**
     * The $position modifier specifies the location in the array at which the $push operator insert elements. Without the $position modifier, the $push operator inserts elements to the end of the array.
     */
    $position?: number;
}
interface UpsertOperators<S> extends UpdateOperators<S> {
    /**
     * If an update operation with upsert: true results in an insert of a document, then $setOnInsert assigns the specified values to the fields in the document. If the update operation does not result in an insert, $setOnInsert does nothing.
     * { $setOnInsert: { <field1>: <value1>, ... } },
     *
     */
    $setOnInsert: S;
}
interface UpdateOperators<S> {
    /**
     * Increments the value of the field by the specified amount.
     * { $inc: { <field1>: <amount1>, <field2>: <amount2>, ... } }
     */
    $inc?: Partial<{
        [Key in Keys<S>]: S[Key] extends number ? number : never;
    }>;
    /**
     * Multiplies the value of the field by the specified amount.
     * { $mul: { field: <number> } }
     */
    $mul?: Partial<{
        [Key in Keys<S>]: S[Key] extends number ? number : never;
    }>;
    /**
     * Renames a field.
     * {$rename: { <field1>: <newName1>, <field2>: <newName2>, ... } }
     */
    $rename?: UpdateOperatorsOnSchema<S, string>;
    /**
     * Sets the value of a field in a document.
     * { $set: { <field1>: <value1>, ... } }
     */
    $set?: Partial<S & {
        $deep: {
            [key: string]: any;
        };
    }>;
    /**
     * Removes the specified field from a document.
     * { $unset: { <field1>: "", ... } }
     */
    $unset?: Partial<{
        [key in Keys<S>]: "";
    } & {
        $deep: {
            [key: string]: "";
        };
    }>;
    /**
     * Only updates the field if the specified value is less than the existing field value.
     * { $min: { <field1>: <value1>, ... } }
     */
    $min?: Partial<{
        [Key in Keys<S>]: S[Key] extends number ? S[Key] : S[Key] extends Date ? S[Key] : never;
    }>;
    /**
     * Only updates the field if the specified value is greater than the existing field value.
     * { $max: { <field1>: <value1>, ... } }
     */
    $max?: Partial<{
        [Key in Keys<S>]: S[Key] extends number ? S[Key] : S[Key] extends Date ? S[Key] : never;
    }>;
    /**
     * Sets the value of a field to current date, either as a Date or a Timestamp.
     * { $currentDate: { <field1>: <typeSpecification1>, ... } }
     */
    $currentDate?: Partial<{
        [Key in Keys<S>]: S[Key] extends Date ? true | {
            $type: "date";
        } : S[Key] extends number ? {
            $type: "timestamp";
        } : never;
    }>;
    /**
     * Adds elements to an array only if they do not already exist in the set.
     * { $addToSet: { <field1>: <value1>, ... } }
     */
    $addToSet?: Partial<{
        [Key in Keys<S>]: S[Key] extends Array<infer U> ? U | {
            $each: U[];
        } : never;
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
        [Key in Keys<S>]: S[Key] extends Array<infer U> ? Partial<U> | FieldLevelQueryOperators<U> : never;
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
        [Key in Keys<S>]: S[Key] extends Array<infer U> ? U | PushModifiers<U> : never;
    }>;
}
type UpdateOperatorsOnSchema<S, V> = Partial<{
    [key in Keys<S>]: V;
}>;
/**
 * Create a new cursor for this collection
 */
declare class Cursor<G extends {
    _id?: string;
}> {
    private db;
    private query;
    private _limit;
    private _skip;
    private _sort;
    private _projection;
    constructor(db: Datastore<G>, query?: any);
    /**
     * Set a limit to the number of results
     */
    limit(limit: number): this;
    /**
     * Skip a the number of results
     */
    skip(skip: number): this;
    /**
     * Sort results of the query
     */
    sort(sortQuery: SchemaKeySort<G>): this;
    /**
     * Add the use of a projection
     */
    projection(projection: SchemaKeyProjection<G>): this;
    /**
     * Apply the projection
     */
    private _project;
    /**
     * Get all matching elements
     * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
     *
     */
    __exec_unsafe(): Promise<G[]>;
    private _exec;
    exec(): Promise<G[]>;
}
declare namespace model {
    interface keyedObject {
        [key: string]: Value;
    }
    type PrimitiveValue = number | string | boolean | undefined | null | Date;
    type Value = keyedObject | Array<PrimitiveValue | keyedObject> | PrimitiveValue; /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    /**
     * Check a DB object and throw an error if it's not valid
     * Works by applying the above checkKey function to all fields recursively
     */
    function checkObject(obj: Value): void;
    /**
     * Serialize an object to be persisted to a one-line string
     * For serialization/deserialization, we use the native JSON parser and not eval or Function
     * That gives us less freedom but data entered in the database may come from users
     * so eval and the like are not safe
     * Accepted primitive types: Number, String, Boolean, Date, null
     * Accepted secondary types: Objects, Arrays
     */
    function serialize<T>(obj: T): string;
    /**
     * From a one-line representation of an object generate by the serialize function
     * Return the object itself
     */
    function deserialize(rawData: string): any;
    /**
     * Deep copy a DB object
     * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
     * where the keys are valid, i.e. don't begin with $ and don't contain a .
     */
    function deepCopy<T>(obj: T, model: (new () => any) & {
        new: (json: any) => any;
    }, strictKeys?: boolean): T;
    /**
     * Tells if an object is a primitive type or a "real" object
     * Arrays are considered primitive
     */
    function isPrimitiveType(obj: Value): boolean;
    /**
     * Utility functions for comparing things
     * Assumes type checking was already done (a and b already have the same type)
     * compareNSB works for numbers, strings and booleans
     */
    type NSB = number | string | boolean;
    function compareNSB<T extends NSB>(a: T, b: T): 1 | -1 | 0;
    function compareThings<V>(a: V, b: V, _compareStrings?: typeof compareNSB): 0 | 1 | -1; // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    /**
     * Modify a DB object according to an update query
     */
    function modify<G extends {
        _id?: string;
    }>(obj: G, updateQuery: any, model: (new () => G) & {
        new: (json: G) => G;
    }): G;
    // ==============================================================
    // Finding documents
    // ==============================================================
    /**
     * Get a value from object with dot notation
     */
    function getDotValue(obj: any, field: string): any;
    function areThingsEqual<A, B>(a: A, b: B): boolean; /**
     * Check that two values are comparable
     */
    function match(obj: any, query: any): boolean; /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
}
interface Pair<Doc> {
    newDoc: Doc;
    oldDoc: Doc;
} /**
 * Two indexed pointers are equal iif they point to the same place
 */
declare function checkValueEquality<T>(a: T, b: T): boolean; /**
 * Type-aware projection
 */
/**
 * Type-aware projection
 */
/**
 * Type-aware projection
 */
/**
 * Type-aware projection
 */
declare class Index<Key, Doc extends Partial<BaseModel>> {
    fieldName: string;
    unique: boolean;
    sparse: boolean;
    treeOptions: {
        unique: boolean;
        compareKeys: typeof model.compareThings;
        checkValueEquality: typeof checkValueEquality;
    };
    tree: AvlTree<Key, Doc>;
    constructor({ fieldName, unique, sparse }: {
        fieldName: string;
        unique?: boolean;
        sparse?: boolean;
    });
    reset(): void;
    /**
     * Insert a new document in the index
     * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
     * O(log(n))
     */
    insert(doc: Doc | Doc[]): void;
    /**
     * Insert an array of documents in the index
     * If a constraint is violated, the changes should be rolled back and an error thrown
     *
     */
    private insertMultipleDocs;
    /**
     * Remove a document from the index
     * If an array is passed, we remove all its elements
     * The remove operation is safe with regards to the 'unique' constraint
     * O(log(n))
     */
    remove(doc: Doc | Doc[]): void;
    /**
     * Update a document in the index
     * If a constraint is violated, changes are rolled back and an error thrown
     * Naive implementation, still in O(log(n))
     */
    update(oldDoc: Doc | Array<Pair<Doc>>, newDoc?: Doc): void;
    /**
     * Update multiple documents in the index
     * If a constraint is violated, the changes need to be rolled back
     * and an error thrown
     */
    private updateMultipleDocs;
    /**
     * Revert an update
     */
    revertUpdate(oldDoc: Doc | Array<Pair<Doc>>, newDoc?: Doc): void;
    /**
     * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
     */
    getMatching(input: Key | Key[]): Doc[];
    getAll(): Doc[];
    getBetweenBounds(query: any): Doc[];
}
type remoteAdapter = (endpoint: string, token: string) => (name: string) => remoteStore;
interface remoteStore {
    name: string;
    removeStore: () => Promise<boolean>;
    removeItem: (id: string) => Promise<boolean>;
    setItem: (id: string, value: string) => Promise<boolean>;
    getItem: (id: string) => Promise<string>;
    removeItems: (ids: string[]) => Promise<boolean[]>;
    setItems: (items: {
        key: string;
        value: string;
    }[]) => Promise<boolean[]>;
    getItems: (ids: string[]) => Promise<{
        key: string;
        value: string;
    }[]>;
    keys: () => Promise<string[]>;
}
declare class IDB {
    store: UseStore;
    constructor(ref: string);
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
    gets(keys: string[]): Promise<string[]>;
    sets(entries: [string, string][]): Promise<void>;
    dels(keys: string[]): Promise<void>;
    keys(): Promise<IDBValidKey[]>;
    values(): Promise<string[]>;
    clear(): Promise<void>;
    length(): Promise<number>;
}
type logType = "w" | "d";
declare class Sync {
    private p;
    rdata: remoteStore;
    rlogs: remoteStore;
    log: IDB;
    constructor(persistence: Persistence, log: IDB, rdata: remoteStore, rlogs: remoteStore);
    addToLog(d: string, t: logType, timestamp?: string): Promise<void>;
    compareLog(localKeys: string[], remoteKeys: string[]): {
        shouldSend: string[];
        shouldHave: string[];
    };
    sync(): Promise<{
        sent: number;
        received: number;
    }>;
    _sync(): Promise<{
        sent: number;
        received: number;
    }>;
}
type persistenceLine = {
    type: "index" | "doc" | "corrupt";
    status: "add" | "remove";
    data: any;
};
type PersistenceEventCallback = (message: string) => Promise<void>;
type PersistenceEventEmits = "readLine" | "writeLine" | "end";
declare class PersistenceEvent {
    callbacks: {
        readLine: Array<PersistenceEventCallback>;
        writeLine: Array<PersistenceEventCallback>;
        end: Array<PersistenceEventCallback>;
    };
    on(event: PersistenceEventEmits, cb: PersistenceEventCallback): void;
    emit(event: PersistenceEventEmits, data: string): Promise<void>;
}
interface PersistenceOptions<G extends Partial<BaseModel>> {
    db: Datastore<G>;
    encode?: (raw: string) => string;
    decode?: (encrypted: string) => string;
    corruptAlertThreshold?: number;
    model?: (new () => G) & {
        new: (json: G) => G;
    };
    syncInterval?: number;
    syncToRemote?: (name: string) => remoteStore;
} /**
 * Create a new Persistence object for database options.db
 */
declare class Persistence<G extends Partial<BaseModel> = any> {
    db: Datastore<G>;
    ref: string;
    data: IDB;
    RSA?: (name: string) => remoteStore;
    syncInterval: number;
    syncInProgress: boolean;
    sync?: Sync;
    corruptAlertThreshold: number;
    encode: (s: string) => string;
    decode: (s: string) => string;
    private _model;
    protected _memoryIndexes: string[];
    protected _memoryData: string[];
    constructor(options: PersistenceOptions<G>);
    writeNewIndex(newIndexes: {
        $$indexCreated: EnsureIndexOptions;
    }[]): Promise<void>;
    writeNewData(newDocs: G[]): Promise<void>;
    treatSingleLine(line: string): persistenceLine;
    /**
     * Load the database
     * 1) Create all indexes
     * 2) Insert all data
     */
    loadDatabase(): Promise<boolean>;
    readData(event: PersistenceEvent): Promise<void>;
    deleteData(_id: string, timestamp?: string): Promise<void>;
    writeData(_id: string, data: string, timestamp?: string): Promise<void>;
    clearData(): Promise<void>;
} /**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */
// TODO: do idb operations in bulk for perf improvements
// TODO: devalidate same key rule after 20 minutes ? Math.floor(new Date() / (1000 * 60 * 20))
// TODO: Optional to encrypt data
// TODO: test new functions
// TODO: setup benchmark
/**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */
// TODO: do idb operations in bulk for perf improvements
// TODO: devalidate same key rule after 20 minutes ? Math.floor(new Date() / (1000 * 60 * 20))
// TODO: Optional to encrypt data
// TODO: test new functions
// TODO: setup benchmark
/**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */
// TODO: do idb operations in bulk for perf improvements
// TODO: devalidate same key rule after 20 minutes ? Math.floor(new Date() / (1000 * 60 * 20))
// TODO: Optional to encrypt data
// TODO: test new functions
// TODO: setup benchmark
/**
 * Smaller logs:
 * #. if a document has been deleted, remove the creation log
 * #. if a document has been updated multiple times, keep the last update only
 */
// TODO: do idb operations in bulk for perf improvements
// TODO: devalidate same key rule after 20 minutes ? Math.floor(new Date() / (1000 * 60 * 20))
// TODO: Optional to encrypt data
// TODO: test new functions
// TODO: setup benchmark
declare namespace types { }
interface EnsureIndexOptions {
    fieldName: string;
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
}
interface DataStoreOptions<G> {
    ref: string;
    encode?(line: string): string;
    decode?(line: string): string;
    corruptAlertThreshold?: number;
    timestampData?: boolean;
    syncToRemote?: (name: string) => remoteStore;
    syncInterval?: number;
    model?: (new () => G) & {
        new: (json: G) => G;
    };
}
interface UpdateOptions {
    multi?: boolean;
    upsert?: boolean;
}
declare class Datastore<G extends Partial<types.BaseModel> & {
    [key: string]: any;
}> {
    ref: string;
    timestampData: boolean;
    persistence: Persistence<G>;
    // rename to something denotes that it's an internal thing
    q: Q;
    indexes: {
        [key: string]: Index<string, G>;
    };
    ttlIndexes: {
        [key: string]: number;
    };
    model: (new () => G) & {
        new: (json: G) => G;
    };
    constructor(options: DataStoreOptions<G>);
    /**
     * Load the database from the datafile, and trigger the execution of buffered commands if any
     */
    loadDatabase(): Promise<boolean>;
    /**
     * Get an array of all the data in the database
     */
    getAllData(): G[];
    /**
     * Reset all currently defined indexes
     */
    resetIndexes(): void;
    /**
     * Ensure an index is kept for this field. Same parameters as lib/indexes
     * For now this function is synchronous, we need to test how much time it takes
     * We use an async API for consistency with the rest of the code
     */
    ensureIndex(options: EnsureIndexOptions): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Remove an index
     */
    removeIndex(fieldName: string): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Add one or several document(s) to all indexes
     */
    addToIndexes<T extends G>(doc: T | T[]): void;
    /**
     * Remove one or several document(s) from all indexes
     */
    removeFromIndexes<T extends G>(doc: T | T[]): void;
    /**
     * Update one or several documents in all indexes
     * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs
     * If one update violates a constraint, all changes are rolled back
     */
    updateIndexes<T extends G>(oldDoc: T, newDoc: T): void;
    updateIndexes<T extends G>(updates: Array<{
        oldDoc: T;
        newDoc: T;
    }>): void;
    private _isBasicType;
    /**
     * This will return the least number of candidates,
     * using Index if possible
     * when failing it will return all the database
     */
    private _leastCandidates;
    /**
     * Return the list of candidates for a given query
     * Crude implementation for now, we return the candidates given by the first usable index if any
     * We try the following query types, in this order: basic match, $in match, comparison match
     * One way to make it better would be to enable the use of multiple indexes if the first usable index
     * returns too much data. I may do it in the future.
     *
     * Returned candidates will be scanned to find and remove all expired documents
     */
    getCandidates(query: any, dontExpireStaleDocs?: boolean): Promise<G[]>;
    /**
     * Insert a new document
     */
    private _insert;
    /**
     * Create a new _id that's not already in use
     */
    private createNewId;
    /**
     * Prepare a document (or array of documents) to be inserted in a database
     * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
     */
    private prepareDocumentForInsertion;
    /**
     * If newDoc is an array of documents, this will insert all documents in the cache
     */
    private _insertInCache;
    /**
     * If one insertion fails (e.g. because of a unique constraint), roll back all previous
     * inserts and throws the error
     */
    private _insertMultipleDocsInCache;
    insert(newDoc: G | G[]): Promise<types.Result<G>>;
    /**
     * Count all documents matching the query
     */
    count(query: any): Promise<number>;
    /**
     * Find all documents matching the query
     */
    find(query: any): Promise<G[]>;
    /**
     * Find all documents matching the query
     */
    cursor(query: any): Cursor<G>;
    /**
     * Update all docs matching query
     */
    private _update;
    update(query: any, updateQuery: any, options: UpdateOptions): Promise<types.Result<G> & {
        upsert: boolean;
    }>;
    /**
     * Remove all docs matching the query
     * For now very naive implementation (similar to update)
     */
    private _remove;
    remove(query: any, options?: {
        multi: boolean;
    }): Promise<types.Result<G>>;
}
// for some reason using @types will disable some type checks
interface DatabaseConfigurations<S extends BaseModel<S>> {
    ref: string;
    model?: (new () => S) & {
        new: (json: S) => S;
    };
    encode?(line: string): string;
    decode?(line: string): string;
    corruptAlertThreshold?: number;
    timestampData?: boolean;
    reloadBeforeOperations?: boolean;
    syncToRemote?: (name: string) => remoteStore;
    syncInterval?: number;
}
declare class Database<S extends BaseModel<S>> {
    private ref;
    private _datastore;
    private reloadBeforeOperations;
    private model;
    loaded: Promise<boolean>;
    constructor(options: DatabaseConfigurations<S>);
    private reloadFirst;
    /**
     * insert documents
     */
    insert(docs: S[]): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Find document(s) that meets a specified criteria
     */
    read({ filter, skip, limit, project, sort }: {
        filter?: Filter<NFP<S>>;
        skip?: number;
        limit?: number;
        sort?: SchemaKeySort<NFP<S>>;
        project?: SchemaKeyProjection<NFP<S>>;
    }): Promise<S[]>;
    /**
     * Update document(s) that meets the specified criteria
     */
    update({ filter, update, multi }: {
        filter: Filter<NFP<S>>;
        update: UpdateOperators<NFP<S>>;
        multi?: boolean;
    }): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Update document(s) that meets the specified criteria,
     * and do an insertion if no documents are matched
     */
    upsert({ filter, update, multi }: {
        filter: Filter<NFP<S>>;
        update: UpsertOperators<NFP<S>>;
        multi?: boolean;
    }): Promise<{
        docs: S[];
        number: number;
        upsert: boolean;
    }>;
    /**
     * Count documents that meets the specified criteria
     */
    count(filter?: Filter<NFP<S>>): Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     *
     */
    delete({ filter, multi }: {
        filter: Filter<NFP<S>>;
        multi?: boolean;
    }): Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Create an index specified by options
     */
    createIndex(options: EnsureIndexOptions & {
        fieldName: keyof NFP<S>;
    }): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Remove an index by passing the field name that it is related to
     */
    removeIndex(fieldName: string & keyof NFP<S>): Promise<{
        affectedIndex: string;
    }>;
    /**
     * Reload database from the persistence layer (if it exists)
     */
    reload(): Promise<{}>;
    sync(): Promise<{
        sent: number;
        received: number;
    }>;
    /**
     * Create document
     */
    create: (docs: S[]) => Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Find documents that meets a specified criteria
     */
    find: ({ filter, skip, limit, project, sort }: {
        filter?: Partial<{
            [key in {
                [K in keyof S]: S[K] extends Function ? never : K;
            }[keyof S]]: Pick<S, {
                [K in keyof S]: S[K] extends Function ? never : K;
            }[keyof S]>[key] | FieldLevelQueryOperators<Pick<S, {
                [K in keyof S]: S[K] extends Function ? never : K;
            }[keyof S]>[key]>;
        }> | TopLevelQueryOperators<Pick<S, {
            [K in keyof S]: S[K] extends Function ? never : K;
        }[keyof S]>> | undefined;
        skip?: number | undefined;
        limit?: number | undefined;
        sort?: Partial<{
            [key_1 in {
                [K in keyof S]: S[K] extends Function ? never : K;
            }[keyof S]]: 1 | -1;
        } & {
            $deep: {
                [key: string]: 1 | -1;
            };
        }> | undefined;
        project?: Partial<{
            [key_2 in {
                [K in keyof S]: S[K] extends Function ? never : K;
            }[keyof S]]: 0 | 1;
        } & {
            $deep: {
                [key: string]: 0 | 1;
            };
        }> | undefined;
    }) => Promise<S[]>;
    /**
     * Count the documents matching the specified criteria
     */
    number: (filter?: Filter<Pick<S, {
        [K in keyof S]: S[K] extends Function ? never : K;
    }[keyof S]>>) => Promise<number>;
    /**
     * Delete document(s) that meets the specified criteria
     */
    remove: ({ filter, multi }: {
        filter: Filter<Pick<S, {
            [K in keyof S]: S[K] extends Function ? never : K;
        }[keyof S]>>;
        multi?: boolean | undefined;
    }) => Promise<{
        docs: S[];
        number: number;
    }>;
    /**
     * Create an index specified by options
     */
    ensureIndex: (options: EnsureIndexOptions & {
        fieldName: {
            [K in keyof S]: S[K] extends Function ? never : K;
        }[keyof S];
    }) => Promise<{
        affectedIndex: string;
    }>;
}
declare namespace customUtils {
    function uid(): string;
    function randomString(len: number): string; /**
     * Return an array with the numbers from 0 to n-1, in a random order
     */
    function getRandomArray(n: number): number[]; /**
     * XXHash32
     */
    /**
     * XXHash32
     */
    function xxh(str: string, seed?: number): number;
}
declare namespace modelling {
    interface keyedObject {
        [key: string]: Value;
    }
    type PrimitiveValue = number | string | boolean | undefined | null | Date;
    type Value = keyedObject | Array<PrimitiveValue | keyedObject> | PrimitiveValue; /**
     * Check a key throw an error if the key is non valid
     * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
     * Its serialized-then-deserialized version it will transformed into a Date object
     * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
     */
    function checkObject(obj: Value): void; /**
     * Serialize an object to be persisted to a one-line string
     * For serialization/deserialization, we use the native JSON parser and not eval or Function
     * That gives us less freedom but data entered in the database may come from users
     * so eval and the like are not safe
     * Accepted primitive types: Number, String, Boolean, Date, null
     * Accepted secondary types: Objects, Arrays
     */
    function serialize<T>(obj: T): string; /**
     * From a one-line representation of an object generate by the serialize function
     * Return the object itself
     */
    function deserialize(rawData: string): any; /**
     * Deep copy a DB object
     * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
     * where the keys are valid, i.e. don't begin with $ and don't contain a .
     */
    function deepCopy<T>(obj: T, model: (new () => any) & {
        new: (json: any) => any;
    }, strictKeys?: boolean): T; /**
     * Tells if an object is a primitive type or a "real" object
     * Arrays are considered primitive
     */
    function isPrimitiveType(obj: Value): boolean; /**
     * Utility functions for comparing things
     * Assumes type checking was already done (a and b already have the same type)
     * compareNSB works for numbers, strings and booleans
     */
    /**
     * Utility functions for comparing things
     * Assumes type checking was already done (a and b already have the same type)
     * compareNSB works for numbers, strings and booleans
     */
    type NSB = number | string | boolean;
    function compareNSB<T extends NSB>(a: T, b: T): 1 | -1 | 0;
    function compareThings<V>(a: V, b: V, _compareStrings?: typeof compareNSB): 0 | 1 | -1; // ==============================================================
    // Updating documents
    // ==============================================================
    /**
     * The signature of modifier functions is as follows
     * Their structure is always the same: recursively follow the dot notation while creating
     * the nested documents if needed, then apply the "last step modifier"
     */
    function modify<G extends {
        _id?: string;
    }>(obj: G, updateQuery: any, model: (new () => G) & {
        new: (json: G) => G;
    }): G; // ==============================================================
    // Finding documents
    // ==============================================================
    /**
     * Get a value from object with dot notation
     */
    function getDotValue(obj: any, field: string): any; /**
     * Check whether 'things' are equal
     * Things are defined as any native types (string, number, boolean, null, date) and objects
     * In the case of object, we check deep equality
     * Returns true if they are, false otherwise
     */
    function areThingsEqual<A, B>(a: A, b: B): boolean; /**
     * Check that two values are comparable
     */
    function match(obj: any, query: any): boolean; /**
     * Match an object against a specific { key: value } part of a query
     * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
     */
}
declare const unify: {
    Database: typeof Database;
    BaseModel: typeof BaseModel;
    adapters: {
        kvAdapter: remoteAdapter;
        memoryAdapter: remoteAdapter;
        memoryStores: {
            [key: string]: {
                [key: string]: string;
            };
        };
    };
    Persistence: typeof Persistence;
    PersistenceEvent: typeof PersistenceEvent;
    _internal: {
        avl: {
            AvlTree: typeof AvlTree;
            Node: typeof Node;
        };
        Cursor: typeof Cursor;
        customUtils: typeof customUtils;
        Datastore: typeof Datastore;
        Index: typeof Index;
        modelling: typeof modelling;
    };
};
export { unify as default };
