/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/index.d.ts" />
import unify from "../../dist/unify.js";

const AvlTree = unify._internal.avl.AvlTree;
const assert = chai.assert;

export class TestAvlTree<K, V> extends AvlTree<K, V> {
	public get root() {
		return this._root;
	}
}

describe("AVLTree", () => {
	describe("contains", () => {
		it("should return false if the tree is empty", () => {
			const tree = new TestAvlTree();
			assert.isFalse(tree.contains(1));
		});

		it("should return whether the tree contains a node", () => {
			const tree = new TestAvlTree();
			assert.isFalse(tree.contains(1));
			assert.isFalse(tree.contains(2));
			assert.isFalse(tree.contains(3));
			tree.insert(3, null);
			tree.insert(1, null);
			tree.insert(2, null);
			assert.isTrue(tree.contains(1));
			assert.isTrue(tree.contains(2));
			assert.isTrue(tree.contains(3));
		});

		it("should return false when the expected parent has no children", () => {
			const tree = new TestAvlTree();
			tree.insert(2, null);
			assert.isFalse(tree.contains(1));
			assert.isFalse(tree.contains(3));
		});
	});

	describe("custom compare function", () => {
		it("should function correctly given a non-reverse customCompare", () => {
			const tree = new TestAvlTree<number, null>((a, b) => b - a);
			tree.insert(2, null);
			tree.insert(1, null);
			tree.insert(3, null);
			assert.equal(tree.size, 3);
			assert.equal(tree.findMinimum(), 3);
			assert.equal(tree.findMaximum(), 1);
			tree.delete(3, null);
			assert.equal(tree.size, 2);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
			assert.equal(tree.root.left, null);
			if (!tree.root.right) {
				assert.fail("tree.root.right must exist");
				return;
			}
			assert.equal(tree.root.right.key, 1);
		});

		it("should work when the key is a complex object", () => {
			interface IComplexObject {
				innerKey: number;
			}
			const tree = new TestAvlTree<IComplexObject, null>((a, b) => a.innerKey - b.innerKey);
			tree.insert({ innerKey: 1 }, null);
			assert.isTrue(tree.contains({ innerKey: 1 }));
			assert.isFalse(tree.contains({ innerKey: 2 }));
		});
	});

	describe("delete", () => {
		it("should not change the size of a tree with no root", () => {
			const tree = new TestAvlTree();
			tree.delete(1, null);
			assert.equal(tree.size, 0);
		});

		it("should delete a single key", () => {
			const tree = new TestAvlTree();
			tree.insert(1, null);
			tree.delete(1, null);
			assert.isTrue(tree.isEmpty);
		});

		/**
		 *       _4_                       _2_
		 *      /   \                     /   \
		 *     2     6  -> delete(6) ->  1     4
		 *    / \                             /
		 *   1   3                           3
		 */
		it("should correctly balance the left left case", () => {
			const tree = new TestAvlTree();
			tree.insert(4, 4);
			tree.insert(2, 2);
			tree.insert(6, 6);
			tree.insert(3, 3);
			tree.insert(5, 5);
			tree.insert(1, 1);
			tree.insert(7, 7);
			tree.delete(7, null);
			tree.delete(5, null);
			tree.delete(6, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
			assert.equal(tree.root.value as any, 2);
			if (!tree.root.left) {
				assert.fail("tree.root.left must exist");
				return;
			}
			assert.equal(tree.root.left.key, 1);
			assert.equal(tree.root.left.value as any, 1);
			if (!tree.root.right) {
				assert.fail("tree.root.right must exist");
				return;
			}
			assert.equal(tree.root.right.key, 4);
			assert.equal(tree.root.right.value as any, 4);
			if (!tree.root.right.left) {
				assert.fail("tree.root.right.left must exist");
				return;
			}
			assert.equal(tree.root.right.left.key, 3);
			assert.equal(tree.root.right.left.value as any, 3);
		});

		/**
		 *       _4_                       _6_
		 *      /   \                     /   \
		 *     2     6  -> delete(2) ->  4     7
		 *          / \                   \
		 *         5   7                  5
		 */
		it("should correctly balance the right right case", () => {
			const tree = new TestAvlTree();
			tree.insert(4, 4);
			tree.insert(2, 2);
			tree.insert(6, 6);
			tree.insert(3, 3);
			tree.insert(5, 5);
			tree.insert(1, 1);
			tree.insert(7, 7);
			tree.delete(1, null);
			tree.delete(3, null);
			tree.delete(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 6);
			assert.equal(tree.root.value as any, 6);
			if (!tree.root.left) {
				assert.fail("tree.root.left must exist");
				return;
			}
			assert.equal(tree.root.left.key, 4);
			assert.equal(tree.root.left.value as any, 4);
			if (!tree.root.left.right) {
				assert.fail("tree.root.left.right must exist");
				return;
			}
			assert.equal(tree.root.left.right.key, 5);
			assert.equal(tree.root.left.right.value as any, 5);
			if (!tree.root.right) {
				assert.fail("tree.root.right must exist");
				return;
			}
			assert.equal(tree.root.right.key, 7);
			assert.equal(tree.root.right.value as any, 7);
		});

		/**
		 *       _6_                       _4_
		 *      /   \                     /   \
		 *     2     7  -> delete(8) ->  2     6
		 *    / \     \                 / \   / \
		 *   1   4     8               1   3 5   7
		 *      / \
		 *     3   5
		 */
		it("should correctly balance the left right case", () => {
			const tree = new TestAvlTree();
			tree.insert(6, 6);
			tree.insert(2, 2);
			tree.insert(7, 7);
			tree.insert(1, 1);
			tree.insert(8, 8);
			tree.insert(4, 4);
			tree.insert(3, 3);
			tree.insert(5, 5);
			tree.delete(8, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 4);
			assert.equal(tree.root.value as any, 4);
			if (!tree.root.left) {
				assert.fail("tree.root.left must exist");
				return;
			}
			assert.equal(tree.root.left.key, 2);
			assert.equal(tree.root.left.value as any, 2);
			if (!tree.root.left.left) {
				assert.fail("tree.root.left.left must exist");
				return;
			}
			assert.equal(tree.root.left.left.key, 1);
			assert.equal(tree.root.left.left.value as any, 1);
			if (!tree.root.left.right) {
				assert.fail("tree.root.left.right must exist");
				return;
			}
			assert.equal(tree.root.left.right.key, 3);
			assert.equal(tree.root.left.right.value as any, 3);
			if (!tree.root.right) {
				assert.fail("tree.root.right must exist");
				return;
			}
			assert.equal(tree.root.right.key, 6);
			assert.equal(tree.root.right.value as any, 6);
			if (!tree.root.right.left) {
				assert.fail("tree.root.right.left must exist");
				return;
			}
			assert.equal(tree.root.right.left.key, 5);
			assert.equal(tree.root.right.left.value as any, 5);
			if (!tree.root.right.right) {
				assert.fail("tree.root.right.right must exist");
				return;
			}
			assert.equal(tree.root.right.right.key, 7);
			assert.equal(tree.root.right.right.value as any, 7);
		});

		/**
		 *       _3_                       _5_
		 *      /   \                     /   \
		 *     2     7  -> delete(1) ->  3     7
		 *    /     / \                 / \   / \
		 *   1     5   8               2   4 6   8
		 *        / \
		 *       4   6
		 */
		it("should correctly balance the right left case", () => {
			const tree = new TestAvlTree();
			tree.insert(3, 3);
			tree.insert(2, 2);
			tree.insert(7, 7);
			tree.insert(1, 1);
			tree.insert(8, 8);
			tree.insert(5, 5);
			tree.insert(4, 4);
			tree.insert(6, 6);
			tree.delete(1, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 5);
			assert.equal(tree.root.value as any, 5);
			if (!tree.root.left) {
				assert.fail("tree.root.left must exist");
				return;
			}
			assert.equal(tree.root.left.key, 3);
			assert.equal(tree.root.left.value as any, 3);
			if (!tree.root.left.left) {
				assert.fail("tree.root.left.left must exist");
				return;
			}
			assert.equal(tree.root.left.left.key, 2);
			assert.equal(tree.root.left.left.value as any, 2);
			if (!tree.root.left.right) {
				assert.fail("tree.root.left.right must exist");
				return;
			}
			assert.equal(tree.root.left.right.key, 4);
			assert.equal(tree.root.left.right.value as any, 4);
			if (!tree.root.right) {
				assert.fail("tree.root.right must exist");
				return;
			}
			assert.equal(tree.root.right.key, 7);
			assert.equal(tree.root.right.value as any, 7);
			if (!tree.root.right.left) {
				assert.fail("tree.root.right.left must exist");
				return;
			}
			assert.equal(tree.root.right.left.key, 6);
			assert.equal(tree.root.right.left.value as any, 6);
			if (!tree.root.right.right) {
				assert.fail("tree.root.right.right must exist");
				return;
			}
			assert.equal(tree.root.right.right.key, 8);
			assert.equal(tree.root.right.right.value as any, 8);
		});

		it("should take the right child if the left does not exist", () => {
			const tree = new TestAvlTree();
			tree.insert(1, 1);
			tree.insert(2, 2);
			tree.delete(1, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
			assert.equal(tree.root.value as any, 2);
		});

		it("should take the left child if the right does not exist", () => {
			const tree = new TestAvlTree();
			tree.insert(2, 2);
			tree.insert(1, 1);
			tree.delete(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key as any, 1);
			assert.equal(tree.root.value as any, 1);
		});

		it("should get the right child if the node has 2 leaf children", () => {
			const tree = new TestAvlTree();
			tree.insert(2, 2);
			tree.insert(1, 1);
			tree.insert(3, 3);
			tree.delete(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key as any, 3);
			assert.equal(tree.root.value as any, 3);
		});

		it("should get the in-order successor if the node has both children", () => {
			const tree = new TestAvlTree();
			tree.insert(2, 2);
			tree.insert(1, 1);
			tree.insert(4, 4);
			tree.insert(3, 3);
			tree.insert(5, 5);
			tree.delete(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 3);
			assert.equal(tree.root.value as any, 3);
		});
	});

	describe("findMaximum", () => {
		it("should return null when the tree is empty", () => {
			const tree = new TestAvlTree();
			assert.equal(tree.findMaximum(), null);
		});

		it("should return the maximum key in the tree", () => {
			const tree = new TestAvlTree();
			tree.insert(3, null);
			tree.insert(5, null);
			tree.insert(1, null);
			tree.insert(4, null);
			tree.insert(2, null);
			assert.equal(tree.findMaximum(), 5);
		});
	});

	describe("findMinimum", () => {
		it("should return null when the tree is empty", () => {
			const tree = new TestAvlTree();
			assert.equal(tree.findMinimum(), null);
		});

		it("should return the minimum key in the tree", () => {
			const tree = new TestAvlTree();
			tree.insert(5, null);
			tree.insert(3, null);
			tree.insert(1, null);
			tree.insert(4, null);
			tree.insert(2, null);
			assert.equal(tree.findMinimum(), 1);
		});
	});

	describe("get", () => {
		it("should return the correct values", () => {
			const tree = new TestAvlTree();
			tree.insert(1, 4);
			tree.insert(2, 5);
			tree.insert(3, 6);
			assert.equal(JSON.stringify(tree.get(1)), JSON.stringify([4]));
			assert.equal(JSON.stringify(tree.get(2)), JSON.stringify([5]));
			assert.equal(JSON.stringify(tree.get(3)), JSON.stringify([6]));
		});

		it("should empty array when the value doesn't exist", () => {
			const tree = new TestAvlTree();
			assert.equal(JSON.stringify(tree.get(1)), JSON.stringify([]));
			assert.equal(JSON.stringify(tree.get(2)), JSON.stringify([]));
			assert.equal(JSON.stringify(tree.get(3)), JSON.stringify([]));
			tree.insert(1, 4);
			tree.insert(2, 5);
			tree.insert(3, 6);
			assert.equal(JSON.stringify(tree.get(4)), JSON.stringify([]));
			assert.equal(JSON.stringify(tree.get(5)), JSON.stringify([]));
			assert.equal(JSON.stringify(tree.get(6)), JSON.stringify([]));
		});
	});

	describe("insert", () => {
		it("should return the size of the tree", () => {
			const tree = new TestAvlTree();
			tree.insert(1, null);
			tree.insert(2, null);
			tree.insert(3, null);
			tree.insert(4, null);
			tree.insert(5, null);
			assert.equal(tree.size, 5);
		});

		it("should ignore insert of duplicate key", () => {
			const tree = new TestAvlTree();
			tree.insert(1, null);
			tree.insert(1, null);
			assert.equal(tree.size, 2);
			assert.equal(tree.numberOfKeys, 1);
		});

		/**
		 *         c
		 *        / \           _b_
		 *       b   z         /   \
		 *      / \     ->    a     c
		 *     a   y         / \   / \
		 *    / \           w   x y   z
		 *   w   x
		 */
		it("should correctly balance the left left case", () => {
			const tree = new TestAvlTree();
			tree.insert(3, null);
			tree.insert(2, null);
			tree.insert(1, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
		});

		/**
		 *       c
		 *      / \           _b_
		 *     a   z         /   \
		 *    / \     ->    a     c
		 *   w   b         / \   / \
		 *      / \       w   x y   z
		 *     x   y
		 */
		it("should correctly balance the left right case", () => {
			const tree = new TestAvlTree();
			tree.insert(3, null);
			tree.insert(1, null);
			tree.insert(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
		});

		/**
		 *     a
		 *    / \               _b_
		 *   w   b             /   \
		 *      / \     ->    a     c
		 *     x   c         / \   / \
		 *        / \       w   x y   z
		 *       y   z
		 */
		it("should correctly balance the right right case", () => {
			const tree = new TestAvlTree();
			tree.insert(1, null);
			tree.insert(2, null);
			tree.insert(3, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
		});

		/**
		 *     a
		 *    / \             _b_
		 *   w   c           /   \
		 *      / \   ->    a     c
		 *     b   z       / \   / \
		 *    / \         w   x y   z
		 *   x   y
		 */
		it("should correctly balance the right left case", () => {
			const tree = new TestAvlTree();
			tree.insert(1, null);
			tree.insert(3, null);
			tree.insert(2, null);
			if (!tree.root) {
				assert.fail("tree.root must exist");
				return;
			}
			assert.equal(tree.root.key, 2);
		});
	});

	describe("isEmpty", () => {
		it("should return whether the tree is empty", () => {
			const tree = new TestAvlTree();
			assert.isTrue(tree.isEmpty);
			tree.insert(1, null);
			assert.isFalse(tree.isEmpty);
			tree.delete(1, null);
			assert.isTrue(tree.isEmpty);
		});
	});
	describe("size", () => {
		it("should return the size of the tree", () => {
			const tree = new TestAvlTree();
			assert.equal(tree.size, 0);
			tree.insert(1, null);
			assert.equal(tree.size, 1);
			tree.insert(2, null);
			assert.equal(tree.size, 2);
			tree.insert(3, null);
			assert.equal(tree.size, 3);
			tree.insert(4, null);
			assert.equal(tree.size, 4);
			tree.insert(5, null);
			assert.equal(tree.size, 5);
			tree.insert(6, null);
			assert.equal(tree.size, 6);
			tree.insert(7, null);
			assert.equal(tree.size, 7);
			tree.insert(8, null);
			assert.equal(tree.size, 8);
			tree.insert(9, null);
			assert.equal(tree.size, 9);
			tree.insert(10, null);
			assert.equal(tree.size, 10);
		});
	});
});
