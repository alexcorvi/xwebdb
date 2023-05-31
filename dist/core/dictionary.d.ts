/**
 * This is a data structure that is much similar to SortedDictionary in C#
 * Except for minor differences.
 * 		1.	It can hold multiple values per key
 * 		2.	Binary search for insertion & deletion
 * 		3.	Doesn't use red-black tree
 *
 * Complexity Notations:
 * 		# Get: O(1)
 * 		# Insert: O(log n)
 * 		# Delete: O(log n)
 *
 *
 * It supports duplicate keys, range queries, and custom comparator function.
 */
type CompareFunction<K> = (a: K, b: K) => number;
export declare class Dictionary<D extends object> {
    keys: D[keyof D][];
    documents: Map<D[keyof D], D[]>;
    comparator: CompareFunction<any>;
    fieldName: keyof D;
    unique: boolean;
    constructor({ fieldName, unique, c, }: {
        fieldName: keyof D;
        unique: boolean;
        c: CompareFunction<D[keyof D]>;
    });
    has(key: D[keyof D]): boolean;
    insert(key: D[keyof D], document: D): void;
    get(key: D[keyof D] | D[keyof D][]): D[];
    delete(key: D[keyof D], document: D): boolean;
    findInsertionIndex(key: D[keyof D]): number;
    binarySearch(key: D[keyof D]): number;
    $in(keys: D[keyof D][]): D[];
    $nin(dismissKeys: D[keyof D][]): D[];
    $ne(dismissKey: D[keyof D]): D[];
    betweenBounds(gt: D[keyof D], gtInclusive: boolean, lt: D[keyof D], ltInclusive: boolean): D[];
    boundedQuery(query: any): D[];
    get all(): D[];
    get numberOfKeys(): number;
    get size(): number;
}
export {};
