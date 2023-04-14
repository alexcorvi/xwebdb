/**
 * @license
 * Copyright Daniel Imms <http://www.growingwiththeweb.com>
 * Released under MIT license. See LICENSE in the project root for details.
 */
declare type CompareFunction<K> = (a: K, b: K) => number;
export declare class Node<K, V> {
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
}
export declare class AvlTree<K, V> {
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
export {};
