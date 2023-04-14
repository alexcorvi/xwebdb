(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = global || self, global.unify = factory());
}(this, (function () { 'use strict';

	/**
	 * @license
	 * Copyright Daniel Imms <http://www.growingwiththeweb.com>
	 * Released under MIT license. See LICENSE in the project root for details.
	 */
	class Node {
	    /**
	     * Creates a new AVL Tree node.
	     * @param key The key of the new node.
	     * @param value The value of the new node.
	     */
	    constructor(key, value) {
	        this.left = null;
	        this.right = null;
	        this.height = null;
	        this.value = [];
	        this.value.push(value);
	        this.key = key;
	    }
	    /**
	     * Performs a right rotate on this node.
	     * @return The root of the sub-tree; the node where this node used to be.
	     * @throws If Node.left is null.
	     */
	    rotateRight() {
	        //     b                           a
	        //    / \                         / \
	        //   a   e -> b.rotateRight() -> c   b
	        //  / \                             / \
	        // c   d                           d   e
	        const other = this.left;
	        this.left = other.right;
	        other.right = this;
	        this.height = Math.max(this.leftHeight, this.rightHeight) + 1;
	        other.height = Math.max(other.leftHeight, this.height) + 1;
	        return other;
	    }
	    /**
	     * Performs a left rotate on this node.
	     * @return The root of the sub-tree; the node where this node used to be.
	     * @throws If Node.right is null.
	     */
	    rotateLeft() {
	        //   a                              b
	        //  / \                            / \
	        // c   b   -> a.rotateLeft() ->   a   e
	        //    / \                        / \
	        //   d   e                      c   d
	        const other = this.right;
	        this.right = other.left;
	        other.left = this;
	        this.height = Math.max(this.leftHeight, this.rightHeight) + 1;
	        other.height = Math.max(other.rightHeight, this.height) + 1;
	        return other;
	    }
	    /**
	     * Convenience function to get the height of the left child of the node,
	     * returning -1 if the node is null.
	     * @return The height of the left child, or -1 if it doesn't exist.
	     */
	    get leftHeight() {
	        if (this.left === null) {
	            return -1;
	        }
	        return this.left.height || 0;
	    }
	    /**
	     * Convenience function to get the height of the right child of the node,
	     * returning -1 if the node is null.
	     * @return The height of the right child, or -1 if it doesn't exist.
	     */
	    get rightHeight() {
	        if (this.right === null) {
	            return -1;
	        }
	        return this.right.height || 0;
	    }
	    executeOnEveryNode(fn) {
	        if (this.left) {
	            this.left.executeOnEveryNode(fn);
	        }
	        fn(this);
	        if (this.right) {
	            this.right.executeOnEveryNode(fn);
	        }
	    }
	    /**
	     * Get all data for a key between bounds
	     * Return it in key order
	     */
	    betweenBounds(query, lbm, ubm) {
	        let res = [];
	        if (!this.hasOwnProperty("key")) {
	            return [];
	        }
	        lbm = lbm || this.getLowerBoundMatcher(query);
	        ubm = ubm || this.getUpperBoundMatcher(query);
	        if (lbm(this.key) && this.left) {
	            res = res.concat(this.left.betweenBounds(query, lbm, ubm));
	        }
	        if (lbm(this.key) && ubm(this.key) && this.value) {
	            res = res.concat(this.value);
	        }
	        if (ubm(this.key) && this.right) {
	            res = res.concat(this.right.betweenBounds(query, lbm, ubm));
	        }
	        return res;
	    }
	    /**
	     * Return a function that tells whether a given key matches a lower bound
	     */
	    getLowerBoundMatcher(query) {
	        // No lower bound
	        if (!query.hasOwnProperty("$gt") && !query.hasOwnProperty("$gte")) {
	            return () => true;
	        }
	        if (query.hasOwnProperty("$gt") && query.hasOwnProperty("$gte")) {
	            if (this.compareKeys(query.$gte, query.$gt) === 0) {
	                return (key) => this.compareKeys(key, query.$gt) > 0;
	            }
	            if (this.compareKeys(query.$gte, query.$gt) > 0) {
	                return (key) => this.compareKeys(key, query.$gte) >= 0;
	            }
	            else {
	                return (key) => this.compareKeys(key, query.$gt) > 0;
	            }
	        }
	        if (query.hasOwnProperty("$gt")) {
	            return (key) => this.compareKeys(key, query.$gt) > 0;
	        }
	        else {
	            return (key) => this.compareKeys(key, query.$gte) >= 0;
	        }
	    }
	    /**
	     * Return a function that tells whether a given key matches an upper bound
	     */
	    getUpperBoundMatcher(query) {
	        // No lower bound
	        if (!query.hasOwnProperty("$lt") && !query.hasOwnProperty("$lte")) {
	            return () => true;
	        }
	        if (query.hasOwnProperty("$lt") && query.hasOwnProperty("$lte")) {
	            if (this.compareKeys(query.$lte, query.$lt) === 0) {
	                return (key) => this.compareKeys(key, query.$lt) < 0;
	            }
	            if (this.compareKeys(query.$lte, query.$lt) < 0) {
	                return (key) => this.compareKeys(key, query.$lte) <= 0;
	            }
	            else {
	                return (key) => this.compareKeys(key, query.$lt) < 0;
	            }
	        }
	        if (query.hasOwnProperty("$lt")) {
	            return (key) => this.compareKeys(key, query.$lt) < 0;
	        }
	        else {
	            return (key) => this.compareKeys(key, query.$lte) <= 0;
	        }
	    }
	    compareKeys(a, b) {
	        if (a > b) {
	            return 1;
	        }
	        if (a < b) {
	            return -1;
	        }
	        return 0;
	    }
	    numberOfKeys() {
	        let res = 1;
	        if (this.left) {
	            res += this.left.numberOfKeys();
	        }
	        if (this.right) {
	            res += this.right.numberOfKeys();
	        }
	        return res;
	    }
	}
	class AvlTree {
	    /**
	     * Creates a new AVL Tree.
	     * @param _compare An optional custom compare function.
	     */
	    constructor(compare, unique = false) {
	        this._root = null;
	        this._size = 0;
	        this.unique = false;
	        this._compare = compare ? compare : this._defaultCompare;
	        this.unique = unique;
	    }
	    /**
	     * Compares two keys with each other.
	     * @param a The first key to compare.
	     * @param b The second key to compare.
	     * @return -1, 0 or 1 if a < b, a == b or a > b respectively.
	     */
	    _defaultCompare(a, b) {
	        if (a > b) {
	            return 1;
	        }
	        if (a < b) {
	            return -1;
	        }
	        return 0;
	    }
	    /**
	     * Inserts a new node with a specific key into the tree.
	     * @param key The key being inserted.
	     * @param value The value being inserted.
	     */
	    insert(key, value) {
	        this._root = this._insert(key, value, this._root);
	        this._size++;
	    }
	    /**
	     * Inserts a new node with a specific key into the tree.
	     * @param key The key being inserted.
	     * @param root The root of the tree to insert in.
	     * @return The new tree root.
	     */
	    _insert(key, value, root) {
	        // Perform regular BST insertion
	        if (root === null) {
	            return new Node(key, value);
	        }
	        if (this._compare(key, root.key) < 0) {
	            root.left = this._insert(key, value, root.left);
	        }
	        else if (this._compare(key, root.key) > 0) {
	            root.right = this._insert(key, value, root.right);
	        }
	        else if (!this.unique) {
	            root.value.push(value);
	            return root;
	        }
	        else {
	            // It's a duplicate so insertion failed, decrement size to make up for it
	            if (this.size > 0) {
	                this._size--;
	            }
	            const err = new Error(`Can't insert key ${key}, it violates the unique constraint`);
	            err.key = key;
	            err.errorType = "uniqueViolated";
	            throw err;
	        }
	        // Update height and rebalance tree
	        root.height = Math.max(root.leftHeight, root.rightHeight) + 1;
	        const balanceState = this._getBalanceState(root);
	        if (balanceState === 4 /* UNBALANCED_LEFT */) {
	            if (this._compare(key, root.left.key) < 0) {
	                // Left left case
	                root = root.rotateRight();
	            }
	            else {
	                // Left right case
	                root.left = root.left.rotateLeft();
	                return root.rotateRight();
	            }
	        }
	        if (balanceState === 0 /* UNBALANCED_RIGHT */) {
	            if (this._compare(key, root.right.key) > 0) {
	                // Right right case
	                root = root.rotateLeft();
	            }
	            else {
	                // Right left case
	                root.right = root.right.rotateRight();
	                return root.rotateLeft();
	            }
	        }
	        return root;
	    }
	    /**
	     * Deletes a node with a specific key from the tree.
	     * @param key The key being deleted.
	     */
	    delete(key, doc) {
	        this._root = this._delete(key, doc, this._root);
	        if (this.size > 0)
	            this._size--;
	    }
	    /**
	     * Deletes a node with a specific key from the tree.
	     * @param key The key being deleted.
	     * @param root The root of the tree to delete from.
	     * @return The new tree root.
	     */
	    _delete(key, doc, root) {
	        // Perform regular BST deletion
	        if (root === null) {
	            this._size++;
	            return root;
	        }
	        if (this._compare(key, root.key) < 0) {
	            // The key to be deleted is in the left sub-tree
	            root.left = this._delete(key, doc, root.left);
	        }
	        else if (this._compare(key, root.key) > 0) {
	            // The key to be deleted is in the right sub-tree
	            root.right = this._delete(key, doc, root.right);
	        }
	        else {
	            // root is the node to be deleted
	            if (root.value.length > 1) {
	                // removing item from array only
	                // not whole node
	                root.value.splice(root.value.indexOf(doc), 1);
	                return root;
	            }
	            if (!root.left && !root.right) {
	                root = null;
	            }
	            else if (!root.left && root.right) {
	                root = root.right;
	            }
	            else if (root.left && !root.right) {
	                root = root.left;
	            }
	            else {
	                // Node has 2 children, get the in-order successor
	                const inOrderSuccessor = this._minValueNode(root.right);
	                root.key = inOrderSuccessor.key;
	                root.value = inOrderSuccessor.value;
	                root.right = this._delete(inOrderSuccessor.key, doc, root.right);
	            }
	        }
	        if (root === null) {
	            return root;
	        }
	        // Update height and rebalance tree
	        root.height = Math.max(root.leftHeight, root.rightHeight) + 1;
	        const balanceState = this._getBalanceState(root);
	        if (balanceState === 4 /* UNBALANCED_LEFT */) {
	            // Left left case
	            if (this._getBalanceState(root.left) ===
	                2 /* BALANCED */ ||
	                this._getBalanceState(root.left) ===
	                    3 /* SLIGHTLY_UNBALANCED_LEFT */) {
	                return root.rotateRight();
	            }
	            // Left right case
	            // this._getBalanceState(root.left) === BalanceState.SLIGHTLY_UNBALANCED_RIGHT
	            root.left = root.left.rotateLeft();
	            return root.rotateRight();
	        }
	        if (balanceState === 0 /* UNBALANCED_RIGHT */) {
	            // Right right case
	            if (this._getBalanceState(root.right) ===
	                2 /* BALANCED */ ||
	                this._getBalanceState(root.right) ===
	                    1 /* SLIGHTLY_UNBALANCED_RIGHT */) {
	                return root.rotateLeft();
	            }
	            // Right left case
	            // this._getBalanceState(root.right) === BalanceState.SLIGHTLY_UNBALANCED_LEFT
	            root.right = root.right.rotateRight();
	            return root.rotateLeft();
	        }
	        return root;
	    }
	    /**
	     * Gets the value of a node within the tree with a specific key.
	     * @param key The key being searched for.
	     * @return The value of the node (which may be undefined), or null if it
	     * doesn't exist.
	     */
	    get(key) {
	        if (this._root === null) {
	            return [];
	        }
	        const result = this._get(key, this._root);
	        if (result === null) {
	            return [];
	        }
	        if (!result.value) {
	            return [];
	        }
	        return result.value;
	    }
	    /**
	     * Gets the value of a node within the tree with a specific key.
	     * @param key The key being searched for.
	     * @param root The root of the tree to search in.
	     * @return The value of the node or null if it doesn't exist.
	     */
	    _get(key, root) {
	        const result = this._compare(key, root.key);
	        if (result === 0) {
	            return root;
	        }
	        if (result < 0) {
	            if (!root.left) {
	                return null;
	            }
	            return this._get(key, root.left);
	        }
	        if (!root.right) {
	            return null;
	        }
	        return this._get(key, root.right);
	    }
	    /**
	     * Gets whether a node with a specific key is within the tree.
	     * @param key The key being searched for.
	     * @return Whether a node with the key exists.
	     */
	    contains(key) {
	        if (this._root === null) {
	            return false;
	        }
	        return !!this._get(key, this._root);
	    }
	    /**
	     * @return The minimum key in the tree or null if there are no nodes.
	     */
	    findMinimum() {
	        if (this._root === null) {
	            return null;
	        }
	        return this._minValueNode(this._root).key;
	    }
	    /**
	     * Gets the maximum key in the tree or null if there are no nodes.
	     */
	    findMaximum() {
	        if (this._root === null) {
	            return null;
	        }
	        return this._maxValueNode(this._root).key;
	    }
	    get numberOfKeys() {
	        var _a;
	        return ((_a = this._root) === null || _a === void 0 ? void 0 : _a.numberOfKeys()) || 0;
	    }
	    /**
	     * Gets the size of the tree.
	     */
	    get size() {
	        return this._size;
	    }
	    /**
	     * Gets whether the tree is empty.
	     */
	    get isEmpty() {
	        return this._size === 0;
	    }
	    /**
	     * Gets the minimum value node, rooted in a particular node.
	     * @param root The node to search.
	     * @return The node with the minimum key in the tree.
	     */
	    _minValueNode(root) {
	        let current = root;
	        while (current.left) {
	            current = current.left;
	        }
	        return current;
	    }
	    /**
	     * Gets the maximum value node, rooted in a particular node.
	     * @param root The node to search.
	     * @return The node with the maximum key in the tree.
	     */
	    _maxValueNode(root) {
	        let current = root;
	        while (current.right) {
	            current = current.right;
	        }
	        return current;
	    }
	    /**
	     * Gets the balance state of a node, indicating whether the left or right
	     * sub-trees are unbalanced.
	     * @param node The node to get the difference from.
	     * @return The BalanceState of the node.
	     */
	    _getBalanceState(node) {
	        const heightDifference = node.leftHeight - node.rightHeight;
	        switch (heightDifference) {
	            case -2:
	                return 0 /* UNBALANCED_RIGHT */;
	            case -1:
	                return 1 /* SLIGHTLY_UNBALANCED_RIGHT */;
	            case 1:
	                return 3 /* SLIGHTLY_UNBALANCED_LEFT */;
	            case 2:
	                return 4 /* UNBALANCED_LEFT */;
	            default:
	                return 2 /* BALANCED */;
	        }
	    }
	    executeOnEveryNode(fn) {
	        if (!this._root)
	            return;
	        return this._root.executeOnEveryNode(fn);
	    }
	    betweenBounds(query, lbm, ubm) {
	        if (!this._root)
	            return [];
	        return this._root.betweenBounds(query, lbm, ubm);
	    }
	}

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation. All rights reserved.
	Licensed under the Apache License, Version 2.0 (the "License"); you may not use
	this file except in compliance with the License. You may obtain a copy of the
	License at http://www.apache.org/licenses/LICENSE-2.0

	THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
	KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
	WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
	MERCHANTABLITY OR NON-INFRINGEMENT.

	See the Apache Version 2.0 License for specific language governing permissions
	and limitations under the License.
	***************************************************************************** */

	function __awaiter(thisArg, _arguments, P, generator) {
	    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
	    return new (P || (P = Promise))(function (resolve, reject) {
	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
	        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
	        step((generator = generator.apply(thisArg, _arguments || [])).next());
	    });
	}

	const memoryStores = {};
	const memoryAdapter = () => (name) => {
	    name = name.replace(/_\d(_\w+)$/, "$1"); // replacer is to make the sync demo work
	    memoryStores[name] = {};
	    return new MemoryStore(name);
	};
	class MemoryStore {
	    constructor(name) {
	        this.name = name;
	    }
	    removeStore() {
	        return __awaiter(this, void 0, void 0, function* () {
	            memoryStores[this.name] = {};
	            return true;
	        });
	    }
	    removeItem(itemID) {
	        return __awaiter(this, void 0, void 0, function* () {
	            delete memoryStores[this.name][itemID];
	            return true;
	        });
	    }
	    removeItems(ids) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const results = [];
	            for (let index = 0; index < ids.length; index++) {
	                const element = ids[index];
	                results.push(yield this.removeItem(element));
	            }
	            return results;
	        });
	    }
	    setItems(data) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const results = [];
	            for (let index = 0; index < data.length; index++) {
	                const element = data[index];
	                results.push(yield this.setItem(element.key, element.value));
	            }
	            return results;
	        });
	    }
	    getItems(keys) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const results = [];
	            for (let index = 0; index < keys.length; index++) {
	                const key = keys[index];
	                results.push({ key, value: yield this.getItem(key) });
	            }
	            return results;
	        });
	    }
	    setItem(itemID, itemData) {
	        return __awaiter(this, void 0, void 0, function* () {
	            memoryStores[this.name][itemID] = itemData;
	            return true;
	        });
	    }
	    getItem(itemID) {
	        return __awaiter(this, void 0, void 0, function* () {
	            return memoryStores[this.name][itemID];
	        });
	    }
	    keys() {
	        return __awaiter(this, void 0, void 0, function* () {
	            return Object.keys(memoryStores[this.name]);
	        });
	    }
	}

	const lut = [];
	for (let i = 0; i < 256; i++) {
	    lut[i] = (i < 16 ? "0" : "") + i.toString(16);
	}
	function uid() {
	    let d0 = (Math.random() * 0xffffffff) | 0;
	    let d1 = (Math.random() * 0xffffffff) | 0;
	    let d2 = (Math.random() * 0xffffffff) | 0;
	    let d3 = (Math.random() * 0xffffffff) | 0;
	    return (lut[d0 & 0xff] +
	        lut[(d0 >> 8) & 0xff] +
	        lut[(d0 >> 16) & 0xff] +
	        lut[(d0 >> 24) & 0xff] +
	        "-" +
	        lut[d1 & 0xff] +
	        lut[(d1 >> 8) & 0xff] +
	        "-" +
	        lut[((d1 >> 16) & 0x0f) | 0x40] +
	        lut[(d1 >> 24) & 0xff] +
	        "-" +
	        lut[(d2 & 0x3f) | 0x80] +
	        lut[(d2 >> 8) & 0xff] +
	        "-" +
	        lut[(d2 >> 16) & 0xff] +
	        lut[(d2 >> 24) & 0xff] +
	        lut[d3 & 0xff] +
	        lut[(d3 >> 8) & 0xff] +
	        lut[(d3 >> 16) & 0xff] +
	        lut[(d3 >> 24) & 0xff]);
	}
	function randomString(len) {
	    return Array.from(new Uint8Array(120))
	        .map((x) => Math.random().toString(36))
	        .join("")
	        .split("0.")
	        .join("")
	        .substr(0, len);
	}
	/**
	 * Return an array with the numbers from 0 to n-1, in a random order
	 */
	function getRandomArray(n) {
	    let res = [];
	    for (let index = 0; index < n; index++) {
	        res.push(index);
	    }
	    res.sort(() => Math.random());
	    return res;
	}
	/**
	 * XXHash32
	*/
	function xxh(str, seed = 0) {
	    const encoder = new TextEncoder();
	    const input = encoder.encode(str);
	    const prime = 0x9e3779b1;
	    let hash = seed + 0xdeadbeef;
	    let len = input.length;
	    for (let i = 0; i + 4 <= len; i += 4) {
	        let word = (input[i] |
	            (input[i + 1] << 8) |
	            (input[i + 2] << 16) |
	            (input[i + 3] << 24)) >>>
	            0;
	        hash += word * prime;
	        hash = Math.imul(hash, prime);
	    }
	    if (len & 3) {
	        let lastBytes = input.slice(len - (len & 3));
	        let word = 0;
	        for (let i = 0; i < lastBytes.length; i++) {
	            word += lastBytes[i] << (i * 8);
	        }
	        hash += word * prime;
	        hash = Math.imul(hash, prime);
	    }
	    hash ^= hash >>> 15;
	    hash = Math.imul(hash, prime);
	    hash ^= hash >>> 13;
	    hash = Math.imul(hash, prime);
	    hash ^= hash >>> 16;
	    return hash >>> 0;
	}

	var customUtils = /*#__PURE__*/Object.freeze({
		__proto__: null,
		uid: uid,
		randomString: randomString,
		getRandomArray: getRandomArray,
		xxh: xxh
	});

	/**
	 * Check a key throw an error if the key is non valid
	 * Non-treatable edge cases here: if part of the object if of the form { $$date: number } or { $$deleted: true }
	 * Its serialized-then-deserialized version it will transformed into a Date object
	 * But you really need to want it to trigger such behaviour, even when warned not to use '$' at the beginning of the field names...
	 */
	function checkKey(k, v) {
	    if (typeof k === "number") {
	        k = k.toString();
	    }
	    if (k[0] === "$" &&
	        !(k === "$$date" && typeof v === "number") &&
	        !(k === "$$deleted" && v === true) &&
	        !(k === "$$indexCreated") &&
	        !(k === "$$indexRemoved")) {
	        throw new Error("Field names cannot begin with the $ character");
	    }
	    if (k.indexOf(".") !== -1) {
	        throw new Error("Field names cannot contain a .");
	    }
	}
	/**
	 * Check a DB object and throw an error if it's not valid
	 * Works by applying the above checkKey function to all fields recursively
	 */
	function checkObject(obj) {
	    if (Array.isArray(obj)) {
	        obj.forEach((o) => checkObject(o));
	    }
	    else if (typeof obj === "object" &&
	        obj !== null &&
	        !(obj instanceof Date)) {
	        Object.keys(obj).forEach(function (k) {
	            checkKey(k, obj[k]);
	            checkObject(obj[k]);
	        });
	    }
	}
	/**
	 * Serialize an object to be persisted to a one-line string
	 * For serialization/deserialization, we use the native JSON parser and not eval or Function
	 * That gives us less freedom but data entered in the database may come from users
	 * so eval and the like are not safe
	 * Accepted primitive types: Number, String, Boolean, Date, null
	 * Accepted secondary types: Objects, Arrays
	 */
	function serialize(obj) {
	    var res;
	    res = JSON.stringify(obj, function (k, v) {
	        checkKey(k, v);
	        if (v === undefined) {
	            return undefined;
	        }
	        if (v === null) {
	            return null;
	        }
	        // Hackish way of checking if object is Date.
	        // We can't use value directly because for dates it is already string in this function (date.toJSON was already called), so we use this
	        if (typeof this[k].getTime === "function") {
	            return { $$date: this[k].getTime() };
	        }
	        return v;
	    });
	    return res;
	}
	/**
	 * From a one-line representation of an object generate by the serialize function
	 * Return the object itself
	 */
	function deserialize(rawData) {
	    return JSON.parse(rawData, function (k, v) {
	        if (k === "$$date") {
	            return new Date(v);
	        }
	        if (typeof v === "string" ||
	            typeof v === "number" ||
	            typeof v === "boolean" ||
	            v === null) {
	            return v;
	        }
	        if (v && v.$$date) {
	            return v.$$date;
	        }
	        return v;
	    });
	}
	/**
	 * Deep copy a DB object
	 * The optional strictKeys flag (defaulting to false) indicates whether to copy everything or only fields
	 * where the keys are valid, i.e. don't begin with $ and don't contain a .
	 */
	function deepCopy(obj, model, strictKeys) {
	    let res = undefined;
	    if (typeof obj === "boolean" ||
	        typeof obj === "number" ||
	        typeof obj === "string" ||
	        obj === null ||
	        obj instanceof Date) {
	        return obj;
	    }
	    if (Array.isArray(obj)) {
	        res = [];
	        obj.forEach((o) => res.push(deepCopy(o, model, strictKeys)));
	        return res;
	    }
	    if (typeof obj === "object") {
	        res = {};
	        Object.keys(obj).forEach((k) => {
	            if (!strictKeys || (k[0] !== "$" && k.indexOf(".") === -1)) {
	                res[k] = deepCopy(obj[k], model, strictKeys);
	            }
	        });
	        if (res.hasOwnProperty("_id")) {
	            return model.new(res);
	        }
	        else {
	            return res;
	        }
	    }
	    return JSON.parse(JSON.stringify({ temp: obj })).temp;
	}
	/**
	 * Tells if an object is a primitive type or a "real" object
	 * Arrays are considered primitive
	 */
	function isPrimitiveType(obj) {
	    return (typeof obj === "boolean" ||
	        typeof obj === "number" ||
	        typeof obj === "string" ||
	        obj === null ||
	        obj instanceof Date ||
	        Array.isArray(obj));
	}
	function compareNSB(a, b) {
	    if (a < b) {
	        return -1;
	    }
	    if (a > b) {
	        return 1;
	    }
	    return 0;
	}
	function compareArrays(a, b) {
	    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
	        let comp = compareThings(a[i], b[i]);
	        if (comp !== 0) {
	            return comp;
	        }
	    }
	    // Common section was identical, longest one wins
	    return compareNSB(a.length, b.length);
	}
	/**
	 * Compare { things U undefined }
	 * Things are defined as any native types (string, number, boolean, null, date) and objects
	 * We need to compare with undefined as it will be used in indexes
	 * In the case of objects and arrays, we deep-compare
	 * If two objects don't have the same type, the (arbitrary) type hierarchy is: undefined, null, number, strings, boolean, dates, arrays, objects
	 * Return -1 if a < b, 1 if a > b and 0 if a = b (note that equality here is NOT the same as defined in areThingsEqual!)
	 *
	 */
	function compareThings(a, b, _compareStrings) {
	    const compareStrings = _compareStrings || compareNSB;
	    // undefined
	    if (a === undefined) {
	        return b === undefined ? 0 : -1;
	    }
	    if (b === undefined) {
	        return a === undefined ? 0 : 1;
	    }
	    // null
	    if (a === null) {
	        return b === null ? 0 : -1;
	    }
	    if (b === null) {
	        return a === null ? 0 : 1;
	    }
	    // Numbers
	    if (typeof a === "number") {
	        return typeof b === "number" ? compareNSB(a, b) : -1;
	    }
	    if (typeof b === "number") {
	        return typeof a === "number" ? compareNSB(a, b) : 1;
	    }
	    // Strings
	    if (typeof a === "string") {
	        return typeof b === "string" ? compareStrings(a, b) : -1;
	    }
	    if (typeof b === "string") {
	        return typeof a === "string" ? compareStrings(a, b) : 1;
	    }
	    // Booleans
	    if (typeof a === "boolean") {
	        return typeof b === "boolean" ? compareNSB(a, b) : -1;
	    }
	    if (typeof b === "boolean") {
	        return typeof a === "boolean" ? compareNSB(a, b) : 1;
	    }
	    // Dates
	    if (a instanceof Date) {
	        return b instanceof Date ? compareNSB(a.getTime(), b.getTime()) : -1;
	    }
	    if (b instanceof Date) {
	        return a instanceof Date ? compareNSB(a.getTime(), b.getTime()) : 1;
	    }
	    // Arrays (first element is most significant and so on)
	    if (Array.isArray(a)) {
	        return Array.isArray(b) ? compareArrays(a, b) : -1;
	    }
	    if (Array.isArray(b)) {
	        return Array.isArray(a) ? compareArrays(a, b) : 1;
	    }
	    // Objects
	    let aKeys = Object.keys(a).sort();
	    let bKeys = Object.keys(b).sort();
	    for (let i = 0; i < Math.min(aKeys.length, bKeys.length); i += 1) {
	        let comp = compareThings(a[aKeys[i]], b[bKeys[i]]);
	        if (comp !== 0) {
	            return comp;
	        }
	    }
	    return compareNSB(aKeys.length, bKeys.length);
	}
	// ==============================================================
	// Updating documents
	// ==============================================================
	/**
	 * The signature of modifier functions is as follows
	 * Their structure is always the same: recursively follow the dot notation while creating
	 * the nested documents if needed, then apply the "last step modifier"
	 */
	const lastStepModifierFunctions = {
	    $set: function (obj, field, value) {
	        if (!obj) {
	            return;
	        }
	        obj[field] = value;
	    },
	    $mul: function (obj, field, value) {
	        let base = obj[field];
	        if (typeof value !== "number" || typeof base !== "number") {
	            throw new Error("Multiply operator works only on numbers");
	        }
	        obj[field] = base * value;
	    },
	    $unset: function (obj, field) {
	        delete obj[field];
	    },
	    /**
	     * Push an element to the end of an array field
	     * Optional modifier $each instead of value to push several values
	     * Optional modifier $slice to slice the resulting array, see https://docs.mongodb.org/manual/reference/operator/update/slice/
	     * Differences with MongoDB: if $slice is specified and not $each, we act as if value is an empty array
	     */
	    $push: function (obj, field, value) {
	        // Create the array if it doesn't exist
	        if (!obj.hasOwnProperty(field)) {
	            obj[field] = [];
	        }
	        if (!Array.isArray(obj[field])) {
	            throw new Error("Can't $push an element on non-array values");
	        }
	        if (value !== null &&
	            typeof value === "object" &&
	            value["$slice"] &&
	            value["$each"] === undefined) {
	            value.$each = [];
	        }
	        if (value !== null &&
	            typeof value === "object" &&
	            value["$each"]) {
	            const eachVal = value["$each"];
	            const sliceVal = value["$slice"];
	            const posVal = value["$position"];
	            const sortVal = value["$sort"];
	            const allKeys = Object.keys(value);
	            if (Object.keys(value).length > 1) {
	                if (allKeys.filter((x) => {
	                    return (["$each", "$slice", "$position", "$sort"].indexOf(x) === -1);
	                }).length) {
	                    throw new Error("Can only use the modifiers $slice, $position and $sort in conjunction with $each when $push to array");
	                }
	            }
	            if (!Array.isArray(eachVal)) {
	                throw new Error("$each requires an array value");
	            }
	            if (posVal) {
	                for (let i = 0; i < eachVal.length; i++) {
	                    const element = eachVal[i];
	                    obj[field].splice(posVal + i, 0, element);
	                }
	            }
	            else {
	                eachVal.forEach((v) => obj[field].push(v));
	            }
	            if (sortVal) {
	                if (typeof sortVal === "number") {
	                    if (sortVal === 1)
	                        obj[field].sort((a, b) => compareThings(a, b));
	                    else
	                        obj[field].sort((a, b) => compareThings(b, a));
	                }
	                else {
	                    obj[field].sort((a, b) => {
	                        const keys = Object.keys(sortVal);
	                        for (let i = 0; i < keys.length; i++) {
	                            const key = keys[i];
	                            const order = sortVal[key];
	                            if (order === 1) {
	                                const comp = compareThings(a[key], b[key]);
	                                if (comp)
	                                    return comp;
	                            }
	                            else {
	                                const comp = compareThings(b[key], a[key]);
	                                if (comp)
	                                    return comp;
	                            }
	                        }
	                        return 0;
	                    });
	                }
	            }
	            if (sliceVal === undefined) {
	                return;
	            }
	            if (sliceVal !== undefined && typeof sliceVal !== "number") {
	                throw new Error("$slice requires a number value");
	            }
	            if (sliceVal === 0) {
	                obj[field] = [];
	            }
	            else {
	                let start = 0;
	                let end = 0;
	                let n = obj[field].length;
	                if (sliceVal < 0) {
	                    start = Math.max(0, n + sliceVal);
	                    end = n;
	                }
	                else if (sliceVal > 0) {
	                    start = 0;
	                    end = Math.min(n, sliceVal);
	                }
	                obj[field] = obj[field].slice(start, end);
	            }
	        }
	        else {
	            obj[field].push(value);
	        }
	    },
	    /**
	     * Add an element to an array field only if it is not already in it
	     * No modification if the element is already in the array
	     * Note that it doesn't check whether the original array contains duplicates
	     */
	    $addToSet: function (obj, field, value) {
	        // Create the array if it doesn't exist
	        if (!obj.hasOwnProperty(field)) {
	            obj[field] = [];
	        }
	        if (!Array.isArray(obj[field])) {
	            throw new Error("Can't $addToSet an element on non-array values");
	        }
	        const eachVal = value["$each"];
	        if (value !== null && typeof value === "object" && eachVal) {
	            if (Object.keys(value).length > 1) {
	                throw new Error("Can't use another field in conjunction with $each on $addToSet modifier");
	            }
	            if (!Array.isArray(eachVal)) {
	                throw new Error("$each requires an array value");
	            }
	            eachVal.forEach((v) => lastStepModifierFunctions.$addToSet(obj, field, v));
	        }
	        else {
	            let addToSet = true;
	            for (let index = 0; index < obj[field].length; index++) {
	                const element = obj[field][index];
	                if (compareThings(element, value) === 0) {
	                    addToSet = false;
	                    break;
	                }
	            }
	            if (addToSet) {
	                obj[field].push(value);
	            }
	        }
	    },
	    /**
	     * Remove the first or last element of an array
	     */
	    $pop: function (obj, field, value) {
	        if (!Array.isArray(obj[field])) {
	            throw new Error("Can't $pop an element from non-array values");
	        }
	        if (typeof value !== "number") {
	            throw new Error(value + " isn't an integer, can't use it with $pop");
	        }
	        if (value === 0) {
	            return;
	        }
	        if (value > 0) {
	            obj[field] = obj[field].slice(0, obj[field].length - 1);
	        }
	        else {
	            obj[field] = obj[field].slice(1);
	        }
	    },
	    /**
	     * Removes all instances of a value from an existing array
	     */
	    $pull: function (obj, field, value) {
	        if (!Array.isArray(obj[field])) {
	            throw new Error("Can't $pull an element from non-array values");
	        }
	        let arr = obj[field];
	        for (let i = arr.length - 1; i >= 0; i -= 1) {
	            if (match(arr[i], value)) {
	                arr.splice(i, 1);
	            }
	        }
	    },
	    /**
	     * Removes all instances of a value from an existing array
	     */
	    $pullAll: function (obj, field, value) {
	        if (!Array.isArray(obj[field])) {
	            throw new Error("Can't $pull an element from non-array values");
	        }
	        let arr = obj[field];
	        for (let i = arr.length - 1; i >= 0; i -= 1) {
	            for (let j = 0; j < value.length; j++) {
	                if (match(arr[i], value[j])) {
	                    arr.splice(i, 1);
	                }
	            }
	        }
	    },
	    /**
	     * Increment a numeric field's value
	     */
	    $inc: function (obj, field, value) {
	        if (typeof value !== "number") {
	            throw new Error(value + " must be a number");
	        }
	        if (typeof obj[field] !== "number") {
	            if (!obj.hasOwnProperty(field)) {
	                obj[field] = value;
	            }
	            else {
	                throw new Error("Can't use the $inc modifier on non-number fields");
	            }
	        }
	        else {
	            obj[field] = obj[field] + value;
	        }
	    },
	    /**
	     * Updates the value of the field, only if specified field is greater than the current value of the field
	     */
	    $max: function (obj, field, value) {
	        if (typeof obj[field] === "undefined") {
	            obj[field] = value;
	        }
	        else if (value > obj[field]) {
	            obj[field] = value;
	        }
	    },
	    /**
	     * Updates the value of the field, only if specified field is smaller than the current value of the field
	     */
	    $min: function (obj, field, value) {
	        if (typeof obj[field] === "undefined") {
	            obj[field] = value;
	        }
	        else if (value < obj[field]) {
	            obj[field] = value;
	        }
	    },
	    $currentDate: function (obj, field, value) {
	        if (value === true) {
	            obj[field] = new Date();
	        }
	        else if (value.$type && value.$type === "timestamp") {
	            obj[field] = Date.now();
	        }
	        else if (value.$type && value.$type === "date") {
	            obj[field] = new Date();
	        }
	    },
	    $rename: function (obj, field, value) {
	        obj[value] = obj[field];
	        delete obj[field];
	    },
	    $setOnInsert: function () {
	        // if the operator reached here
	        // it means that the update was not actually an insertion.
	        // this operator is being dealt with at the datastore.ts file
	    },
	};
	// Given its name, create the complete modifier function
	function createModifierFunction(modifier) {
	    return function (obj, field, value) {
	        var fieldParts = typeof field === "string" ? field.split(".") : field;
	        if (fieldParts.length === 1) {
	            lastStepModifierFunctions[modifier](obj, field, value);
	        }
	        else {
	            if (obj[fieldParts[0]] === undefined) {
	                if (modifier === "$unset") {
	                    return;
	                } // Bad looking specific fix, needs to be generalized modifiers that behave like $unset are implemented
	                obj[fieldParts[0]] = {};
	            }
	            modifierFunctions[modifier](obj[fieldParts[0]], fieldParts.slice(1).join("."), value);
	        }
	    };
	}
	const modifierFunctions = {};
	// Actually create all modifier functions
	Object.keys(lastStepModifierFunctions).forEach(function (modifier) {
	    modifierFunctions[modifier] = createModifierFunction(modifier);
	});
	/**
	 * Modify a DB object according to an update query
	 */
	function modify(obj, updateQuery, model) {
	    var keys = Object.keys(updateQuery);
	    let firstChars = keys.map((x) => x.charAt(0));
	    let dollarFirstChars = firstChars.filter((x) => x === "$");
	    if (keys.indexOf("_id") !== -1 &&
	        updateQuery["_id"] !== obj._id) {
	        throw new Error("You cannot change a document's _id");
	    }
	    if (dollarFirstChars.length !== 0 &&
	        dollarFirstChars.length !== firstChars.length) {
	        throw new Error("You cannot mix modifiers and normal fields");
	    }
	    let newDoc;
	    if (dollarFirstChars.length === 0) {
	        // Simply replace the object with the update query contents
	        newDoc = deepCopy(updateQuery, model);
	        newDoc._id = obj._id;
	    }
	    else {
	        // Apply modifiers
	        let modifiers = Array.from(new Set(keys));
	        newDoc = deepCopy(obj, model);
	        modifiers.forEach(function (modifier) {
	            let modArgument = updateQuery[modifier];
	            if (!modifierFunctions[modifier]) {
	                throw new Error("Unknown modifier " + modifier);
	            }
	            // Can't rely on Object.keys throwing on non objects since ES6
	            // Not 100% satisfying as non objects can be interpreted as objects but no false negatives so we can live with it
	            if (typeof modArgument !== "object") {
	                throw new Error("Modifier " + modifier + "'s argument must be an object");
	            }
	            let keys = Object.keys(modArgument);
	            keys.forEach(function (k) {
	                modifierFunctions[modifier](newDoc, k, modArgument[k]);
	            });
	        });
	    }
	    // Check result is valid and return it
	    checkObject(newDoc);
	    if (obj._id !== newDoc._id) {
	        throw new Error("You can't change a document's _id");
	    }
	    return newDoc;
	}
	// ==============================================================
	// Finding documents
	// ==============================================================
	/**
	 * Get a value from object with dot notation
	 */
	function getDotValue(obj, field) {
	    const fieldParts = typeof field === "string" ? field.split(".") : field;
	    if (!obj) {
	        return undefined;
	    } // field cannot be empty so that means we should return undefined so that nothing can match
	    if (fieldParts.length === 0) {
	        return obj;
	    }
	    if (fieldParts.length === 1) {
	        return obj[fieldParts[0]];
	    }
	    if (Array.isArray(obj[fieldParts[0]])) {
	        // If the next field is an integer, return only this item of the array
	        let i = parseInt(fieldParts[1], 10);
	        if (typeof i === "number" && !isNaN(i)) {
	            return getDotValue(obj[fieldParts[0]][i], fieldParts.slice(2));
	        }
	        // Return the array of values
	        let objects = new Array();
	        for (let i = 0; i < obj[fieldParts[0]].length; i += 1) {
	            objects.push(getDotValue(obj[fieldParts[0]][i], fieldParts.slice(1)));
	        }
	        return objects;
	    }
	    else {
	        return getDotValue(obj[fieldParts[0]], fieldParts.slice(1));
	    }
	}
	/**
	 * Check whether 'things' are equal
	 * Things are defined as any native types (string, number, boolean, null, date) and objects
	 * In the case of object, we check deep equality
	 * Returns true if they are, false otherwise
	 */
	function areThingsEqual(a, b) {
	    var aKeys, bKeys, i;
	    // Strings, booleans, numbers, null
	    if (a === null ||
	        typeof a === "string" ||
	        typeof a === "boolean" ||
	        typeof a === "number" ||
	        b === null ||
	        typeof b === "string" ||
	        typeof b === "boolean" ||
	        typeof b === "number") {
	        return a === b;
	    }
	    // Dates
	    if (a instanceof Date || b instanceof Date) {
	        return (a instanceof Date &&
	            b instanceof Date &&
	            a.getTime() === b.getTime());
	    }
	    // Arrays (no match since arrays are used as a $in)
	    // undefined (no match since they mean field doesn't exist and can't be serialized)
	    if ((!(Array.isArray(a) && Array.isArray(b)) &&
	        (Array.isArray(a) || Array.isArray(b))) ||
	        a === undefined ||
	        b === undefined) {
	        return false;
	    }
	    // General objects (check for deep equality)
	    // a and b should be objects at this point
	    try {
	        aKeys = Object.keys(a);
	        bKeys = Object.keys(b);
	    }
	    catch (e) {
	        return false;
	    }
	    if (aKeys.length !== bKeys.length) {
	        return false;
	    }
	    for (i = 0; i < aKeys.length; i += 1) {
	        if (bKeys.indexOf(aKeys[i]) === -1) {
	            return false;
	        }
	        if (!areThingsEqual(a[aKeys[i]], b[aKeys[i]])) {
	            return false;
	        }
	    }
	    return true;
	}
	/**
	 * Check that two values are comparable
	 */
	function areComparable(a, b) {
	    if (typeof a !== "string" &&
	        typeof a !== "number" &&
	        !(a instanceof Date) &&
	        typeof b !== "string" &&
	        typeof b !== "number" &&
	        !(b instanceof Date)) {
	        return false;
	    }
	    if (typeof a !== typeof b) {
	        return false;
	    }
	    return true;
	}
	const comparisonFunctions = {};
	/**
	 * Arithmetic and comparison operators
	 */
	comparisonFunctions.$type = function (a, b) {
	    if (["number", "boolean", "string", "undefined"].indexOf(b) > -1) {
	        return typeof a === b;
	    }
	    else if (b === "array") {
	        return Array.isArray(a);
	    }
	    else if (b === "null") {
	        return a === null;
	    }
	    else if (b === "date") {
	        return a instanceof Date;
	    }
	    else if (b === "object") {
	        return (typeof a === "object" &&
	            !(a instanceof Date) &&
	            !(a === null) &&
	            !Array.isArray(a));
	    }
	    else
	        return false;
	};
	comparisonFunctions.$not = function (a, b) {
	    return !match({ k: a }, { k: b });
	};
	comparisonFunctions.$eq = function (a, b) {
	    return areThingsEqual(a, b);
	};
	comparisonFunctions.$lt = function (a, b) {
	    return areComparable(a, b) && a < b;
	};
	comparisonFunctions.$lte = function (a, b) {
	    return areComparable(a, b) && a <= b;
	};
	comparisonFunctions.$gt = function (a, b) {
	    return areComparable(a, b) && a > b;
	};
	comparisonFunctions.$gte = function (a, b) {
	    return areComparable(a, b) && a >= b;
	};
	comparisonFunctions.$mod = function (a, b) {
	    if (!Array.isArray(b)) {
	        throw new Error("malformed mod, must be supplied with an array");
	    }
	    if (b.length !== 2) {
	        throw new Error("malformed mod, array length must be exactly two, a divisor and a remainder");
	    }
	    return a % b[0] === b[1];
	};
	comparisonFunctions.$ne = function (a, b) {
	    if (a === undefined) {
	        return true;
	    }
	    return !areThingsEqual(a, b);
	};
	comparisonFunctions.$in = function (a, b) {
	    var i;
	    if (!Array.isArray(b)) {
	        throw new Error("$in operator called with a non-array");
	    }
	    for (i = 0; i < b.length; i += 1) {
	        if (areThingsEqual(a, b[i])) {
	            return true;
	        }
	    }
	    return false;
	};
	comparisonFunctions.$nin = function (a, b) {
	    if (!Array.isArray(b)) {
	        throw new Error("$nin operator called with a non-array");
	    }
	    return !comparisonFunctions.$in(a, b);
	};
	comparisonFunctions.$regex = function (a, b) {
	    if (!(b instanceof RegExp)) {
	        throw new Error("$regex operator called with non regular expression");
	    }
	    if (typeof a !== "string") {
	        return false;
	    }
	    else {
	        return b.test(a);
	    }
	};
	comparisonFunctions.$exists = function (value, exists) {
	    if (exists || exists === "") {
	        // This will be true for all values of exists except false, null, undefined and 0
	        exists = true; // That's strange behaviour (we should only use true/false) but that's the way Mongo does it...
	    }
	    else {
	        exists = false;
	    }
	    if (value === undefined) {
	        return !exists;
	    }
	    else {
	        return exists;
	    }
	};
	// Specific to arrays
	comparisonFunctions.$size = function (obj, value) {
	    if (!Array.isArray(obj)) {
	        return false;
	    }
	    if (value % 1 !== 0) {
	        throw new Error("$size operator called without an integer");
	    }
	    return (obj.length === value);
	};
	comparisonFunctions.$elemMatch = function (obj, value) {
	    if (!Array.isArray(obj)) {
	        return false;
	    }
	    var i = obj.length;
	    var result = false; // Initialize result
	    while (i--) {
	        if (match(obj[i], value)) {
	            // If match for array element, return true
	            result = true;
	            break;
	        }
	    }
	    return result;
	};
	comparisonFunctions.$all = function (a, b) {
	    if (!Array.isArray(a)) {
	        throw new Error("$all must be applied on fields of type array");
	    }
	    if (!Array.isArray(b)) {
	        throw new Error("$all must be supplied with argument of type array");
	    }
	    for (let i = 0; i < b.length; i++) {
	        const elementInArgument = b[i];
	        if (a.indexOf(elementInArgument) === -1) {
	            return false;
	        }
	    }
	    return true;
	};
	const arrayComparisonFunctions = {};
	arrayComparisonFunctions.$size = true;
	arrayComparisonFunctions.$elemMatch = true;
	arrayComparisonFunctions.$all = true;
	const logicalOperators = {};
	/**
	 * Match any of the subqueries
	 */
	logicalOperators.$or = function (obj, query) {
	    var i;
	    if (!Array.isArray(query)) {
	        throw new Error("$or operator used without an array");
	    }
	    for (i = 0; i < query.length; i += 1) {
	        if (match(obj, query[i])) {
	            return true;
	        }
	    }
	    return false;
	};
	/**
	 * Match all of the subqueries
	 */
	logicalOperators.$and = function (obj, query) {
	    if (!Array.isArray(query)) {
	        throw new Error("$and operator used without an array");
	    }
	    for (let i = 0; i < query.length; i += 1) {
	        if (!match(obj, query[i])) {
	            return false;
	        }
	    }
	    return true;
	};
	/**
	 * Match non of the subqueries
	 */
	logicalOperators.$nor = function (obj, query) {
	    if (!Array.isArray(query)) {
	        throw new Error("$nor operator used without an array");
	    }
	    for (let i = 0; i < query.length; i += 1) {
	        if (match(obj, query[i])) {
	            return false;
	        }
	    }
	    return true;
	};
	/**
	 * Use a function to match
	 */
	logicalOperators.$where = function (obj, fn) {
	    var result;
	    if (typeof fn !== "function") {
	        throw new Error("$where operator used without a function");
	    }
	    result = fn.call(obj);
	    if (typeof result !== "boolean") {
	        throw new Error("$where function must return boolean");
	    }
	    return result;
	};
	/**
	 * Tell if a given document matches a query
	 */
	function match(obj, query) {
	    // Primitive query against a primitive type
	    // This is a bit of a hack since we construct an object with an arbitrary key only to dereference it later
	    // But I don't have time for a cleaner implementation now
	    if (isPrimitiveType(obj) || isPrimitiveType(query)) {
	        return matchQueryPart({ needAKey: obj }, "needAKey", query);
	    }
	    // Normal query
	    let queryKeys = Object.keys(query);
	    for (let i = 0; i < queryKeys.length; i += 1) {
	        let queryKey = queryKeys[i];
	        let queryValue = query[queryKey];
	        if (queryKey[0] === "$") {
	            if (!logicalOperators[queryKey]) {
	                throw new Error("Unknown logical operator " + queryKey);
	            }
	            if (!logicalOperators[queryKey](obj, queryValue)) {
	                return false;
	            }
	        }
	        else {
	            if (!matchQueryPart(obj, queryKey, queryValue)) {
	                return false;
	            }
	        }
	    }
	    return true;
	}
	/**
	 * Match an object against a specific { key: value } part of a query
	 * if the treatObjAsValue flag is set, don't try to match every part separately, but the array as a whole
	 */
	function matchQueryPart(obj, queryKey, queryValue, treatObjAsValue) {
	    const objValue = getDotValue(obj, queryKey);
	    // Check if the value is an array if we don't force a treatment as value
	    if (Array.isArray(objValue) && !treatObjAsValue) {
	        // If the queryValue is an array, try to perform an exact match
	        if (Array.isArray(queryValue)) {
	            return matchQueryPart(obj, queryKey, queryValue, true);
	        }
	        // Check if we are using an array-specific comparison function
	        if (queryValue !== null &&
	            typeof queryValue === "object" &&
	            !(queryValue instanceof RegExp)) {
	            let keys = Object.keys(queryValue);
	            for (let i = 0; i < keys.length; i += 1) {
	                if (arrayComparisonFunctions[keys[i]]) {
	                    return matchQueryPart(obj, queryKey, queryValue, true);
	                }
	            }
	        }
	        // If not, treat it as an array of { obj, query } where there needs to be at least one match
	        for (let i = 0; i < objValue.length; i += 1) {
	            // edge case: using $ne on array
	            if (queryValue["$ne"]) {
	                if (objValue.indexOf(queryValue["$ne"]) !== -1) {
	                    return false;
	                }
	            }
	            if (Array.isArray(queryValue["$nin"])) {
	                const intersection = queryValue["$nin"].filter((value) => -1 !== objValue.indexOf(value));
	                if (intersection.length) {
	                    return false;
	                }
	            }
	            if (matchQueryPart({ k: objValue[i] }, "k", queryValue)) {
	                return true;
	            } // k here could be any string
	        }
	        return false;
	    }
	    // queryValue is an actual object. Determine whether it contains comparison operators
	    // or only normal fields. Mixed objects are not allowed
	    if (queryValue !== null &&
	        typeof queryValue === "object" &&
	        !(queryValue instanceof RegExp) &&
	        !Array.isArray(queryValue)) {
	        let keys = Object.keys(queryValue);
	        let firstChars = keys.map((item) => item[0]);
	        let dollarFirstChars = firstChars.filter((c) => c === "$");
	        if (dollarFirstChars.length !== 0 &&
	            dollarFirstChars.length !== firstChars.length) {
	            throw new Error("You cannot mix operators and normal fields");
	        }
	        // queryValue is an object of this form: { $comparisonOperator1: value1, ... }
	        if (dollarFirstChars.length > 0) {
	            for (let i = 0; i < keys.length; i += 1) {
	                if (!comparisonFunctions[keys[i]]) {
	                    throw new Error("Unknown comparison function " + keys[i]);
	                }
	                if (!comparisonFunctions[keys[i]](objValue, queryValue[keys[i]])) {
	                    return false;
	                }
	            }
	            return true;
	        }
	    }
	    // Using regular expressions with basic querying
	    if (queryValue instanceof RegExp) {
	        return comparisonFunctions.$regex(objValue, queryValue);
	    }
	    // queryValue is either a native value or a normal object
	    // Basic matching is possible
	    if (!areThingsEqual(objValue, queryValue)) {
	        return false;
	    }
	    return true;
	}

	var modelling = /*#__PURE__*/Object.freeze({
		__proto__: null,
		serialize: serialize,
		deserialize: deserialize,
		deepCopy: deepCopy,
		checkObject: checkObject,
		isPrimitiveType: isPrimitiveType,
		modify: modify,
		getDotValue: getDotValue,
		match: match,
		areThingsEqual: areThingsEqual,
		compareThings: compareThings
	});

	/**
	 * Create a new cursor for this collection
	 */
	class Cursor {
	    constructor(db, query) {
	        this.db = db;
	        this.query = query || {};
	    }
	    /**
	     * Set a limit to the number of results
	     */
	    limit(limit) {
	        this._limit = limit;
	        return this;
	    }
	    /**
	     * Skip a the number of results
	     */
	    skip(skip) {
	        this._skip = skip;
	        return this;
	    }
	    /**
	     * Sort results of the query
	     */
	    sort(sortQuery) {
	        this._sort = sortQuery;
	        return this;
	    }
	    /**
	     * Add the use of a projection
	     */
	    projection(projection) {
	        this._projection = projection;
	        return this;
	    }
	    /**
	     * Apply the projection
	     */
	    _project(candidates) {
	        if (this._projection === undefined ||
	            Object.keys(this._projection).length === 0) {
	            return candidates;
	        }
	        let res = [];
	        let keepId = this._projection._id !== 0;
	        delete this._projection._id;
	        let keys = Object.keys(this._projection);
	        // Check for consistency
	        // either all are 0, or all are -1
	        let actions = keys.map((k) => this._projection[k]).sort();
	        if (actions[0] !== actions[actions.length - 1]) {
	            throw new Error("Can't both keep and omit fields except for _id");
	        }
	        let action = actions[0];
	        // Do the actual projection
	        candidates.forEach((candidate) => {
	            let toPush = {};
	            if (action === 1) {
	                // pick-type projection
	                toPush = { $set: {} };
	                keys.forEach((k) => {
	                    toPush.$set[k] = getDotValue(candidate, k);
	                    if (toPush.$set[k] === undefined) {
	                        delete toPush.$set[k];
	                    }
	                });
	                toPush = modify({}, toPush, this.db.model);
	            }
	            else {
	                // omit-type projection
	                toPush = { $unset: {} };
	                keys.forEach((k) => {
	                    toPush.$unset[k] = true;
	                });
	                toPush = modify(candidate, toPush, this.db.model);
	            }
	            if (keepId) {
	                toPush._id = candidate._id;
	            }
	            else {
	                delete toPush._id;
	            }
	            res.push(toPush);
	        });
	        return res;
	    }
	    /**
	     * Get all matching elements
	     * Will return pointers to matched elements (shallow copies), returning full copies is the role of find or findOne
	     *
	     */
	    __exec_unsafe() {
	        return __awaiter(this, void 0, void 0, function* () {
	            let res = [];
	            let added = 0;
	            let skipped = 0;
	            const candidates = yield this.db.getCandidates(this.query);
	            for (let i = 0; i < candidates.length; i++) {
	                if (match(candidates[i], this.query)) {
	                    // If a sort is defined, wait for the results to be sorted before applying limit and skip
	                    if (!this._sort) {
	                        if (this._skip && this._skip > skipped) {
	                            skipped++;
	                        }
	                        else {
	                            res.push(candidates[i]);
	                            added++;
	                            if (this._limit && this._limit <= added) {
	                                break;
	                            }
	                        }
	                    }
	                    else {
	                        res.push(candidates[i]);
	                    }
	                }
	            }
	            // Apply all sorts
	            if (this._sort) {
	                let keys = Object.keys(this._sort);
	                // Sorting
	                const criteria = [];
	                for (let i = 0; i < keys.length; i++) {
	                    let key = keys[i];
	                    criteria.push({ key, direction: this._sort[key] });
	                }
	                res.sort((a, b) => {
	                    let criterion;
	                    let compare;
	                    let i;
	                    for (i = 0; i < criteria.length; i++) {
	                        criterion = criteria[i];
	                        compare =
	                            criterion.direction *
	                                compareThings(getDotValue(a, criterion.key), getDotValue(b, criterion.key));
	                        if (compare !== 0) {
	                            return compare;
	                        }
	                    }
	                    return 0;
	                });
	                // Applying limit and skip
	                const limit = this._limit || res.length;
	                const skip = this._skip || 0;
	                res = res.slice(skip, skip + limit);
	            }
	            // Apply projection
	            res = this._project(res);
	            return res;
	        });
	    }
	    _exec() {
	        return __awaiter(this, void 0, void 0, function* () {
	            return this.db.q.add(() => this.__exec_unsafe());
	        });
	    }
	    exec() {
	        return __awaiter(this, void 0, void 0, function* () {
	            const originalsArr = yield this._exec();
	            const res = [];
	            for (let index = 0; index < originalsArr.length; index++) {
	                res.push(deepCopy(originalsArr[index], this.db.model));
	            }
	            return res;
	        });
	    }
	}

	/**
	 * Two indexed pointers are equal iif they point to the same place
	 */
	function checkValueEquality(a, b) {
	    return a === b;
	}
	/**
	 * Type-aware projection
	 */
	function projectForUnique(elt) {
	    if (elt === null) {
	        return "$NU";
	    }
	    if (typeof elt === "string") {
	        return "$ST" + elt;
	    }
	    if (typeof elt === "boolean") {
	        return "$BO" + elt;
	    }
	    if (typeof elt === "number") {
	        return "$NO" + elt;
	    }
	    if (elt instanceof Date) {
	        return "$DA" + elt.getTime();
	    }
	    return elt; // Arrays and objects, will check for pointer equality
	}
	function uniqueProjectedKeys(key) {
	    return Array.from(new Set(key.map((x) => projectForUnique(x)))).map((key) => {
	        if (typeof key === "string") {
	            return key.substr(3);
	        }
	        else
	            return key;
	    });
	}
	class Index {
	    constructor({ fieldName, unique, sparse, }) {
	        this.fieldName = "";
	        this.unique = false;
	        this.sparse = false;
	        this.treeOptions = {
	            unique: this.unique,
	            compareKeys: compareThings,
	            checkValueEquality,
	        };
	        if (fieldName) {
	            this.fieldName = fieldName;
	        }
	        if (unique) {
	            this.unique = unique;
	        }
	        if (sparse) {
	            this.sparse = sparse;
	        }
	        this.tree = new AvlTree(compareThings, this.unique);
	    }
	    reset() {
	        this.tree = new AvlTree(compareThings, this.unique);
	    }
	    /**
	     * Insert a new document in the index
	     * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
	     * O(log(n))
	     */
	    insert(doc) {
	        if (Array.isArray(doc)) {
	            this.insertMultipleDocs(doc);
	            return;
	        }
	        let key = getDotValue(doc, this.fieldName);
	        // We don't index documents that don't contain the field if the index is sparse
	        if (key === undefined && this.sparse) {
	            return;
	        }
	        if (!Array.isArray(key)) {
	            this.tree.insert(key, doc);
	        }
	        else {
	            // If an insert fails due to a unique constraint, roll back all inserts before it
	            let keys = uniqueProjectedKeys(key);
	            let error;
	            let failingIndex = -1;
	            for (let i = 0; i < keys.length; i++) {
	                try {
	                    this.tree.insert(keys[i], doc);
	                }
	                catch (e) {
	                    error = e;
	                    failingIndex = i;
	                    break;
	                }
	            }
	            if (error) {
	                for (let i = 0; i < failingIndex; i++) {
	                    this.tree.delete(keys[i], doc);
	                }
	                throw error;
	            }
	        }
	    }
	    /**
	     * Insert an array of documents in the index
	     * If a constraint is violated, the changes should be rolled back and an error thrown
	     *
	     */
	    insertMultipleDocs(docs) {
	        let error;
	        let failingI = -1;
	        for (let i = 0; i < docs.length; i++) {
	            try {
	                this.insert(docs[i]);
	            }
	            catch (e) {
	                error = e;
	                failingI = i;
	                break;
	            }
	        }
	        if (error) {
	            for (let i = 0; i < failingI; i++) {
	                this.remove(docs[i]);
	            }
	            throw error;
	        }
	    }
	    /**
	     * Remove a document from the index
	     * If an array is passed, we remove all its elements
	     * The remove operation is safe with regards to the 'unique' constraint
	     * O(log(n))
	     */
	    remove(doc) {
	        if (Array.isArray(doc)) {
	            doc.forEach((d) => this.remove(d));
	            return;
	        }
	        let key = getDotValue(doc, this.fieldName);
	        if (key === undefined && this.sparse) {
	            return;
	        }
	        if (!Array.isArray(key)) {
	            this.tree.delete(key, doc);
	        }
	        else {
	            uniqueProjectedKeys(key).forEach((_key) => this.tree.delete(_key, doc));
	        }
	    }
	    /**
	     * Update a document in the index
	     * If a constraint is violated, changes are rolled back and an error thrown
	     * Naive implementation, still in O(log(n))
	     */
	    update(oldDoc, newDoc) {
	        if (Array.isArray(oldDoc)) {
	            this.updateMultipleDocs(oldDoc);
	            return;
	        }
	        else if (newDoc) {
	            this.remove(oldDoc);
	            try {
	                this.insert(newDoc);
	            }
	            catch (e) {
	                this.insert(oldDoc);
	                throw e;
	            }
	        }
	    }
	    /**
	     * Update multiple documents in the index
	     * If a constraint is violated, the changes need to be rolled back
	     * and an error thrown
	     */
	    updateMultipleDocs(pairs) {
	        let failingI = -1;
	        let error;
	        for (let i = 0; i < pairs.length; i++) {
	            this.remove(pairs[i].oldDoc);
	        }
	        for (let i = 0; i < pairs.length; i++) {
	            try {
	                this.insert(pairs[i].newDoc);
	            }
	            catch (e) {
	                error = e;
	                failingI = i;
	                break;
	            }
	        }
	        // If an error was raised, roll back changes in the inverse order
	        if (error) {
	            for (let i = 0; i < failingI; i++) {
	                this.remove(pairs[i].newDoc);
	            }
	            for (let i = 0; i < pairs.length; i++) {
	                this.insert(pairs[i].oldDoc);
	            }
	            throw error;
	        }
	    }
	    /**
	     * Revert an update
	     */
	    revertUpdate(oldDoc, newDoc) {
	        var revert = [];
	        if (!Array.isArray(oldDoc) && newDoc) {
	            this.update(newDoc, oldDoc);
	        }
	        else if (Array.isArray(oldDoc)) {
	            oldDoc.forEach((pair) => {
	                revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
	            });
	            this.update(revert);
	        }
	    }
	    /**
	     * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
	     */
	    getMatching(input) {
	        if (!Array.isArray(input)) {
	            return this.tree.get(input);
	        }
	        else {
	            let res = [];
	            input.forEach((item) => {
	                this.tree.get(item).forEach(singleRes => {
	                    if (!singleRes || !singleRes._id) {
	                        return;
	                    }
	                    res.push(singleRes);
	                });
	            });
	            return res.filter((x, i) => res.indexOf(x) === i);
	        }
	    }
	    getAll() {
	        let data = [];
	        this.tree.executeOnEveryNode(function (node) {
	            data = data.concat(node.value);
	        });
	        return data;
	    }
	    getBetweenBounds(query) {
	        return this.tree.betweenBounds(query);
	    }
	}

	function promisifyRequest(request) {
	  return new Promise(function (resolve, reject) {
	    // @ts-ignore - file size hacks
	    request.oncomplete = request.onsuccess = function () {
	      return resolve(request.result);
	    }; // @ts-ignore - file size hacks


	    request.onabort = request.onerror = function () {
	      return reject(request.error);
	    };
	  });
	}

	function createStore(dbName, storeName) {
	  var request = indexedDB.open(dbName);

	  request.onupgradeneeded = function () {
	    return request.result.createObjectStore(storeName);
	  };

	  var dbp = promisifyRequest(request);
	  return function (txMode, callback) {
	    return dbp.then(function (db) {
	      return callback(db.transaction(storeName, txMode).objectStore(storeName));
	    });
	  };
	}

	var defaultGetStoreFunc;

	function defaultGetStore() {
	  if (!defaultGetStoreFunc) {
	    defaultGetStoreFunc = createStore('keyval-store', 'keyval');
	  }

	  return defaultGetStoreFunc;
	}
	/**
	 * Get a value by its key.
	 *
	 * @param key
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function get(key) {
	  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
	  return customStore('readonly', function (store) {
	    return promisifyRequest(store.get(key));
	  });
	}
	/**
	 * Set a value with a key.
	 *
	 * @param key
	 * @param value
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function set(key, value) {
	  var customStore = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultGetStore();
	  return customStore('readwrite', function (store) {
	    store.put(value, key);
	    return promisifyRequest(store.transaction);
	  });
	}
	/**
	 * Set multiple values at once. This is faster than calling set() multiple times.
	 * It's also atomic – if one of the pairs can't be added, none will be added.
	 *
	 * @param entries Array of entries, where each entry is an array of `[key, value]`.
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function setMany(entries) {
	  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
	  return customStore('readwrite', function (store) {
	    entries.forEach(function (entry) {
	      return store.put(entry[1], entry[0]);
	    });
	    return promisifyRequest(store.transaction);
	  });
	}
	/**
	 * Get multiple values by their keys
	 *
	 * @param keys
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function getMany(keys) {
	  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
	  return customStore('readonly', function (store) {
	    return Promise.all(keys.map(function (key) {
	      return promisifyRequest(store.get(key));
	    }));
	  });
	}
	/**
	 * Delete a particular key from the store.
	 *
	 * @param key
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function del(key) {
	  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
	  return customStore('readwrite', function (store) {
	    store.delete(key);
	    return promisifyRequest(store.transaction);
	  });
	}
	/**
	 * Delete multiple keys at once.
	 *
	 * @param keys List of keys to delete.
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function delMany(keys) {
	  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
	  return customStore('readwrite', function (store) {
	    keys.forEach(function (key) {
	      return store.delete(key);
	    });
	    return promisifyRequest(store.transaction);
	  });
	}
	/**
	 * Clear all values in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function clear() {
	  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
	  return customStore('readwrite', function (store) {
	    store.clear();
	    return promisifyRequest(store.transaction);
	  });
	}

	function eachCursor(store, callback) {
	  store.openCursor().onsuccess = function () {
	    if (!this.result) return;
	    callback(this.result);
	    this.result.continue();
	  };

	  return promisifyRequest(store.transaction);
	}
	/**
	 * Get all keys in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function keys() {
	  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
	  return customStore('readonly', function (store) {
	    // Fast path for modern browsers
	    if (store.getAllKeys) {
	      return promisifyRequest(store.getAllKeys());
	    }

	    var items = [];
	    return eachCursor(store, function (cursor) {
	      return items.push(cursor.key);
	    }).then(function () {
	      return items;
	    });
	  });
	}
	/**
	 * Get all values in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */


	function values() {
	  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
	  return customStore('readonly', function (store) {
	    // Fast path for modern browsers
	    if (store.getAll) {
	      return promisifyRequest(store.getAll());
	    }

	    var items = [];
	    return eachCursor(store, function (cursor) {
	      return items.push(cursor.value);
	    }).then(function () {
	      return items;
	    });
	  });
	}

	class IDB {
	    constructor(ref) {
	        this.store = createStore(ref, ref);
	    }
	    get(key) {
	        return get(key, this.store);
	    }
	    set(key, value) {
	        return set(key, value, this.store);
	    }
	    del(key) {
	        return del(key, this.store);
	    }
	    gets(keys) {
	        return getMany(keys, this.store);
	    }
	    sets(entries) {
	        return setMany(entries, this.store);
	    }
	    dels(keys) {
	        return delMany(keys, this.store);
	    }
	    keys() {
	        return keys(this.store);
	    }
	    values() {
	        return values(this.store);
	    }
	    clear() {
	        return clear(this.store);
	    }
	    length() {
	        return __awaiter(this, void 0, void 0, function* () {
	            return (yield this.keys()).length;
	        });
	    }
	}

	const justDiff = (o, n, sorter) => {
	  const nl = n.length;
	  let ni = 0;
	  let nv;

	  const ol = o.length;
	  let oi = 0;
	  let ov;

	  const unchanged = [];
	  const added = [];
	  const deleted = [];

	  while (ni < nl || oi < ol) {
	    nv = n[ni];
	    ov = o[oi];

	    if (nv === ov) {
	      unchanged.push(nv);

	      ni ++;
	      oi ++;

	    // THen, there is at least one deleted key
	    //////////////////////////////////////////////////
	    } else if (
	      // old key reached the end
	      oi === ol
	      // old key is less than new key -> nv is new
	      || sorter(ov, nv) > 0
	    ) {
	      added.push(nv);

	      ni ++;

	    // -> ov is deleted
	    } else {
	      deleted.push(ov);

	      oi ++;
	    }
	  }

	  return {
	    unchanged,
	    added,
	    deleted
	  }
	};

	const asc = (a, b) => a > b ? 1 : - 1;
	const desc = (a, b) => a < b ? 1 : - 1;

	const diff = (a, b) => {
	  a.sort(asc);
	  b.sort(asc);

	  return justDiff(a, b, asc)
	};

	var src = {
	  justDiff,
	  asc,
	  desc,
	  diff
	};

	class Sync {
	    constructor(persistence, log, rdata, rlogs) {
	        this.p = persistence;
	        this.rdata = rdata;
	        this.rlogs = rlogs;
	        this.log = log;
	    }
	    addToLog(d, t, timestamp) {
	        return __awaiter(this, void 0, void 0, function* () {
	            timestamp = timestamp || Date.now().toString(36); // create a timestamp if not provided by a remote change
	            yield this.log.set(timestamp, JSON.stringify({ d, t }));
	            yield this.log.set("$H", xxh(JSON.stringify((yield this.log.keys()).sort())).toString());
	        });
	    }
	    compareLog(localKeys, remoteKeys) {
	        let shouldHave = [];
	        let shouldSend = [];
	        const diff = src.justDiff(localKeys.sort(), remoteKeys.sort(), src.asc);
	        shouldHave = diff.added;
	        shouldSend = diff.deleted;
	        return {
	            shouldHave,
	            shouldSend,
	        };
	    }
	    sync() {
	        return new Promise((resolve) => {
	            let interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
	                if (!this.p.syncInProgress) {
	                    clearInterval(interval);
	                    this.p.syncInProgress = true;
	                    let syncResult = { sent: 0, received: 0 };
	                    try {
	                        syncResult = yield this._sync();
	                    }
	                    catch (e) {
	                        console.log(Error(e));
	                    }
	                    this.p.syncInProgress = false;
	                    resolve(syncResult);
	                }
	            }), 1);
	        });
	    }
	    _sync() {
	        return __awaiter(this, void 0, void 0, function* () {
	            const rHash = yield this.rlogs.getItem("$H");
	            const lHash = (yield this.log.get("$H")) || "0";
	            if (lHash === rHash || (lHash === "0" && rHash.indexOf("10009") > -1)) {
	                return { sent: 0, received: 0 };
	            }
	            const remoteKeys = (yield this.rlogs.keys()).filter((x) => x !== "$H");
	            const localKeys = (yield this.log.keys()).filter((x) => x !== "$H");
	            const diff = this.compareLog(localKeys, remoteKeys);
	            if (diff.shouldHave.length === 0 && diff.shouldSend.length === 0) {
	                // no diff, just not the same hash
	                yield this.rlogs.setItem("$H", xxh(JSON.stringify(remoteKeys.sort())).toString());
	                yield this.log.set("$H", xxh(JSON.stringify(localKeys.sort())).toString());
	                return { sent: 0, received: 0 };
	            }
	            const shouldHaves = (yield this.rlogs.getItems(diff.shouldHave)).map((x) => ({
	                timestamp: x.key,
	                value: JSON.parse(x.value),
	            }));
	            for (let index = 0; index < shouldHaves.length; index++) {
	                const e = shouldHaves[index];
	                if (e.value.t === "d") {
	                    yield this.p.deleteData(e.value.d, e.timestamp);
	                }
	                else {
	                    if (shouldHaves.find((x) => x.value.t === "d" && x.value.d === e.value.d)) {
	                        // if it has been deleted, add log only
	                        yield this.addToLog(e.value.d, "w", e.timestamp);
	                    }
	                    else {
	                        // otherwise write whole data (and log)
	                        yield this.p.writeData(e.value.d, yield this.rdata.getItem(e.value.d), e.timestamp);
	                    }
	                }
	            }
	            const shouldSend = yield Promise.all(diff.shouldSend.map((x) => __awaiter(this, void 0, void 0, function* () {
	                return ({
	                    timestamp: x,
	                    value: JSON.parse((yield this.log.get(x)) || ""),
	                });
	            })));
	            const deletions = shouldSend.filter((x) => x.value.t === "d");
	            const writes = shouldSend.filter((x) => x.value.t === "w" &&
	                !deletions.find((y) => y.value.d === x.value.d)
	            // shouldn't be deleted on the shouldSend
	            );
	            // deletions
	            yield this.rdata.removeItems(deletions.map((x) => x.value.d));
	            // writes
	            yield this.rdata.setItems(yield Promise.all(writes.map((x) => __awaiter(this, void 0, void 0, function* () {
	                return ({
	                    key: x.value.d,
	                    value: (yield this.p.data.get(x.value.d)) || "",
	                });
	            }))));
	            // write logs too
	            yield this.rlogs.setItems(shouldSend.map((x) => ({
	                key: x.timestamp,
	                value: JSON.stringify(x.value),
	            })));
	            // and hash
	            if (shouldSend.length) {
	                let allRemoteKeys = remoteKeys.concat(shouldSend.map((x) => x.timestamp));
	                yield this.rlogs.setItem("$H", xxh(JSON.stringify(allRemoteKeys.sort())).toString());
	            }
	            return {
	                sent: diff.shouldSend.length,
	                received: diff.shouldHave.length,
	            };
	        });
	    }
	}

	class PersistenceEvent {
	    constructor() {
	        this.callbacks = {
	            readLine: [],
	            writeLine: [],
	            end: [],
	        };
	    }
	    on(event, cb) {
	        if (!this.callbacks[event])
	            this.callbacks[event] = [];
	        this.callbacks[event].push(cb);
	    }
	    emit(event, data) {
	        return __awaiter(this, void 0, void 0, function* () {
	            let cbs = this.callbacks[event];
	            if (cbs) {
	                for (let i = 0; i < cbs.length; i++) {
	                    const cb = cbs[i];
	                    yield cb(data);
	                }
	            }
	        });
	    }
	}
	/**
	 * Create a new Persistence object for database options.db
	 */
	class Persistence {
	    constructor(options) {
	        this.ref = "";
	        this.syncInterval = 0;
	        this.syncInProgress = false;
	        this.corruptAlertThreshold = 0.1;
	        this.encode = (s) => s;
	        this.decode = (s) => s;
	        this._memoryIndexes = [];
	        this._memoryData = [];
	        this._model = options.model;
	        this.db = options.db;
	        this.ref = this.db.ref;
	        this.data = new IDB(this.ref + "_" + "d");
	        this.RSA = options.syncToRemote;
	        this.syncInterval = options.syncInterval || 0;
	        if (this.RSA) {
	            const rdata = this.RSA(this.ref + "_" + "d");
	            const rlogs = this.RSA(this.ref + "_" + "l");
	            this.sync = new Sync(this, new IDB(this.ref + "_" + "l"), rdata, rlogs);
	        }
	        if (this.RSA && this.syncInterval) {
	            setInterval(() => __awaiter(this, void 0, void 0, function* () {
	                if (!this.syncInProgress) {
	                    this.syncInProgress = true;
	                    try {
	                        yield this.sync._sync();
	                    }
	                    catch (e) {
	                        console.log(new Error(e));
	                    }
	                    this.syncInProgress = false;
	                }
	            }), this.syncInterval);
	        }
	        this.corruptAlertThreshold =
	            options.corruptAlertThreshold !== undefined
	                ? options.corruptAlertThreshold
	                : 0.1;
	        // encode and decode hooks with some basic sanity checks
	        if (options.encode && !options.decode) {
	            throw new Error("encode hook defined but decode hook undefined, cautiously refusing to start Datastore to prevent dataloss");
	        }
	        if (!options.encode && options.decode) {
	            throw new Error("decode hook defined but encode hook undefined, cautiously refusing to start Datastore to prevent dataloss");
	        }
	        this.encode =
	            options.encode || this.encode;
	        this.decode =
	            options.decode || this.decode;
	        let randomString$1 = randomString(113);
	        if (this.decode(this.encode(randomString$1)) !== randomString$1) {
	            throw new Error("encode is not the reverse of decode, cautiously refusing to start data store to prevent dataloss");
	        }
	    }
	    writeNewIndex(newIndexes) {
	        return __awaiter(this, void 0, void 0, function* () {
	            for (let i = 0; i < newIndexes.length; i++) {
	                const doc = newIndexes[i];
	                yield this.writeData(doc.$$indexCreated.fieldName, this.encode(serialize(doc)));
	            }
	        });
	    }
	    writeNewData(newDocs) {
	        return __awaiter(this, void 0, void 0, function* () {
	            for (let i = 0; i < newDocs.length; i++) {
	                const doc = newDocs[i];
	                yield this.writeData(doc._id || "", this.encode(serialize(doc)));
	            }
	        });
	    }
	    treatSingleLine(line) {
	        let treatedLine;
	        try {
	            treatedLine = deserialize(this.decode(line));
	            if (this._model) {
	                treatedLine = this._model.new(treatedLine);
	            }
	        }
	        catch (e) {
	            return {
	                type: "corrupt",
	                status: "remove",
	                data: false,
	            };
	        }
	        if (treatedLine._id && !(treatedLine.$$indexCreated || treatedLine.$$indexRemoved)) {
	            if (treatedLine.$$deleted === true) {
	                return {
	                    type: "doc",
	                    status: "remove",
	                    data: { _id: treatedLine._id },
	                };
	            }
	            else {
	                return {
	                    type: "doc",
	                    status: "add",
	                    data: treatedLine,
	                };
	            }
	        }
	        else if (treatedLine.$$indexCreated &&
	            treatedLine.$$indexCreated.fieldName !== undefined) {
	            return {
	                type: "index",
	                status: "add",
	                data: {
	                    fieldName: treatedLine.$$indexCreated.fieldName,
	                    data: treatedLine.$$indexCreated,
	                },
	            };
	        }
	        else if (typeof treatedLine.$$indexRemoved === "string") {
	            return {
	                type: "index",
	                status: "remove",
	                data: { fieldName: treatedLine.$$indexRemoved },
	            };
	        }
	        else {
	            return {
	                type: "corrupt",
	                status: "remove",
	                data: true,
	            };
	        }
	    }
	    /**
	     * Load the database
	     * 1) Create all indexes
	     * 2) Insert all data
	     */
	    loadDatabase() {
	        return __awaiter(this, void 0, void 0, function* () {
	            this.db.q.pause();
	            this.db.resetIndexes();
	            let corrupt = 0;
	            let processed = 0;
	            const indexes = [];
	            const data = [];
	            const eventEmitter = new PersistenceEvent();
	            eventEmitter.on("readLine", (line) => __awaiter(this, void 0, void 0, function* () {
	                processed++;
	                const treatedLine = this.treatSingleLine(line);
	                if (treatedLine.type === "doc") {
	                    data.push(treatedLine);
	                }
	                else if (treatedLine.type === "index") {
	                    indexes.push(treatedLine);
	                }
	                else if (!treatedLine.data) {
	                    corrupt++;
	                }
	            }));
	            yield this.readData(eventEmitter);
	            // treat indexes first
	            for (let index = 0; index < indexes.length; index++) {
	                const line = indexes[index];
	                if (line.status === "add") {
	                    this.db.indexes[line.data.fieldName] = new Index(line.data.data);
	                }
	                if (line.status === "remove") {
	                    delete this.db.indexes[line.data.fieldName];
	                }
	            }
	            // then data
	            for (let index = 0; index < data.length; index++) {
	                const line = data[index];
	                if (line.status === "add") {
	                    this.db.addToIndexes(line.data);
	                }
	                if (line.status === "remove") {
	                    this.db.removeFromIndexes(line.data);
	                }
	            }
	            if (processed > 0 && corrupt / processed > this.corruptAlertThreshold) {
	                throw new Error(`More than ${Math.floor(100 * this.corruptAlertThreshold)}% of the data file is corrupt, the wrong decode hook might have been used. Cautiously refusing to start Datastore to prevent dataloss`);
	            }
	            this.db.q.start();
	            return true;
	        });
	    }
	    readData(event) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const all = yield this.data.values();
	            for (let i = 0; i < all.length; i++) {
	                const line = all[i];
	                event.emit("readLine", line);
	            }
	            event.emit("end", "");
	        });
	    }
	    deleteData(_id, timestamp) {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this.data.del(_id);
	            if (this.sync) {
	                yield this.sync.addToLog(_id, "d", timestamp);
	            }
	        });
	    }
	    writeData(_id, data, timestamp) {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this.data.set(_id, data);
	            if (this.sync) {
	                yield this.sync.addToLog(_id, "w", timestamp);
	            }
	        });
	    }
	    clearData() {
	        return __awaiter(this, void 0, void 0, function* () {
	            // must go through the above functions so it can get logged
	            const list = yield this.data.keys();
	            for (let index = 0; index < list.length; index++) {
	                const element = list[index];
	                yield this.deleteData(element);
	            }
	        });
	    }
	}
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

	class BaseModel {
	    constructor() {
	        this._id = uid();
	    }
	    static new(data) {
	        const instance = new this();
	        const keys = Object.keys(data);
	        for (let i = 0; i < keys.length; i++) {
	            const key = keys[i];
	            instance[key] = data[key];
	        }
	        return instance;
	    }
	}

	function unwrapExports (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var eventemitter3 = createCommonjsModule(function (module) {

	var has = Object.prototype.hasOwnProperty
	  , prefix = '~';

	/**
	 * Constructor to create a storage for our `EE` objects.
	 * An `Events` instance is a plain object whose properties are event names.
	 *
	 * @constructor
	 * @private
	 */
	function Events() {}

	//
	// We try to not inherit from `Object.prototype`. In some engines creating an
	// instance in this way is faster than calling `Object.create(null)` directly.
	// If `Object.create(null)` is not supported we prefix the event names with a
	// character to make sure that the built-in object properties are not
	// overridden or used as an attack vector.
	//
	if (Object.create) {
	  Events.prototype = Object.create(null);

	  //
	  // This hack is needed because the `__proto__` property is still inherited in
	  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
	  //
	  if (!new Events().__proto__) prefix = false;
	}

	/**
	 * Representation of a single event listener.
	 *
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	 * @constructor
	 * @private
	 */
	function EE(fn, context, once) {
	  this.fn = fn;
	  this.context = context;
	  this.once = once || false;
	}

	/**
	 * Add a listener for a given event.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} once Specify if the listener is a one-time listener.
	 * @returns {EventEmitter}
	 * @private
	 */
	function addListener(emitter, event, fn, context, once) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('The listener must be a function');
	  }

	  var listener = new EE(fn, context || emitter, once)
	    , evt = prefix ? prefix + event : event;

	  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
	  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
	  else emitter._events[evt] = [emitter._events[evt], listener];

	  return emitter;
	}

	/**
	 * Clear event by name.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} evt The Event name.
	 * @private
	 */
	function clearEvent(emitter, evt) {
	  if (--emitter._eventsCount === 0) emitter._events = new Events();
	  else delete emitter._events[evt];
	}

	/**
	 * Minimal `EventEmitter` interface that is molded against the Node.js
	 * `EventEmitter` interface.
	 *
	 * @constructor
	 * @public
	 */
	function EventEmitter() {
	  this._events = new Events();
	  this._eventsCount = 0;
	}

	/**
	 * Return an array listing the events for which the emitter has registered
	 * listeners.
	 *
	 * @returns {Array}
	 * @public
	 */
	EventEmitter.prototype.eventNames = function eventNames() {
	  var names = []
	    , events
	    , name;

	  if (this._eventsCount === 0) return names;

	  for (name in (events = this._events)) {
	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
	  }

	  if (Object.getOwnPropertySymbols) {
	    return names.concat(Object.getOwnPropertySymbols(events));
	  }

	  return names;
	};

	/**
	 * Return the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Array} The registered listeners.
	 * @public
	 */
	EventEmitter.prototype.listeners = function listeners(event) {
	  var evt = prefix ? prefix + event : event
	    , handlers = this._events[evt];

	  if (!handlers) return [];
	  if (handlers.fn) return [handlers.fn];

	  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
	    ee[i] = handlers[i].fn;
	  }

	  return ee;
	};

	/**
	 * Return the number of listeners listening to a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Number} The number of listeners.
	 * @public
	 */
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
	  var evt = prefix ? prefix + event : event
	    , listeners = this._events[evt];

	  if (!listeners) return 0;
	  if (listeners.fn) return 1;
	  return listeners.length;
	};

	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Boolean} `true` if the event had listeners, else `false`.
	 * @public
	 */
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return false;

	  var listeners = this._events[evt]
	    , len = arguments.length
	    , args
	    , i;

	  if (listeners.fn) {
	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

	    switch (len) {
	      case 1: return listeners.fn.call(listeners.context), true;
	      case 2: return listeners.fn.call(listeners.context, a1), true;
	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
	    }

	    for (i = 1, args = new Array(len -1); i < len; i++) {
	      args[i - 1] = arguments[i];
	    }

	    listeners.fn.apply(listeners.context, args);
	  } else {
	    var length = listeners.length
	      , j;

	    for (i = 0; i < length; i++) {
	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

	      switch (len) {
	        case 1: listeners[i].fn.call(listeners[i].context); break;
	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
	        default:
	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
	            args[j - 1] = arguments[j];
	          }

	          listeners[i].fn.apply(listeners[i].context, args);
	      }
	    }
	  }

	  return true;
	};

	/**
	 * Add a listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.on = function on(event, fn, context) {
	  return addListener(this, event, fn, context, false);
	};

	/**
	 * Add a one-time listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.once = function once(event, fn, context) {
	  return addListener(this, event, fn, context, true);
	};

	/**
	 * Remove the listeners of a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn Only remove the listeners that match this function.
	 * @param {*} context Only remove the listeners that have this context.
	 * @param {Boolean} once Only remove one-time listeners.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return this;
	  if (!fn) {
	    clearEvent(this, evt);
	    return this;
	  }

	  var listeners = this._events[evt];

	  if (listeners.fn) {
	    if (
	      listeners.fn === fn &&
	      (!once || listeners.once) &&
	      (!context || listeners.context === context)
	    ) {
	      clearEvent(this, evt);
	    }
	  } else {
	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
	      if (
	        listeners[i].fn !== fn ||
	        (once && !listeners[i].once) ||
	        (context && listeners[i].context !== context)
	      ) {
	        events.push(listeners[i]);
	      }
	    }

	    //
	    // Reset the array, or remove it completely if we have no more listeners.
	    //
	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
	    else clearEvent(this, evt);
	  }

	  return this;
	};

	/**
	 * Remove all listeners, or those of the specified event.
	 *
	 * @param {(String|Symbol)} [event] The event name.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
	  var evt;

	  if (event) {
	    evt = prefix ? prefix + event : event;
	    if (this._events[evt]) clearEvent(this, evt);
	  } else {
	    this._events = new Events();
	    this._eventsCount = 0;
	  }

	  return this;
	};

	//
	// Alias methods names because people roll like that.
	//
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;

	//
	// Expose the prefix.
	//
	EventEmitter.prefixed = prefix;

	//
	// Allow `EventEmitter` to be imported as module namespace.
	//
	EventEmitter.EventEmitter = EventEmitter;

	//
	// Expose the module.
	//
	{
	  module.exports = EventEmitter;
	}
	});

	var pFinally = (promise, onFinally) => {
		onFinally = onFinally || (() => {});

		return promise.then(
			val => new Promise(resolve => {
				resolve(onFinally());
			}).then(() => val),
			err => new Promise(resolve => {
				resolve(onFinally());
			}).then(() => {
				throw err;
			})
		);
	};

	class TimeoutError extends Error {
		constructor(message) {
			super(message);
			this.name = 'TimeoutError';
		}
	}

	const pTimeout = (promise, milliseconds, fallback) => new Promise((resolve, reject) => {
		if (typeof milliseconds !== 'number' || milliseconds < 0) {
			throw new TypeError('Expected `milliseconds` to be a positive number');
		}

		if (milliseconds === Infinity) {
			resolve(promise);
			return;
		}

		const timer = setTimeout(() => {
			if (typeof fallback === 'function') {
				try {
					resolve(fallback());
				} catch (error) {
					reject(error);
				}

				return;
			}

			const message = typeof fallback === 'string' ? fallback : `Promise timed out after ${milliseconds} milliseconds`;
			const timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);

			if (typeof promise.cancel === 'function') {
				promise.cancel();
			}

			reject(timeoutError);
		}, milliseconds);

		// TODO: Use native `finally` keyword when targeting Node.js 10
		pFinally(
			// eslint-disable-next-line promise/prefer-await-to-then
			promise.then(resolve, reject),
			() => {
				clearTimeout(timer);
			}
		);
	});

	var pTimeout_1 = pTimeout;
	// TODO: Remove this for the next major release
	var _default = pTimeout;

	var TimeoutError_1 = TimeoutError;
	pTimeout_1.default = _default;
	pTimeout_1.TimeoutError = TimeoutError_1;

	var lowerBound_1 = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });
	// Port of lower_bound from http://en.cppreference.com/w/cpp/algorithm/lower_bound
	// Used to compute insertion index to keep queue sorted after insertion
	function lowerBound(array, value, comparator) {
	    let first = 0;
	    let count = array.length;
	    while (count > 0) {
	        const step = (count / 2) | 0;
	        let it = first + step;
	        if (comparator(array[it], value) <= 0) {
	            first = ++it;
	            count -= step + 1;
	        }
	        else {
	            count = step;
	        }
	    }
	    return first;
	}
	exports.default = lowerBound;
	});

	unwrapExports(lowerBound_1);

	var priorityQueue = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });

	class PriorityQueue {
	    constructor() {
	        Object.defineProperty(this, "_queue", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: []
	        });
	    }
	    enqueue(run, options) {
	        options = Object.assign({ priority: 0 }, options);
	        const element = {
	            priority: options.priority,
	            run
	        };
	        if (this.size && this._queue[this.size - 1].priority >= options.priority) {
	            this._queue.push(element);
	            return;
	        }
	        const index = lowerBound_1.default(this._queue, element, (a, b) => b.priority - a.priority);
	        this._queue.splice(index, 0, element);
	    }
	    dequeue() {
	        const item = this._queue.shift();
	        return item && item.run;
	    }
	    filter(options) {
	        return this._queue.filter(element => element.priority === options.priority).map(element => element.run);
	    }
	    get size() {
	        return this._queue.length;
	    }
	}
	exports.default = PriorityQueue;
	});

	unwrapExports(priorityQueue);

	var dist = createCommonjsModule(function (module, exports) {
	Object.defineProperty(exports, "__esModule", { value: true });



	const empty = () => { };
	const timeoutError = new pTimeout_1.TimeoutError();
	/**
	Promise queue with concurrency control.
	*/
	class PQueue extends eventemitter3 {
	    constructor(options) {
	        super();
	        Object.defineProperty(this, "_carryoverConcurrencyCount", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_isIntervalIgnored", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_intervalCount", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: 0
	        });
	        Object.defineProperty(this, "_intervalCap", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_interval", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_intervalEnd", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: 0
	        });
	        Object.defineProperty(this, "_intervalId", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_timeoutId", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_queue", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_queueClass", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_pendingCount", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: 0
	        });
	        // The `!` is needed because of https://github.com/microsoft/TypeScript/issues/32194
	        Object.defineProperty(this, "_concurrency", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_isPaused", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_resolveEmpty", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: empty
	        });
	        Object.defineProperty(this, "_resolveIdle", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: empty
	        });
	        Object.defineProperty(this, "_timeout", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        Object.defineProperty(this, "_throwOnTimeout", {
	            enumerable: true,
	            configurable: true,
	            writable: true,
	            value: void 0
	        });
	        // eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
	        options = Object.assign({ carryoverConcurrencyCount: false, intervalCap: Infinity, interval: 0, concurrency: Infinity, autoStart: true, queueClass: priorityQueue.default }, options
	        // TODO: Remove this `as`.
	        );
	        if (!(typeof options.intervalCap === 'number' && options.intervalCap >= 1)) {
	            throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${options.intervalCap}\` (${typeof options.intervalCap})`);
	        }
	        if (options.interval === undefined || !(Number.isFinite(options.interval) && options.interval >= 0)) {
	            throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${options.interval}\` (${typeof options.interval})`);
	        }
	        this._carryoverConcurrencyCount = options.carryoverConcurrencyCount;
	        this._isIntervalIgnored = options.intervalCap === Infinity || options.interval === 0;
	        this._intervalCap = options.intervalCap;
	        this._interval = options.interval;
	        this._queue = new options.queueClass();
	        this._queueClass = options.queueClass;
	        this.concurrency = options.concurrency;
	        this._timeout = options.timeout;
	        this._throwOnTimeout = options.throwOnTimeout === true;
	        this._isPaused = options.autoStart === false;
	    }
	    get _doesIntervalAllowAnother() {
	        return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
	    }
	    get _doesConcurrentAllowAnother() {
	        return this._pendingCount < this._concurrency;
	    }
	    _next() {
	        this._pendingCount--;
	        this._tryToStartAnother();
	    }
	    _resolvePromises() {
	        this._resolveEmpty();
	        this._resolveEmpty = empty;
	        if (this._pendingCount === 0) {
	            this._resolveIdle();
	            this._resolveIdle = empty;
	        }
	    }
	    _onResumeInterval() {
	        this._onInterval();
	        this._initializeIntervalIfNeeded();
	        this._timeoutId = undefined;
	    }
	    _isIntervalPaused() {
	        const now = Date.now();
	        if (this._intervalId === undefined) {
	            const delay = this._intervalEnd - now;
	            if (delay < 0) {
	                // Act as the interval was done
	                // We don't need to resume it here because it will be resumed on line 160
	                this._intervalCount = (this._carryoverConcurrencyCount) ? this._pendingCount : 0;
	            }
	            else {
	                // Act as the interval is pending
	                if (this._timeoutId === undefined) {
	                    this._timeoutId = setTimeout(() => {
	                        this._onResumeInterval();
	                    }, delay);
	                }
	                return true;
	            }
	        }
	        return false;
	    }
	    _tryToStartAnother() {
	        if (this._queue.size === 0) {
	            // We can clear the interval ("pause")
	            // Because we can redo it later ("resume")
	            if (this._intervalId) {
	                clearInterval(this._intervalId);
	            }
	            this._intervalId = undefined;
	            this._resolvePromises();
	            return false;
	        }
	        if (!this._isPaused) {
	            const canInitializeInterval = !this._isIntervalPaused();
	            if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
	                this.emit('active');
	                this._queue.dequeue()();
	                if (canInitializeInterval) {
	                    this._initializeIntervalIfNeeded();
	                }
	                return true;
	            }
	        }
	        return false;
	    }
	    _initializeIntervalIfNeeded() {
	        if (this._isIntervalIgnored || this._intervalId !== undefined) {
	            return;
	        }
	        this._intervalId = setInterval(() => {
	            this._onInterval();
	        }, this._interval);
	        this._intervalEnd = Date.now() + this._interval;
	    }
	    _onInterval() {
	        if (this._intervalCount === 0 && this._pendingCount === 0 && this._intervalId) {
	            clearInterval(this._intervalId);
	            this._intervalId = undefined;
	        }
	        this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
	        this._processQueue();
	    }
	    /**
	    Executes all queued functions until it reaches the limit.
	    */
	    _processQueue() {
	        // eslint-disable-next-line no-empty
	        while (this._tryToStartAnother()) { }
	    }
	    get concurrency() {
	        return this._concurrency;
	    }
	    set concurrency(newConcurrency) {
	        if (!(typeof newConcurrency === 'number' && newConcurrency >= 1)) {
	            throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
	        }
	        this._concurrency = newConcurrency;
	        this._processQueue();
	    }
	    /**
	    Adds a sync or async task to the queue. Always returns a promise.
	    */
	    async add(fn, options = {}) {
	        return new Promise((resolve, reject) => {
	            const run = async () => {
	                this._pendingCount++;
	                this._intervalCount++;
	                try {
	                    const operation = (this._timeout === undefined && options.timeout === undefined) ? fn() : pTimeout_1.default(Promise.resolve(fn()), (options.timeout === undefined ? this._timeout : options.timeout), () => {
	                        if (options.throwOnTimeout === undefined ? this._throwOnTimeout : options.throwOnTimeout) {
	                            reject(timeoutError);
	                        }
	                        return undefined;
	                    });
	                    resolve(await operation);
	                }
	                catch (error) {
	                    reject(error);
	                }
	                this._next();
	            };
	            this._queue.enqueue(run, options);
	            this._tryToStartAnother();
	        });
	    }
	    /**
	    Same as `.add()`, but accepts an array of sync or async functions.

	    @returns A promise that resolves when all functions are resolved.
	    */
	    async addAll(functions, options) {
	        return Promise.all(functions.map(async (function_) => this.add(function_, options)));
	    }
	    /**
	    Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
	    */
	    start() {
	        if (!this._isPaused) {
	            return this;
	        }
	        this._isPaused = false;
	        this._processQueue();
	        return this;
	    }
	    /**
	    Put queue execution on hold.
	    */
	    pause() {
	        this._isPaused = true;
	    }
	    /**
	    Clear the queue.
	    */
	    clear() {
	        this._queue = new this._queueClass();
	    }
	    /**
	    Can be called multiple times. Useful if you for example add additional items at a later time.

	    @returns A promise that settles when the queue becomes empty.
	    */
	    async onEmpty() {
	        // Instantly resolve if the queue is empty
	        if (this._queue.size === 0) {
	            return;
	        }
	        return new Promise(resolve => {
	            const existingResolve = this._resolveEmpty;
	            this._resolveEmpty = () => {
	                existingResolve();
	                resolve();
	            };
	        });
	    }
	    /**
	    The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.

	    @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
	    */
	    async onIdle() {
	        // Instantly resolve if none pending and if nothing else is queued
	        if (this._pendingCount === 0 && this._queue.size === 0) {
	            return;
	        }
	        return new Promise(resolve => {
	            const existingResolve = this._resolveIdle;
	            this._resolveIdle = () => {
	                existingResolve();
	                resolve();
	            };
	        });
	    }
	    /**
	    Size of the queue.
	    */
	    get size() {
	        return this._queue.size;
	    }
	    /**
	    Size of the queue, filtered by the given options.

	    For example, this can be used to find the number of items remaining in the queue with a specific priority level.
	    */
	    sizeBy(options) {
	        return this._queue.filter(options).length;
	    }
	    /**
	    Number of pending promises.
	    */
	    get pending() {
	        return this._pendingCount;
	    }
	    /**
	    Whether the queue is currently paused.
	    */
	    get isPaused() {
	        return this._isPaused;
	    }
	    /**
	    Set the timeout for future operations.
	    */
	    set timeout(milliseconds) {
	        this._timeout = milliseconds;
	    }
	    get timeout() {
	        return this._timeout;
	    }
	}
	exports.default = PQueue;
	});

	var pq = unwrapExports(dist);

	class Datastore {
	    constructor(options) {
	        this.ref = "db";
	        this.timestampData = false;
	        // rename to something denotes that it's an internal thing
	        this.q = new pq({
	            concurrency: 1,
	            autoStart: false,
	        });
	        this.indexes = {
	            _id: new Index({ fieldName: "_id", unique: true }),
	        };
	        this.ttlIndexes = {};
	        this.model = options.model || BaseModel;
	        if (options.ref) {
	            this.ref = options.ref;
	        }
	        // Persistence handling
	        this.persistence = new Persistence({
	            db: this,
	            model: options.model,
	            encode: options.encode,
	            decode: options.decode,
	            corruptAlertThreshold: options.corruptAlertThreshold || 0,
	            syncToRemote: options.syncToRemote,
	            syncInterval: options.syncInterval,
	        });
	        if (options.timestampData) {
	            this.timestampData = true;
	        }
	    }
	    /**
	     * Load the database from the datafile, and trigger the execution of buffered commands if any
	     */
	    loadDatabase() {
	        return __awaiter(this, void 0, void 0, function* () {
	            return yield this.persistence.loadDatabase();
	        });
	    }
	    /**
	     * Get an array of all the data in the database
	     */
	    getAllData() {
	        return this.indexes._id.getAll();
	    }
	    /**
	     * Reset all currently defined indexes
	     */
	    resetIndexes() {
	        Object.keys(this.indexes).forEach((i) => {
	            this.indexes[i].reset();
	        });
	    }
	    /**
	     * Ensure an index is kept for this field. Same parameters as lib/indexes
	     * For now this function is synchronous, we need to test how much time it takes
	     * We use an async API for consistency with the rest of the code
	     */
	    ensureIndex(options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            options = options || {};
	            if (!options.fieldName) {
	                let err = new Error("Cannot create an index without a fieldName");
	                err.missingFieldName = true;
	                throw err;
	            }
	            if (this.indexes[options.fieldName]) {
	                return { affectedIndex: options.fieldName };
	            }
	            this.indexes[options.fieldName] = new Index(options);
	            // TTL
	            if (options.expireAfterSeconds !== undefined) {
	                this.ttlIndexes[options.fieldName] = options.expireAfterSeconds;
	            }
	            // Index data
	            try {
	                this.indexes[options.fieldName].insert(this.getAllData());
	            }
	            catch (e) {
	                delete this.indexes[options.fieldName];
	                throw e;
	            }
	            // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
	            yield this.persistence.writeNewIndex([{ $$indexCreated: options }]);
	            return {
	                affectedIndex: options.fieldName,
	            };
	        });
	    }
	    /**
	     * Remove an index
	     */
	    removeIndex(fieldName) {
	        return __awaiter(this, void 0, void 0, function* () {
	            delete this.indexes[fieldName];
	            yield this.persistence.deleteData(fieldName);
	            return {
	                affectedIndex: fieldName,
	            };
	        });
	    }
	    /**
	     * Add one or several document(s) to all indexes
	     */
	    addToIndexes(doc) {
	        let failingIndex = -1;
	        let error;
	        const keys = Object.keys(this.indexes);
	        for (let i = 0; i < keys.length; i++) {
	            try {
	                this.indexes[keys[i]].insert(doc);
	            }
	            catch (e) {
	                failingIndex = i;
	                error = e;
	                break;
	            }
	        }
	        // If an error happened, we need to rollback the insert on all other indexes
	        if (error) {
	            for (let i = 0; i < failingIndex; i++) {
	                this.indexes[keys[i]].remove(doc);
	            }
	            throw error;
	        }
	    }
	    /**
	     * Remove one or several document(s) from all indexes
	     */
	    removeFromIndexes(doc) {
	        Object.keys(this.indexes).forEach((i) => {
	            this.indexes[i].remove(doc);
	        });
	    }
	    updateIndexes(oldDoc, newDoc) {
	        let failingIndex = -1;
	        let error;
	        const keys = Object.keys(this.indexes);
	        for (let i = 0; i < keys.length; i++) {
	            try {
	                this.indexes[keys[i]].update(oldDoc, newDoc);
	            }
	            catch (e) {
	                failingIndex = i;
	                error = e;
	                break;
	            }
	        }
	        // If an error happened, we need to rollback the update on all other indexes
	        if (error) {
	            for (let i = 0; i < failingIndex; i++) {
	                this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
	            }
	            throw error;
	        }
	    }
	    _isBasicType(value) {
	        return (typeof value === "string" ||
	            typeof value === "number" ||
	            typeof value === "boolean" ||
	            value instanceof Date ||
	            value === null);
	    }
	    /**
	     * This will return the least number of candidates,
	     * using Index if possible
	     * when failing it will return all the database
	     */
	    _leastCandidates(query) {
	        const currentIndexKeys = Object.keys(this.indexes);
	        const queryKeys = Object.keys(query);
	        let usableQueryKeys = [];
	        // possibility: basic match
	        queryKeys.forEach((k) => {
	            // only types that can't be used with . notation
	            if (this._isBasicType(query[k]) &&
	                currentIndexKeys.indexOf(k) !== -1) {
	                usableQueryKeys.push(k);
	            }
	        });
	        if (usableQueryKeys.length > 0) {
	            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]]);
	        }
	        // possibility: using $eq
	        queryKeys.forEach((k) => {
	            if (query[k] &&
	                query[k].hasOwnProperty("$eq") &&
	                this._isBasicType(query[k].$eq) &&
	                currentIndexKeys.indexOf(k) !== -1) {
	                usableQueryKeys.push(k);
	            }
	        });
	        if (usableQueryKeys.length > 0) {
	            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$eq);
	        }
	        // possibility: using $in
	        queryKeys.forEach((k) => {
	            if (query[k] &&
	                query[k].hasOwnProperty("$in") &&
	                currentIndexKeys.indexOf(k) !== -1) {
	                usableQueryKeys.push(k);
	            }
	        });
	        if (usableQueryKeys.length > 0) {
	            return this.indexes[usableQueryKeys[0]].getMatching(query[usableQueryKeys[0]].$in);
	        }
	        // possibility: using $lt $lte $gt $gte
	        queryKeys.forEach((k) => {
	            if (query[k] &&
	                currentIndexKeys.indexOf(k) !== -1 &&
	                (query[k].hasOwnProperty("$lt") ||
	                    query[k].hasOwnProperty("$lte") ||
	                    query[k].hasOwnProperty("$gt") ||
	                    query[k].hasOwnProperty("$gte"))) {
	                usableQueryKeys.push(k);
	            }
	        });
	        if (usableQueryKeys.length > 0) {
	            return this.indexes[usableQueryKeys[0]].getBetweenBounds(query[usableQueryKeys[0]]);
	        }
	        return this.getAllData();
	    }
	    /**
	     * Return the list of candidates for a given query
	     * Crude implementation for now, we return the candidates given by the first usable index if any
	     * We try the following query types, in this order: basic match, $in match, comparison match
	     * One way to make it better would be to enable the use of multiple indexes if the first usable index
	     * returns too much data. I may do it in the future.
	     *
	     * Returned candidates will be scanned to find and remove all expired documents
	     */
	    getCandidates(query, dontExpireStaleDocs) {
	        return __awaiter(this, void 0, void 0, function* () {
	            let candidates = this._leastCandidates(query);
	            if (dontExpireStaleDocs) {
	                if (Array.isArray(candidates))
	                    return candidates;
	                else if (candidates === null)
	                    return [];
	                else
	                    return [candidates];
	            }
	            const expiredDocsIds = [];
	            const validDocs = [];
	            const ttlIndexesFieldNames = Object.keys(this.ttlIndexes);
	            if (!candidates)
	                return [];
	            if (!Array.isArray(candidates))
	                candidates = [candidates];
	            candidates.forEach((candidate) => {
	                let valid = true;
	                ttlIndexesFieldNames.forEach((field) => {
	                    if (candidate[field] !== undefined &&
	                        candidate[field] instanceof Date &&
	                        Date.now() >
	                            candidate[field].getTime() +
	                                this.ttlIndexes[field] * 1000) {
	                        valid = false;
	                    }
	                });
	                if (valid) {
	                    validDocs.push(candidate);
	                }
	                else if (candidate._id) {
	                    expiredDocsIds.push(candidate._id);
	                }
	            });
	            for (let index = 0; index < expiredDocsIds.length; index++) {
	                const _id = expiredDocsIds[index];
	                yield this._remove({ _id }, { multi: false });
	            }
	            return validDocs;
	        });
	    }
	    /**
	     * Insert a new document
	     */
	    _insert(newDoc) {
	        return __awaiter(this, void 0, void 0, function* () {
	            let preparedDoc = this.prepareDocumentForInsertion(newDoc);
	            this._insertInCache(preparedDoc);
	            yield this.persistence.writeNewData(Array.isArray(preparedDoc) ? preparedDoc : [preparedDoc]);
	            return deepCopy(preparedDoc, this.model);
	        });
	    }
	    /**
	     * Create a new _id that's not already in use
	     */
	    createNewId() {
	        let tentativeId = uid();
	        if (this.indexes._id.getMatching(tentativeId).length > 0) {
	            tentativeId = this.createNewId();
	        }
	        return tentativeId;
	    }
	    /**
	     * Prepare a document (or array of documents) to be inserted in a database
	     * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
	     */
	    prepareDocumentForInsertion(newDoc) {
	        let preparedDoc = [];
	        if (Array.isArray(newDoc)) {
	            newDoc.forEach((doc) => {
	                preparedDoc.push(this.prepareDocumentForInsertion(doc));
	            });
	        }
	        else {
	            preparedDoc = deepCopy(newDoc, this.model);
	            if (preparedDoc._id === undefined) {
	                preparedDoc._id = this.createNewId();
	            }
	            const now = new Date();
	            if (this.timestampData && preparedDoc.createdAt === undefined) {
	                preparedDoc.createdAt = now;
	            }
	            if (this.timestampData && preparedDoc.updatedAt === undefined) {
	                preparedDoc.updatedAt = now;
	            }
	            checkObject(preparedDoc);
	        }
	        return preparedDoc;
	    }
	    /**
	     * If newDoc is an array of documents, this will insert all documents in the cache
	     */
	    _insertInCache(preparedDoc) {
	        if (Array.isArray(preparedDoc)) {
	            this._insertMultipleDocsInCache(preparedDoc);
	        }
	        else {
	            this.addToIndexes(preparedDoc);
	        }
	    }
	    /**
	     * If one insertion fails (e.g. because of a unique constraint), roll back all previous
	     * inserts and throws the error
	     */
	    _insertMultipleDocsInCache(preparedDocs) {
	        let failingI = -1;
	        let error;
	        for (let i = 0; i < preparedDocs.length; i++) {
	            try {
	                this.addToIndexes(preparedDocs[i]);
	            }
	            catch (e) {
	                error = e;
	                failingI = i;
	                break;
	            }
	        }
	        if (error) {
	            for (let i = 0; i < failingI; i++) {
	                this.removeFromIndexes(preparedDocs[i]);
	            }
	            throw error;
	        }
	    }
	    insert(newDoc) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const res = yield this.q.add(() => this._insert(newDoc));
	            if (Array.isArray(res)) {
	                return {
	                    docs: res,
	                    number: res.length,
	                };
	            }
	            else {
	                return {
	                    docs: [res],
	                    number: 1,
	                };
	            }
	        });
	    }
	    /**
	     * Count all documents matching the query
	     */
	    count(query) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const cursor = new Cursor(this, query);
	            return (yield cursor.exec()).length;
	        });
	    }
	    /**
	     * Find all documents matching the query
	     */
	    find(query) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const cursor = new Cursor(this, query);
	            const docs = yield cursor.exec();
	            return docs;
	        });
	    }
	    /**
	     * Find all documents matching the query
	     */
	    cursor(query) {
	        const cursor = new Cursor(this, query);
	        return cursor;
	    }
	    /**
	     * Update all docs matching query
	     */
	    _update(query, updateQuery, options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            let multi = options.multi !== undefined ? options.multi : false;
	            let upsert = options.upsert !== undefined ? options.upsert : false;
	            const cursor = new Cursor(this, query);
	            cursor.limit(1);
	            const res = yield cursor.__exec_unsafe();
	            if (res.length > 0) {
	                let numReplaced = 0;
	                const candidates = yield this.getCandidates(query);
	                const modifications = [];
	                // Preparing update (if an error is thrown here neither the datafile nor
	                // the in-memory indexes are affected)
	                for (let i = 0; i < candidates.length; i++) {
	                    if ((multi || numReplaced === 0) &&
	                        match(candidates[i], query)) {
	                        numReplaced++;
	                        let createdAt = candidates[i].createdAt;
	                        let modifiedDoc = modify(candidates[i], updateQuery, this.model);
	                        if (createdAt) {
	                            modifiedDoc.createdAt = createdAt;
	                        }
	                        if (this.timestampData &&
	                            updateQuery.updatedAt === undefined &&
	                            (!updateQuery.$set ||
	                                updateQuery.$set.updatedAt === undefined)) {
	                            modifiedDoc.updatedAt = new Date();
	                        }
	                        modifications.push({
	                            oldDoc: candidates[i],
	                            newDoc: modifiedDoc,
	                        });
	                    }
	                }
	                // Change the docs in memory
	                this.updateIndexes(modifications);
	                // Update the datafile
	                const updatedDocs = modifications.map((x) => x.newDoc);
	                yield this.persistence.writeNewData(updatedDocs);
	                return {
	                    number: updatedDocs.length,
	                    docs: updatedDocs.map((x) => deepCopy(x, this.model)),
	                    upsert: false,
	                };
	            }
	            else if (res.length === 0 && upsert) {
	                if (!updateQuery.$setOnInsert) {
	                    throw new Error("$setOnInsert modifier is required when upserting");
	                }
	                let toBeInserted = deepCopy(updateQuery.$setOnInsert, this.model, true);
	                const newDoc = yield this._insert(toBeInserted);
	                if (Array.isArray(newDoc)) {
	                    return {
	                        number: newDoc.length,
	                        docs: newDoc,
	                        upsert: true,
	                    };
	                }
	                else {
	                    return {
	                        number: 1,
	                        docs: [newDoc],
	                        upsert: true,
	                    };
	                }
	            }
	            else {
	                return {
	                    number: 0,
	                    docs: [],
	                    upsert: false,
	                };
	            }
	        });
	    }
	    update(query, updateQuery, options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            return yield this.q.add(() => this._update(query, updateQuery, options));
	        });
	    }
	    /**
	     * Remove all docs matching the query
	     * For now very naive implementation (similar to update)
	     */
	    _remove(query, options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            let numRemoved = 0;
	            const removedDocs = [];
	            const removedFullDoc = [];
	            let multi = options ? !!options.multi : false;
	            const candidates = yield this.getCandidates(query, true);
	            candidates.forEach((d) => {
	                if (match(d, query) && (multi || numRemoved === 0)) {
	                    numRemoved++;
	                    removedFullDoc.push(deepCopy(d, this.model));
	                    removedDocs.push({ $$deleted: true, _id: d._id });
	                    this.removeFromIndexes(d);
	                }
	            });
	            for (let index = 0; index < removedDocs.length; index++) {
	                const element = removedDocs[index];
	                yield this.persistence.deleteData(element._id || "");
	            }
	            return {
	                number: numRemoved,
	                docs: removedFullDoc,
	            };
	        });
	    }
	    remove(query, options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            return this.q.add(() => this._remove(query, options));
	        });
	    }
	}

	class Database {
	    constructor(options) {
	        this.reloadBeforeOperations = false;
	        /**
	         * Create document
	         */
	        this.create = this.insert;
	        /**
	         * Find documents that meets a specified criteria
	         */
	        this.find = this.read;
	        /**
	         * Count the documents matching the specified criteria
	         */
	        this.number = this.count;
	        /**
	         * Delete document(s) that meets the specified criteria
	         */
	        this.remove = this.delete;
	        /**
	         * Create an index specified by options
	         */
	        this.ensureIndex = this.createIndex;
	        this.model =
	            options.model ||
	                BaseModel;
	        this.ref = options.ref;
	        this.reloadBeforeOperations = !!options.reloadBeforeOperations;
	        this._datastore = new Datastore({
	            ref: this.ref,
	            model: this.model,
	            encode: options.encode,
	            decode: options.decode,
	            corruptAlertThreshold: options.corruptAlertThreshold,
	            timestampData: options.timestampData,
	            syncToRemote: options.syncToRemote,
	            syncInterval: options.syncInterval
	        });
	        this.loaded = this._datastore.loadDatabase();
	    }
	    reloadFirst() {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.reloadBeforeOperations)
	                return;
	            yield this.reload();
	        });
	    }
	    /**
	     * insert documents
	     */
	    insert(docs) {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this.reloadFirst();
	            const res = yield this._datastore.insert(docs);
	            return res;
	        });
	    }
	    /**
	     * Find document(s) that meets a specified criteria
	     */
	    read({ filter, skip, limit, project, sort = undefined, }) {
	        return __awaiter(this, void 0, void 0, function* () {
	            filter = fixDeep(filter || {});
	            sort = fixDeep(sort || {});
	            project = fixDeep(project || {});
	            const cursor = this._datastore.cursor(filter);
	            if (sort) {
	                cursor.sort(sort);
	            }
	            if (skip) {
	                cursor.skip(skip);
	            }
	            if (limit) {
	                cursor.limit(limit);
	            }
	            if (project) {
	                cursor.projection(project);
	            }
	            yield this.reloadFirst();
	            return yield cursor.exec();
	        });
	    }
	    /**
	     * Update document(s) that meets the specified criteria
	     */
	    update({ filter, update, multi, }) {
	        return __awaiter(this, void 0, void 0, function* () {
	            filter = fixDeep(filter || {});
	            if (update.$set) {
	                update.$set = fixDeep(update.$set);
	            }
	            if (update.$unset) {
	                update.$unset = fixDeep(update.$unset);
	            }
	            yield this.reloadFirst();
	            const res = yield this._datastore.update(filter, update, {
	                multi,
	                upsert: false,
	            });
	            return res;
	        });
	    }
	    /**
	     * Update document(s) that meets the specified criteria,
	     * and do an insertion if no documents are matched
	     */
	    upsert({ filter, update, multi, }) {
	        return __awaiter(this, void 0, void 0, function* () {
	            filter = fixDeep(filter || {});
	            if (update.$set) {
	                update.$set = fixDeep(update.$set);
	            }
	            if (update.$unset) {
	                update.$unset = fixDeep(update.$unset);
	            }
	            yield this.reloadFirst();
	            const res = yield this._datastore.update(filter, update, {
	                multi,
	                upsert: true,
	            });
	            return res;
	        });
	    }
	    /**
	     * Count documents that meets the specified criteria
	     */
	    count(filter = {}) {
	        return __awaiter(this, void 0, void 0, function* () {
	            filter = fixDeep(filter || {});
	            yield this.reloadFirst();
	            return yield this._datastore.count(filter);
	        });
	    }
	    /**
	     * Delete document(s) that meets the specified criteria
	     *
	     */
	    delete({ filter, multi, }) {
	        return __awaiter(this, void 0, void 0, function* () {
	            filter = fixDeep(filter || {});
	            yield this.reloadFirst();
	            const res = yield this._datastore.remove(filter, {
	                multi: multi || false,
	            });
	            return res;
	        });
	    }
	    /**
	     * Create an index specified by options
	     */
	    createIndex(options) {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this.reloadFirst();
	            return yield this._datastore.ensureIndex(options);
	        });
	    }
	    /**
	     * Remove an index by passing the field name that it is related to
	     */
	    removeIndex(fieldName) {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this.reloadFirst();
	            return yield this._datastore.removeIndex(fieldName);
	        });
	    }
	    /**
	     * Reload database from the persistence layer (if it exists)
	     */
	    reload() {
	        return __awaiter(this, void 0, void 0, function* () {
	            yield this._datastore.persistence.loadDatabase();
	            return {};
	        });
	    }
	    sync() {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this._datastore.persistence.sync) {
	                throw new Error("Can not perform sync operation unless provided with remote DB adapter");
	            }
	            return yield this._datastore.persistence.sync.sync();
	        });
	    }
	}
	function fixDeep(input) {
	    const result = Object.assign(input, input.$deep);
	    delete result.$deep;
	    return result;
	}

	/*
	    const savedNS = {
	        endpointA: {
	            namespace1: "id1",
	            namespace2: "id2",
	        },
	        endpointB: {
	            namespace1: "id1",
	            namespace2: "id2",
	        }
	    }
	*/
	const savedNS = {};
	const kvAdapter = (endpoint, token) => (name) => new Namespace({ endpoint, token, name });
	function kvRequest(instance, method = "GET", path = "", body, parse = true) {
	    return __awaiter(this, void 0, void 0, function* () {
	        return new Promise((resolve) => {
	            var xhr = new XMLHttpRequest();
	            xhr.addEventListener("readystatechange", function () {
	                if (this.readyState === 4) {
	                    if (parse === false) {
	                        return resolve(this.responseText);
	                    }
	                    try {
	                        let json = JSON.parse(this.responseText);
	                        resolve(json);
	                    }
	                    catch (e) {
	                        resolve(this.responseText);
	                    }
	                }
	            });
	            xhr.open(method, (instance.endpoint + "/" + path)
	                // removing double slashes
	                .replace(/(https?:\/{2}.*)\/{2}/, "$1/")
	                // removing trailing slashes
	                .replace(/\/$/, ""));
	            xhr.setRequestHeader("Authorization", `Bearer ${instance.token}`);
	            xhr.setRequestHeader("Content-Type", `application/json`);
	            xhr.send(body);
	        });
	    });
	}
	class Namespace {
	    constructor({ name: name, token, endpoint, }) {
	        this.id = "";
	        this.name = name;
	        this.token = token;
	        this.endpoint = endpoint;
	        this.connect();
	    }
	    // basically trying to get the ID of the namespace
	    // from the array above or remotely
	    // or creating a new namespace
	    connect() {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!savedNS[this.endpoint]) {
	                savedNS[this.endpoint] = {};
	            }
	            if (savedNS[this.endpoint][this.name]) {
	                // found saved
	                this.id = savedNS[this.endpoint][this.name];
	                return;
	            }
	            const remoteNamespaces = yield this.listStores();
	            for (let index = 0; index < remoteNamespaces.length; index++) {
	                const element = remoteNamespaces[index];
	                savedNS[this.endpoint][element.name] = element.id;
	            }
	            if (savedNS[this.endpoint][this.name]) {
	                // found remote
	                this.id = savedNS[this.endpoint][this.name];
	                return;
	            }
	            const id = yield this.createStore(this.name);
	            savedNS[this.endpoint][this.name] = id;
	            this.id = id;
	        });
	    }
	    listStores() {
	        return __awaiter(this, void 0, void 0, function* () {
	            const namespaces = [];
	            let currentPage = 1;
	            let totalPages = 1;
	            while (totalPages >= currentPage) {
	                const res = yield kvRequest(this, "GET", `?page=${currentPage}`);
	                if (typeof res === "string" ||
	                    !res.success ||
	                    !Array.isArray(res.result)) {
	                    throw new Error("Error while listing namespaces: " + JSON.stringify(res));
	                }
	                else {
	                    const resNamespaces = res.result;
	                    for (let index = 0; index < resNamespaces.length; index++) {
	                        const element = resNamespaces[index];
	                        namespaces.push({ id: element.id, name: element.title });
	                    }
	                    totalPages = res.result_info.total_pages;
	                    currentPage++;
	                }
	            }
	            return namespaces;
	        });
	    }
	    createStore(title) {
	        return __awaiter(this, void 0, void 0, function* () {
	            const res = yield kvRequest(this, "POST", "", JSON.stringify({ title }));
	            if (typeof res === "string" ||
	                !res.success ||
	                Array.isArray(res.result)) {
	                throw new Error("Error while creating namespace: " + JSON.stringify(res));
	            }
	            else {
	                return res.result.id;
	            }
	        });
	    }
	    removeStore() {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            const res = yield kvRequest(this, "DELETE", this.id);
	            if (typeof res === "string" || !res.success) {
	                throw new Error("Error while deleting namespace: " + JSON.stringify(res));
	            }
	            else {
	                return true;
	            }
	        });
	    }
	    removeItem(itemID) {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            const res = yield kvRequest(this, "DELETE", `${this.id}/values/${itemID}`);
	            if (typeof res === "string" || !res.success) {
	                throw new Error("Error while deleting item: " + JSON.stringify(res));
	            }
	            else {
	                return true;
	            }
	        });
	    }
	    setItem(itemID, itemData) {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            const res = yield kvRequest(this, "PUT", `${this.id}/values/${itemID}`, itemData);
	            if (typeof res === "string" || !res.success) {
	                throw new Error("Error while setting item: " + JSON.stringify(res));
	            }
	            else {
	                return true;
	            }
	        });
	    }
	    getItem(itemID) {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            const res = yield kvRequest(this, "GET", `${this.id}/values/${itemID}`, undefined, false);
	            if (typeof res !== "string") {
	                throw new Error("Error while getting item: " + JSON.stringify(res));
	            }
	            else {
	                return res;
	            }
	        });
	    }
	    keys() {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            let keys = [];
	            let cursor = "";
	            do {
	                const res = yield kvRequest(this, "GET", `${this.id}/keys${cursor ? `?cursor=${cursor}` : ""}`);
	                if (typeof res === "string" ||
	                    !res.success ||
	                    !Array.isArray(res.result)) {
	                    throw new Error("Error while listing keys: " + JSON.stringify(res));
	                }
	                else {
	                    const arr = res.result;
	                    for (let index = 0; index < arr.length; index++) {
	                        const element = arr[index];
	                        keys.push(element.name);
	                    }
	                    cursor = res.result_info.cursor;
	                }
	            } while (cursor);
	            return keys;
	        });
	    }
	    removeItems(items) {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (!this.id)
	                yield this.connect();
	            // deal with 10,000 limit
	            const dividedItems = items.reduce((arr, item, index) => {
	                const sub = Math.floor(index / 9999);
	                if (!arr[sub])
	                    arr[sub] = [];
	                arr[sub].push(item);
	                return arr;
	            }, []);
	            let results = [];
	            for (let index = 0; index < dividedItems.length; index++) {
	                const batch = dividedItems[index];
	                const res = yield kvRequest(this, "DELETE", `${this.id}/bulk`, JSON.stringify(batch));
	                if (typeof res === "string" || !res.success) {
	                    throw new Error("Error while deleting item: " + JSON.stringify(res));
	                }
	                else {
	                    results.push(true);
	                }
	            }
	            return results;
	        });
	    }
	    setItems(items) {
	        return __awaiter(this, void 0, void 0, function* () {
	            // deal with 10,000 limit
	            if (!this.id)
	                yield this.connect();
	            const dividedItems = items.reduce((arr, item, index) => {
	                const sub = Math.floor(index / 9999);
	                if (!arr[sub])
	                    arr[sub] = [];
	                arr[sub].push(item);
	                return arr;
	            }, []);
	            let results = [];
	            for (let index = 0; index < dividedItems.length; index++) {
	                const batch = dividedItems[index];
	                const res = yield kvRequest(this, "PUT", `${this.id}/bulk`, JSON.stringify(batch));
	                if (typeof res === "string" || !res.success) {
	                    throw new Error("Error while deleting item: " + JSON.stringify(res));
	                }
	                else {
	                    results.push(true);
	                }
	            }
	            return results;
	        });
	    }
	    getItems(keys) {
	        return __awaiter(this, void 0, void 0, function* () {
	            if (keys.length === 0)
	                return [];
	            // Cloudflare, sadly, still doesn't bulk gets!
	            // so we're just looping through the given keys
	            // to make things slightly better:
	            // we're setting a max concurrent connection using pq
	            const q = new pq({ concurrency: 20 });
	            const valuesPromises = [];
	            for (let index = 0; index < keys.length; index++) {
	                const key = keys[index];
	                valuesPromises.push(q.add(() => this.getItem(key)));
	            }
	            const values = yield Promise.all(valuesPromises);
	            const result = [];
	            for (let index = 0; index < keys.length; index++) {
	                let key = keys[index];
	                let value = values[index];
	                result.push({ key, value });
	            }
	            return result;
	        });
	    }
	}

	const unify = {
	    Database,
	    BaseModel,
	    adapters: {
	        kvAdapter, memoryAdapter, memoryStores
	    },
	    Persistence,
	    PersistenceEvent,
	    _internal: {
	        avl: { AvlTree, Node },
	        Cursor,
	        customUtils,
	        Datastore,
	        Index,
	        modelling
	    }
	};

	return unify;

})));
