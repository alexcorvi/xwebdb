import { AvlTree } from "./avl";
import { Doc } from "../types";
interface Pair<Doc> {
    newDoc: Doc;
    oldDoc: Doc;
}
export declare class Index<Key, S extends Doc> {
    fieldName: string;
    unique: boolean;
    sparse: boolean;
    tree: AvlTree<Key, S>;
    constructor({ fieldName, unique, sparse, }: {
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
    insert(doc: S | S[]): void;
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
    remove(doc: S | S[]): void;
    /**
     * Update a document in the index
     * If a constraint is violated, changes are rolled back and an error thrown
     * Naive implementation, still in O(log(n))
     */
    update(oldDoc: S | Array<Pair<S>>, newDoc?: S): void;
    /**
     * Update multiple documents in the index
     * If a constraint is violated, the changes need to be rolled back
     * and an error thrown
     */
    private updateMultipleDocs;
    /**
     * Revert an update
     */
    revertUpdate(oldDoc: S | Array<Pair<S>>, newDoc?: S): void;
    /**
     * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
     */
    getMatching(input: Key | Key[]): S[];
    getAll(): S[];
    getBetweenBounds(query: any): S[];
}
export {};
