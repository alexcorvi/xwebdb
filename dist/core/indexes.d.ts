import { AvlTree } from "./avl";
import { BaseModel } from "../types";
interface Pair<Doc> {
    newDoc: Doc;
    oldDoc: Doc;
}
export declare class Index<Key, Doc extends BaseModel> {
    fieldName: string;
    unique: boolean;
    sparse: boolean;
    tree: AvlTree<Key, Doc>;
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
export {};
