/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../node_modules/@types/underscore/index.d.ts" />

import xwebdb from "../../dist/xwebdb.js";
import underscore from "../../node_modules/underscore/underscore.js";
const _: any = underscore;

const { Index } = xwebdb._internal;

const assert = chai.assert;

describe("Indexes", () => {
	describe("Insertion", () => {
		it("Can insert pointers to documents in the index correctly when they have the field", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			// The underlying BST now has 3 nodes which contain the docs where it's expected
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), [{ a: 5, tf: "hello" }]);
			assert.deepEqual(idx.dict.get("world"), [{ a: 8, tf: "world" }]);
			assert.deepEqual(idx.dict.get("bloup"), [{ a: 2, tf: "bloup" }]);

			// The nodes contain pointers to the actual documents
			idx.dict.get("world")[0].should.equal(doc2);
			idx.dict.get("bloup")[0].a = 42;
			doc3.a.should.equal(42);
		});

		it("Inserting twice for the same fieldName in a unique index will result in an error thrown", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc1 = { a: 5, tf: "hello" };
			idx.insert(doc1);
			idx.dict.numberOfKeys.should.equal(1);
			(() => {
				idx.insert(doc1);
			}).should.throw();
		});

		it("Inserting twice for a fieldName the docs dont have with a unique index results in an error thrown", () => {
			const idx = new Index<any, any>({
				fieldName: "nope",
				unique: true,
			});
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 5, tf: "world" };
			idx.insert(doc1);
			idx.dict.numberOfKeys.should.equal(1);
			(() => {
				idx.insert(doc2);
			}).should.throw();
		});

		it("Inserting twice for a fieldName the docs dont have with a unique and sparse index will not throw, since the docs will be non indexed", () => {
			const idx = new Index<any, any>({
				fieldName: "nope",
				unique: true,
				sparse: true,
			});

			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 5, tf: "world" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.dict.numberOfKeys.should.equal(0); // Docs are not indexed
		});

		it("Works with dot notation", () => {
			const idx = new Index<any, any>({ fieldName: "tf.nested" });
			const doc1 = { a: 5, tf: { nested: "hello" } };
			const doc2 = { a: 8, tf: { nested: "world", additional: true } };
			const doc3 = { a: 2, tf: { nested: "bloup", age: 42 } };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			// The underlying BST now has 3 nodes which contain the docs where it's expected
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("bloup"), [doc3]);

			// The nodes contain pointers to the actual documents
			idx.dict.get("bloup")[0].a = 42;
			doc3.a.should.equal(42);
		});

		it("Can insert an array of documents", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			idx.insert([doc1, doc2, doc3]);
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("bloup"), [doc3]);
		});

		it("When inserting an array of elements, if an error is thrown all inserts need to be rolled back", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc2b = { a: 84, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			(() => {
				idx.insert([doc1, doc2, doc2b, doc3]);
			}).should.throw();
			idx.dict.numberOfKeys.should.equal(0);
			assert.deepEqual(idx.dict.get("hello"), []);
			assert.deepEqual(idx.dict.get("world"), []);
			assert.deepEqual(idx.dict.get("bloup"), []);
		});

		describe("Array fields", () => {
			it("Inserts one entry per array element in the index", () => {
				const obj = { tf: ["aa", "bb"], really: "yeah" };
				const obj2 = { tf: "normal", yes: "indeed" };
				const idx = new Index<any, any>({ fieldName: "tf" });
				idx.insert(obj);
				idx.dict.all.length.should.equal(2);
				idx.dict.all[0].should.equal(obj);
				idx.dict.all[1].should.equal(obj);

				idx.insert(obj2);
				idx.dict.all.length.should.equal(3);
			});

			it("Inserts one entry per array element in the index, type-checked", () => {
				const obj = {
					tf: ["42", 42, new Date(42), 42],
					really: "yeah",
				};
				const idx = new Index<any, any>({ fieldName: "tf" });
				idx.insert(obj);
				idx.dict.all.length.should.equal(3);
				idx.dict.all[0].should.equal(obj);
				idx.dict.all[1].should.equal(obj);
				idx.dict.all[2].should.equal(obj);
			});

			it("Inserts one entry per unique array element in the index, the unique constraint only holds across documents", () => {
				const obj = { tf: ["aa", "aa"], really: "yeah" };
				const obj2 = { tf: ["cc", "yy", "cc"], yes: "indeed" };
				const idx = new Index<any, any>({
					fieldName: "tf",
					unique: true,
				});
				idx.insert(obj);
				idx.dict.all.length.should.equal(1);
				idx.dict.all[0].should.equal(obj);

				idx.insert(obj2);
				idx.dict.all.length.should.equal(3);
			});

			it("The unique constraint holds across documents", () => {
				const obj = { tf: ["aa", "aa"], really: "yeah" };
				const obj2 = { tf: ["cc", "aa", "cc"], yes: "indeed" };
				const idx = new Index<any, any>({
					fieldName: "tf",
					unique: true,
				});
				idx.insert(obj);
				idx.dict.all.length.should.equal(1);
				idx.dict.all[0].should.equal(obj);

				(() => {
					idx.insert(obj2);
				}).should.throw();
			});

			it("When removing a document, remove it from the index at all unique array elements", () => {
				const obj = { tf: ["aa", "aa"], really: "yeah" };
				const obj2 = { tf: ["cc", "aa", "cc"], yes: "indeed" };
				const idx = new Index<any, any>({ fieldName: "tf" });
				idx.insert(obj);
				idx.insert(obj2);
				idx.dict.get("aa").length.should.equal(2);
				idx.dict.get("aa").indexOf(obj).should.not.equal(-1);
				idx.dict.get("aa").indexOf(obj2).should.not.equal(-1);
				idx.dict.get("cc").length.should.equal(1);

				idx.remove(obj2);
				idx.dict.get("aa").length.should.equal(1);
				idx.dict.get("aa").indexOf(obj).should.not.equal(-1);
				idx.dict.get("aa").indexOf(obj2).should.equal(-1);
				idx.dict.get("cc").length.should.equal(0);
			});

			it("If a unique constraint is violated when inserting an array key, roll back all inserts before the key", () => {
				const obj = { tf: ["aa", "bb"], really: "yeah" };
				const obj2 = { tf: ["cc", "dd", "aa", "ee"], yes: "indeed" };
				const idx = new Index<any, any>({
					fieldName: "tf",
					unique: true,
				});
				idx.insert(obj);
				idx.dict.all.length.should.equal(2);
				idx.dict.get("aa").length.should.equal(1);
				idx.dict.get("bb").length.should.equal(1);
				idx.dict.get("cc").length.should.equal(0);
				idx.dict.get("dd").length.should.equal(0);
				idx.dict.get("ee").length.should.equal(0);

				(() => {
					idx.insert(obj2);
				}).should.throw();
				idx.dict.all.length.should.equal(2);
				idx.dict.get("aa").length.should.equal(1);
				idx.dict.get("bb").length.should.equal(1);
				idx.dict.get("cc").length.should.equal(0);
				idx.dict.get("dd").length.should.equal(0);
				idx.dict.get("ee").length.should.equal(0);
			});
		}); // ==== End of 'Array fields' ==== //
	}); // ==== End of 'Insertion' ==== //

	describe("Removal", () => {
		it("Can remove pointers from the index, even when multiple documents have the same key", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { tf: "A", a: 15 };
			const doc2 = { tf: "A", a: 50 };
			const doc3 = { tf: "B", a: 10 };
			const doc4 = { tf: "C", a: 20 };
			
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);
			
			// before removing
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			
			// empty non matching
			idx.remove({});
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// non-empty non matching
			idx.remove({a: 9, tf:{nested: "nill"}});
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// removing from a node with two values
			idx.remove(doc1);
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(3);
			idx.dict.all.findIndex(x=>x === doc1).should.equal(-1);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			
			// removing from a node with one value
			idx.remove(doc4);
			idx.dict.numberOfKeys.should.equal(2);
			idx.dict.size.should.equal(2);
			idx.dict.all.findIndex(x=>x === doc4).should.equal(-1);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);


			// removing from a node with one value
			idx.remove(doc3);
			idx.dict.numberOfKeys.should.equal(1);
			idx.dict.size.should.equal(1);
			idx.dict.all.findIndex(x=>x === doc3).should.equal(-1);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);

			// removing from a node with one value
			idx.remove(doc2);
			idx.dict.numberOfKeys.should.equal(0);
			idx.dict.size.should.equal(0);
			idx.dict.all.findIndex(x=>x === doc2).should.equal(-1);
			idx.dict.all.length.should.equal(0);

		});

		it("If we have a sparse index, removing a non indexed doc has no effect", () => {
			const idx = new Index<any, any>({
				fieldName: "nope",
				sparse: true,
			});
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 5, tf: "world" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.dict.numberOfKeys.should.equal(0);

			idx.remove(doc1);
			idx.dict.numberOfKeys.should.equal(0);
		});

		it("Works with dot notation", () => {
			const idx = new Index<any, any>({ fieldName: "tf.nested" });
			const doc1 = { a: 5, tf: { nested: "hello" } };
			const doc2 = { a: 8, tf: { nested: "world", additional: true } };
			const doc3 = { a: 2, tf: { nested: "bloup", age: 42 } };
			const doc4 = {
				a: 2,
				tf: { nested: "world", fruits: ["apple", "carrot"] },
			};
			
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);

			// before removing
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			
			// empty non matching
			idx.remove({});
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// non-empty non matching
			idx.remove({a: 9, tf:{nested: "nill"}});
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// removing from a node with two values
			idx.remove(doc2);
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(3);
			idx.dict.all.findIndex(x=>x === doc2).should.equal(-1);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);
			
			// removing from a node with one value
			idx.remove(doc4);
			idx.dict.numberOfKeys.should.equal(2);
			idx.dict.size.should.equal(2);
			idx.dict.all.findIndex(x=>x === doc4).should.equal(-1);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			
			// removing from a node with one value
			idx.remove(doc3);
			idx.dict.numberOfKeys.should.equal(1);
			idx.dict.size.should.equal(1);
			idx.dict.all.findIndex(x=>x === doc3).should.equal(-1);
			idx.dict.all.find(x=>x === doc1).should.equal(doc1);
			
			// removing from a node with one value
			idx.remove(doc1);
			idx.dict.numberOfKeys.should.equal(0);
			idx.dict.size.should.equal(0);
			idx.dict.all.findIndex(x=>x === doc1).should.equal(-1);
			idx.dict.all.length.should.equal(0);
		});

		it("Can remove an array of documents", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			idx.insert([doc1, doc2, doc3]);
			idx.dict.numberOfKeys.should.equal(3);
			idx.remove([doc1, doc3]);
			idx.dict.numberOfKeys.should.equal(1);
			assert.deepEqual(idx.dict.get("hello"), []);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("bloup"), []);
		});
	}); // ==== End of 'Removal' ==== //

	describe("Update", () => {

		it("can update index and rebalance tree", ()=>{})

		it("Can update pointers from the index, even when multiple documents have the same key", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { tf: "A", a: 15 };
			const doc2 = { tf: "A", a: 50 };
			const doc3 = { tf: "B", a: 10 };
			const doc4 = { tf: "C", a: 20 };
			
			const doc1_2 = { tf: "A", a: 15 * 100 };
			const doc2_2 = { tf: "A", a: 50 * 100 };
			const doc3_2 = { tf: "B", a: 10 * 100 };
			const doc4_2 = { tf: "C", a: 20 * 100 };

			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);
			
			// before updating
			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.size.should.equal(4);
			
			// updating from a node with two values
			idx.update(doc1, doc1_2);
			idx.dict.all.findIndex(x=>x === doc1).should.equal(-1);
			idx.dict.all.find(x=>x === doc1_2).should.equal(doc1_2);
			idx.dict.all.find(x=>x === doc2).should.equal(doc2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// updating from a node with two values
			idx.update(doc2, doc2_2);
			idx.dict.all.findIndex(x=>x === doc2).should.equal(-1);
			idx.dict.all.find(x=>x === doc1_2).should.equal(doc1_2);
			idx.dict.all.find(x=>x === doc2_2).should.equal(doc2_2);
			idx.dict.all.find(x=>x === doc3).should.equal(doc3);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// updating from a node with one values
			idx.update(doc3, doc3_2);
			idx.dict.all.findIndex(x=>x === doc2).should.equal(-1);
			idx.dict.all.find(x=>x === doc1_2).should.equal(doc1_2);
			idx.dict.all.find(x=>x === doc2_2).should.equal(doc2_2);
			idx.dict.all.find(x=>x === doc3_2).should.equal(doc3_2);
			idx.dict.all.find(x=>x === doc4).should.equal(doc4);

			// updating from a node with one values
			idx.update(doc4, doc4_2);
			idx.dict.all.findIndex(x=>x === doc2).should.equal(-1);
			idx.dict.all.find(x=>x === doc1_2).should.equal(doc1_2);
			idx.dict.all.find(x=>x === doc2_2).should.equal(doc2_2);
			idx.dict.all.find(x=>x === doc3_2).should.equal(doc3_2);
			idx.dict.all.find(x=>x === doc4_2).should.equal(doc4_2);
		});

		it("Can update a document whose key did or didnt change", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const doc4 = { a: 23, tf: "world" };
			const doc5 = { a: 1, tf: "changed" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("world"), [doc2]);

			idx.update(doc2, doc4);
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("world"), [doc4]);

			idx.update(doc1, doc5);
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), []);
			assert.deepEqual(idx.dict.get("changed"), [doc5]);
		});

		it("If a simple update violates a unique constraint, changes are rolled back and an error thrown", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const bad = { a: 23, tf: "world" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("bloup"), [doc3]);
			(() => idx.update(doc3, bad)).should.throw();

			// No change
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("bloup"), [doc3]);
		});

		it("Can update an array of documents", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const doc1b = { a: 23, tf: "world" };
			const doc2b = { a: 1, tf: "changed" };
			const doc3b = { a: 44, tf: "bloup" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.dict.numberOfKeys.should.equal(3);

			idx.update([
				{ oldDoc: doc1, newDoc: doc1b },
				{ oldDoc: doc2, newDoc: doc2b },
				{ oldDoc: doc3, newDoc: doc3b },
			]);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc1b);
			idx.dict.get("changed").length.should.equal(1);
			idx.dict.get("changed")[0].should.equal(doc2b);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3b);
		});

		it("If a unique constraint is violated during an array-update, all changes are rolled back and an error thrown", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc0 = { a: 432, tf: "notthistoo" };
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const doc1b = { a: 23, tf: "changed" };

			const // Will violate the constraint (first try)
				doc2b = { a: 1, tf: "changed" };

			const // Will violate the constraint (second try)
				doc2c = { a: 1, tf: "notthistoo" };

			const doc3b = { a: 44, tf: "alsochanged" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.dict.numberOfKeys.should.equal(3);

			(() => {
				idx.update([
					{ oldDoc: doc1, newDoc: doc1b },
					{ oldDoc: doc2, newDoc: doc2b },
					{ oldDoc: doc3, newDoc: doc3b },
				]);
			}).should.throw();

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("hello")[0].should.equal(doc1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc2);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3);

			(() => {
				idx.update([
					{ oldDoc: doc1, newDoc: doc1b },
					{ oldDoc: doc2, newDoc: doc2b },
					{ oldDoc: doc3, newDoc: doc3b },
				]);
			}).should.throw();

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("hello")[0].should.equal(doc1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc2);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3);
		});

		it("If an update doesnt change a document, the unique constraint is not violated", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const noChange = { a: 8, tf: "world" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("world"), [doc2]);

			idx.update(doc2, noChange); // No error thrown
			idx.dict.numberOfKeys.should.equal(3);
			assert.deepEqual(idx.dict.get("world"), [noChange]);
		});

		it("Can revert simple and batch updates", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const doc1b = { a: 23, tf: "world" };
			const doc2b = { a: 1, tf: "changed" };
			const doc3b = { a: 44, tf: "bloup" };

			const batchUpdate = [
				{ oldDoc: doc1, newDoc: doc1b },
				{ oldDoc: doc2, newDoc: doc2b },
				{ oldDoc: doc3, newDoc: doc3b },
			];

			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.dict.numberOfKeys.should.equal(3);

			idx.update(batchUpdate);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc1b);
			idx.dict.get("changed").length.should.equal(1);
			idx.dict.get("changed")[0].should.equal(doc2b);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3b);

			idx.revertUpdate(batchUpdate);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("hello")[0].should.equal(doc1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc2);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3);

			// Now a simple update
			idx.update(doc2, doc2b);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("hello")[0].should.equal(doc1);
			idx.dict.get("changed").length.should.equal(1);
			idx.dict.get("changed")[0].should.equal(doc2b);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3);

			idx.revertUpdate(doc2, doc2b);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("hello")[0].should.equal(doc1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("world")[0].should.equal(doc2);
			idx.dict.get("bloup").length.should.equal(1);
			idx.dict.get("bloup")[0].should.equal(doc3);
		});


	}); // ==== End of 'Update' ==== //

	describe("Get matching documents", () => {
		it("Get all documents where fieldName is equal to the given value, or an empty array if no match", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const doc4 = { a: 23, tf: "world" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);

			assert.deepEqual(idx.dict.get("bloup"), [doc3]);
			assert.deepEqual(idx.dict.get("world"), [doc2, doc4]);
			assert.deepEqual(idx.dict.get("nope"), []);
		});

		it("Can get all documents for a given key in a unique index", () => {
			const idx = new Index<any, any>({ fieldName: "tf", unique: true });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			assert.deepEqual(idx.dict.get("bloup"), [doc3]);
			assert.deepEqual(idx.dict.get("world"), [doc2]);
			assert.deepEqual(idx.dict.get("nope"), []);
		});

		it("Can get all documents for which a field is undefined", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 2, nottf: "bloup" };
			const doc3 = { a: 8, tf: "world" };
			const doc4 = { a: 7, nottf: "yes" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			assert.deepEqual(idx.dict.get("bloup"), []);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc3]);
			assert.deepEqual(idx.dict.get("yes"), []);
			assert.deepEqual(idx.dict.get(undefined), [doc2]);

			idx.insert(doc4);

			assert.deepEqual(idx.dict.get("bloup"), []);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc3]);
			assert.deepEqual(idx.dict.get("yes"), []);
			assert.deepEqual(idx.dict.get(undefined), [doc2, doc4]);
		});

		it("Can get all documents for which a field is null", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 2, tf: null };
			const doc3 = { a: 8, tf: "world" };
			const doc4 = { a: 7, tf: null };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			assert.deepEqual(idx.dict.get("bloup"), []);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc3]);
			assert.deepEqual(idx.dict.get("yes"), []);
			assert.deepEqual(idx.dict.get(null), [doc2]);

			idx.insert(doc4);

			assert.deepEqual(idx.dict.get("bloup"), []);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc3]);
			assert.deepEqual(idx.dict.get("yes"), []);
			assert.deepEqual(idx.dict.get(null), [doc2, doc4]);
		});

		it("Can get all documents for a given key in a sparse index, but not unindexed docs (= field undefined)", () => {
			const idx = new Index<any, any>({ fieldName: "tf", sparse: true });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 2, nottf: "bloup" };
			const doc3 = { a: 8, tf: "world" };
			const doc4 = { a: 7, nottf: "yes" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);

			assert.deepEqual(idx.dict.get("bloup"), []);
			assert.deepEqual(idx.dict.get("hello"), [doc1]);
			assert.deepEqual(idx.dict.get("world"), [doc3]);
			assert.deepEqual(idx.dict.get("yes"), []);
			assert.deepEqual(idx.dict.get(undefined), []);
		});

		it("Can get all documents whose key is in an array of keys", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });

			const doc1 = { a: 5, tf: "hello", _id: "1" };
			const doc2 = { a: 2, tf: "bloup", _id: "2" };
			const doc3 = { a: 8, tf: "world", _id: "3" };
			const doc4 = { a: 7, tf: "yes", _id: "4" };
			const doc5 = { a: 7, tf: "yes", _id: "5" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);
			idx.insert(doc5);

			assert.deepEqual(idx.dict.get([]), []);
			assert.deepEqual(idx.dict.get(["bloup"]), [doc2]);
			assert.deepEqual(idx.dict.get(["bloup", "yes"]), [
				doc2,
				doc4,
				doc5,
			]);
			assert.deepEqual(idx.dict.get(["hello", "no"]), [doc1]);
			assert.deepEqual(idx.dict.get(["nope", "no"]), []);
		});

		it("Can get all documents whose key is between certain bounds", () => {
			const idx = new Index<any, any>({ fieldName: "a" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 2, tf: "bloup" };
			const doc3 = { a: 8, tf: "world" };
			const doc4 = { a: 7, tf: "yes" };
			const doc5 = { a: 10, tf: "yes" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);
			idx.insert(doc4);
			idx.insert(doc5);

			assert.deepEqual(idx.dict.boundedQuery({ $lt: 10, $gte: 5 }), [
				doc1,
				doc4,
				doc3,
			]);
			assert.deepEqual(idx.dict.boundedQuery({ $lte: 8 }), [
				doc2,
				doc1,
				doc4,
				doc3,
			]);
			assert.deepEqual(idx.dict.boundedQuery({ $gt: 7 }), [doc3, doc5]);
		});
	}); // ==== End of 'Get matching documents' ==== //

	describe("Resetting", () => {
		it("Can reset an index without any new data, the index will be empty afterwards", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("bloup").length.should.equal(1);

			idx.reset();
			idx.dict.numberOfKeys.should.equal(0);
			idx.dict.get("hello").length.should.equal(0);
			idx.dict.get("world").length.should.equal(0);
			idx.dict.get("bloup").length.should.equal(0);
		});

		it("Can reset an index and initialize it with one document", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };
			const newDoc = { a: 555, tf: "new" };
			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("bloup").length.should.equal(1);

			idx.reset();
			idx.insert(newDoc);
			idx.dict.numberOfKeys.should.equal(1);
			idx.dict.get("hello").length.should.equal(0);
			idx.dict.get("world").length.should.equal(0);
			idx.dict.get("bloup").length.should.equal(0);
			idx.dict.get("new")[0].a.should.equal(555);
		});

		it("Can reset an index and initialize it with an array of documents", () => {
			const idx = new Index<any, any>({ fieldName: "tf" });
			const doc1 = { a: 5, tf: "hello" };
			const doc2 = { a: 8, tf: "world" };
			const doc3 = { a: 2, tf: "bloup" };

			const newDocs = [
				{ a: 555, tf: "new" },
				{ a: 666, tf: "again" },
			];

			idx.insert(doc1);
			idx.insert(doc2);
			idx.insert(doc3);

			idx.dict.numberOfKeys.should.equal(3);
			idx.dict.get("hello").length.should.equal(1);
			idx.dict.get("world").length.should.equal(1);
			idx.dict.get("bloup").length.should.equal(1);

			idx.reset();
			idx.insert(newDocs);
			idx.dict.numberOfKeys.should.equal(2);
			idx.dict.get("hello").length.should.equal(0);
			idx.dict.get("world").length.should.equal(0);
			idx.dict.get("bloup").length.should.equal(0);
			idx.dict.get("new")[0].a.should.equal(555);
			idx.dict.get("again")[0].a.should.equal(666);
		});
	}); // ==== End of 'Resetting' ==== //

	it("Get all elements in the index", () => {
		const idx = new Index<any, any>({ fieldName: "a" });
		const doc1 = { a: 5, tf: "hello" };
		const doc2 = { a: 8, tf: "world" };
		const doc3 = { a: 2, tf: "bloup" };
		idx.insert(doc1);
		idx.insert(doc2);
		idx.insert(doc3);
		assert.deepEqual(idx.dict.all.sort(), [
			{ a: 5, tf: "hello" },
			{ a: 8, tf: "world" },
			{ a: 2, tf: "bloup" },
		].sort());
	});
});
