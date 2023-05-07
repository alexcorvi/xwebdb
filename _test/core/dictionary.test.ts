/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js";
const Dictionary = xwebdb._internal.Dictionary;

const expect = chai.expect;

describe("Dictionary", function () {
	describe("#has", function () {
		it("should return true if the given key exists in the dictionary", function () {
			const dict = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { id: 1, name: "John" });
			dict.insert(2, { id: 2, name: "Jane" });
			expect(dict.has(1)).to.be.true;
		});

		it("should return false if the given key does not exist in the dictionary", function () {
			const dict = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { id: 1, name: "John" });
			dict.insert(2, { id: 2, name: "Jane" });
			expect(dict.has(3)).to.be.false;
		});
	});

	describe("#insert", () => {
		let dict = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});

		beforeEach(() => {
			dict = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
		});

		it("should insert a document to an empty dictionary", () => {
			dict.insert(1, { id: 1, name: "John Doe" });

			const documents = dict.get(1);
			expect(documents).to.have.lengthOf(1);
			expect(documents[0].id).to.equal(1);
			expect(documents[0].name).to.equal("John Doe");
		});

		it("should insert multiple documents for the same key", () => {
			dict = new Dictionary<any>({
				fieldName: "id",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { id: 1, name: "John Doe" });
			dict.insert(1, { id: 1, name: "Jane Doe" });
			dict.insert(1, { id: 1, name: "James Doe" });

			const documents = dict.get(1);
			expect(documents).to.have.lengthOf(3);
			expect(documents[0].id).to.equal(1);
			expect(documents[0].name).to.equal("John Doe");
			expect(documents[1].id).to.equal(1);
			expect(documents[1].name).to.equal("Jane Doe");
			expect(documents[2].id).to.equal(1);
			expect(documents[2].name).to.equal("James Doe");
		});

		it("should not insert a document with a key that violates the unique constraint", () => {
			dict.insert(1, { id: 1, name: "John Doe" });
			expect(() => dict.insert(1, { id: 1, name: "Jane Doe" })).to.throw();
		});

		it("should insert the key and the document in the correct order", function () {
			const dict = new Dictionary<any>({
				fieldName: "id",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(5, { id: 5, name: "John" });
			dict.insert(2, { id: 2, name: "Peter" });
			dict.insert(7, { id: 7, name: "Mary" });
			dict.insert(3, { id: 3, name: "James" });
			dict.insert(5, { id: 5, name: "Robert" });

			expect(dict.keys).to.eql([2, 3, 5, 7]);
		});

		it("should throw an error when inserting a duplicate key and 'unique' is true", function () {
			const dict = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(5, { id: 5, name: "John" });
			dict.insert(2, { id: 2, name: "Peter" });

			expect(() => dict.insert(5, { id: 5, name: "Robert" })).to.throw("XWebDB: Can't insert key 5, it violates the unique constraint");

			expect(dict.keys).to.eql([2, 5]);
		});
	});

	describe("#get", () => {
		it("should return an empty array if the key is not found", () => {
			const dict = new Dictionary<any>({ fieldName: "id", unique: true, c: (a, b) => a - b });
			dict.insert(1, { id: 1, value: "A" });
			dict.insert(2, { id: 2, value: "B" });
			expect(dict.get(3)).to.eql([]);
		});

		it("should return an array of all documents with the given key", () => {
			const dict = new Dictionary<any>({ fieldName: "name", unique: false, c: (a, b) => a.localeCompare(b) });
			dict.insert("Alice", { id: 1, name: "Alice", age: 25 });
			dict.insert("Bob", { id: 2, name: "Bob", age: 30 });
			dict.insert("Alice", { id: 3, name: "Alice", age: 35 });
			expect(dict.get("Alice")).to.eql([
				{ id: 1, name: "Alice", age: 25 },
				{ id: 3, name: "Alice", age: 35 },
			]);
		});

		it("should return an empty array if the key is not found in an array input", () => {
			const dict = new Dictionary<any>({ fieldName: "name", unique: false, c: (a, b) => a.localeCompare(b) });
			dict.insert("Alice", { id: 1, name: "Alice", age: 25 });
			dict.insert("Bob", { id: 2, name: "Bob", age: 30 });
			expect(dict.get(["Carol", "David"])).to.eql([]);
		});

		it("should return an array of all documents with any of the given keys in an array input", () => {
			const dict = new Dictionary<any>({ fieldName: "name", unique: false, c: (a, b) => a.localeCompare(b) });
			dict.insert("Alice", { id: 1, name: "Alice", age: 25 });
			dict.insert("Bob", { id: 2, name: "Bob", age: 30 });
			dict.insert("Charlie", { id: 3, name: "Charlie", age: 35 });
			expect(dict.get(["Alice", "Charlie"])).to.eql([
				{ id: 1, name: "Alice", age: 25 },
				{ id: 3, name: "Charlie", age: 35 },
			]);
		});

		it("should flatten arrays of keys in an array input", () => {
			const dict = new Dictionary<any>({ fieldName: "name", unique: false, c: (a, b) => a.localeCompare(b) });
			dict.insert("Alice", { id: 1, name: "Alice", age: 25 });
			dict.insert("Bob", { id: 2, name: "Bob", age: 30 });
			dict.insert("Charlie", { id: 3, name: "Charlie", age: 35 });
			expect(dict.get(["Alice", "Bob", "Charlie"])).to.eql([
				{ id: 1, name: "Alice", age: 25 },
				{ id: 2, name: "Bob", age: 30 },
				{ id: 3, name: "Charlie", age: 35 },
			]);
		});
	});

	describe("#delete", () => {
		let dict = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});
		beforeEach(() => {
			dict = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { id: 1, name: "Alice" });
			dict.insert(2, { id: 2, name: "Bob" });
		});

		it("should remove the specified document for the given key", () => {
			expect(dict.delete(1, { id: 1, name: "Alice" })).to.be.true;
			expect(dict.get(1)).to.be.empty;
		});

		it("should return false if the key is not found in the dictionary", () => {
			expect(dict.delete(3, { id: 3, name: "Charlie" })).to.be.false;
		});

		it("should remove the key from the dictionary if it has no documents after deletion", () => {
			expect(dict.delete(1, { id: 1, name: "Alice" })).to.be.true;
			expect(dict.get(1)).to.be.empty;
			expect(dict.keys).to.have.lengthOf(1);
			expect(dict.keys[0]).to.equal(2);
		});
	});

	describe("#findInsertionIndex", function () {
		const dict = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});

		it("should return 0 when the dictionary is empty", function () {
			const index = dict.findInsertionIndex(42);
			expect(index).to.equal(0);
		});

		it("should return the correct index for a key that is less than all other keys", function () {
			dict.insert(2, {});
			dict.insert(4, {});
			const index = dict.findInsertionIndex(1);
			expect(index).to.equal(0);
		});

		it("should return the correct index for a key that is greater than all other keys", function () {
			const index = dict.findInsertionIndex(5);
			expect(index).to.equal(2);
		});

		it("should return the correct index for a key that already exists in the dictionary", function () {
			const index = dict.findInsertionIndex(2);
			expect(index).to.equal(0);
		});

		it("should return the correct index for a key that falls between two existing keys", function () {
			const index = dict.findInsertionIndex(3);
			expect(index).to.equal(1);
		});
	});

	describe("#binarySearch", () => {
		const dictionary = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});

		before(() => {
			dictionary.insert(1, { id: 1, name: "John" });
			dictionary.insert(3, { id: 3, name: "Jane" });
			dictionary.insert(5, { id: 5, name: "Bob" });
			dictionary.insert(7, { id: 7, name: "Alice" });
			dictionary.insert(9, { id: 9, name: "Tom" });
		});

		it("should return the index of the key if it exists in the dictionary", () => {
			expect(dictionary.binarySearch(1)).to.equal(0);
			expect(dictionary.binarySearch(5)).to.equal(2);
			expect(dictionary.binarySearch(9)).to.equal(4);
		});

		it("should return -1 if the key does not exist in the dictionary", () => {
			expect(dictionary.binarySearch(0)).to.equal(-1);
			expect(dictionary.binarySearch(2)).to.equal(-1);
			expect(dictionary.binarySearch(6)).to.equal(-1);
			expect(dictionary.binarySearch(10)).to.equal(-1);
		});

		it("should handle keys of different types", () => {
			const stringDictionary = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => a.localeCompare(b),
			});
			stringDictionary.insert("foo", { id: "foo", name: "John" });
			stringDictionary.insert("bar", { id: "bar", name: "Jane" });
			stringDictionary.insert("baz", { id: "baz", name: "Bob" });
			expect(stringDictionary.binarySearch("bar")).to.equal(0);
			expect(stringDictionary.binarySearch("baz")).to.equal(1);
			expect(stringDictionary.binarySearch("foo")).to.equal(2);
			expect(stringDictionary.binarySearch("qux")).to.equal(-1);
		});
	});

	describe("$in", () => {
		const dictionary = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});

		const documents = [
			{ id: 1, name: "John" },
			{ id: 2, name: "Jane" },
			{ id: 3, name: "Joe" },
			{ id: 4, name: "Jack" },
			{ id: 5, name: "Jill" },
			{ id: 6, name: "James" },
		];

		before(() => {
			for (const doc of documents) {
				dictionary.insert(doc.id, doc);
			}
		});

		it("should return documents matching the keys provided", () => {
			const result = dictionary.$in([1, 3, 5]);
			expect(result).to.deep.equal([
				{ id: 1, name: "John" },
				{ id: 3, name: "Joe" },
				{ id: 5, name: "Jill" },
			]);
		});

		it("should return an empty array if no documents match the keys provided", () => {
			const result = dictionary.$in([10, 20, 30]);
			expect(result).to.deep.equal([]);
		});

		it("should return documents without duplicates", () => {
			const result = dictionary.$in([1, 2, 3, 3, 4, 5]);
			expect(result).to.deep.equal([
				{ id: 1, name: "John" },
				{ id: 2, name: "Jane" },
				{ id: 3, name: "Joe" },
				{ id: 4, name: "Jack" },
				{ id: 5, name: "Jill" },
			]);
		});
	});

	describe("$nin", () => {
		it("should return an empty array when all keys in the dismiss list", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: true,
				c: (a, b) => a.localeCompare(b),
			});
			dict.insert("Bob", { name: "Bob" });
			dict.insert("Alice", { name: "Alice" });
			dict.insert("Eve", { name: "Eve" });

			const result = dict.$nin(["Bob", "Alice", "Eve"]);

			expect(result).to.be.an("array").that.is.empty;
		});

		it("should return all values when no key in the dismiss list", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: true,
				c: (a, b) => a.localeCompare(b),
			});
			dict.insert("Bob", { name: "Bob" });
			dict.insert("Alice", { name: "Alice" });
			dict.insert("Eve", { name: "Eve" });

			const result = dict.$nin(["foo", "bar"]);

			expect(result).to.have.lengthOf(3);
			expect(result).to.deep.include({ name: "Bob" });
			expect(result).to.deep.include({ name: "Alice" });
			expect(result).to.deep.include({ name: "Eve" });
		});

		it("should return values that are not in the dismiss list", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: true,
				c: (a, b) => a.localeCompare(b),
			});
			dict.insert("Bob", { name: "Bob" });
			dict.insert("Alice", { name: "Alice" });
			dict.insert("Eve", { name: "Eve" });
			dict.insert("John", { name: "John" });

			const result = dict.$nin(["Bob", "Eve"]);

			expect(result).to.have.lengthOf(2);
			expect(result).to.deep.include({ name: "Alice" });
			expect(result).to.deep.include({ name: "John" });
		});

		it("should not modify the original dictionary", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: true,
				c: (a, b) => a.localeCompare(b),
			});
			dict.insert("Bob", { name: "Bob" });
			dict.insert("Alice", { name: "Alice" });
			dict.insert("Eve", { name: "Eve" });

			const originalLength = dict.keys.length;
			dict.$nin(["foo", "bar"]);
			const newLength = dict.keys.length;

			expect(originalLength).to.equal(newLength);
		});
	});

	describe("$ne", () => {
		const dict = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});
		const docs = [
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
			{ id: 3, name: "Charlie" },
			{ id: 4, name: "Dave" },
			{ id: 5, name: "Eve" },
		];
		docs.forEach((doc) => dict.insert(doc.id, doc));

		it("should return all values not equal to the given key", () => {
			const result = dict.$ne(3);
			expect(result).to.deep.equal([docs[0], docs[1], docs[3], docs[4]]);
		});

		it("should handle non-existent keys", () => {
			const result = dict.$ne(6);
			expect(result).to.deep.equal(docs);
		});

		it("should handle non-unique fields", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: false,
				c: (a, b) => a.localeCompare(b),
			});
			const docs = [
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
				{ id: 3, name: "Charlie" },
				{ id: 4, name: "Dave" },
				{ id: 5, name: "Eve" },
				{ id: 6, name: "Alice" },
				{ id: 7, name: "Bob" },
			];
			docs.forEach((doc) => dict.insert(doc.name, doc));
			const result = dict.$ne("Bob");
			expect(result).to.deep.equal([docs[0], docs[5], docs[2], docs[3], docs[4]]);
		});

		it("should handle keys of different types", () => {
			const dict = new Dictionary<any>({
				fieldName: "key",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			const docs = [
				{ key: 1, value: "one" },
				{ key: "2", value: "two" },
				{ key: true, value: "three" },
				{ key: 4n, value: "four" },
				{ key: [5], value: "five" },
			];
			docs.forEach((doc) => dict.insert(doc.key, doc));
			const result = dict.$ne("2");
			console.log(result);
			expect(result).to.deep.equal([docs[0], docs[4], docs[2], docs[3]]);
		});
	});

	describe("$betweenBounds", () => {
		let dictionary = new Dictionary<any>({
			fieldName: "id",
			unique: true,
			c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
		});
		beforeEach(() => {
			dictionary = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dictionary.insert(1, { id: 1, name: "A" });
			dictionary.insert(3, { id: 3, name: "B" });
			dictionary.insert(5, { id: 5, name: "C" });
			dictionary.insert(7, { id: 7, name: "D" });
		});

		it("should return all documents between the bounds", () => {
			const result = dictionary.betweenBounds(3, true, 5, true);
			expect(result).to.deep.equal([
				{ id: 3, name: "B" },
				{ id: 5, name: "C" },
			]);
		});

		it("should return an empty array if no documents found between the bounds", () => {
			const result = dictionary.betweenBounds(3.5, true, 4, true);
			expect(result).to.be.an("array").that.is.empty;
			{
				const result = dictionary.betweenBounds(3.5, false, 4, false);
				expect(result).to.be.an("array").that.is.empty;
			}
		});

		it("should return an empty array if the lower bound is greater than the upper bound", () => {
			const result = dictionary.betweenBounds(5, true, 3, true);
			expect(result).to.be.an("array").that.is.empty;
		});

		it("should include documents with keys equal to the lower and upper bounds", () => {
			const result = dictionary.betweenBounds(3, true, 7, true);
			expect(result).to.deep.equal([
				{ id: 3, name: "B" },
				{ id: 5, name: "C" },
				{ id: 7, name: "D" },
			]);
		});

		it("should work with keys that are not numbers", () => {
			const dict = new Dictionary<any>({
				fieldName: "name",
				unique: true,
				c: (a: string, b) => {
                    return a.localeCompare(b)
                },
			});
			dict.insert("a", { name: "a", value: 1 });
			dict.insert("b", { name: "b", value: 2 });
			dict.insert("c", { name: "c", value: 3 });

			const result = dict.betweenBounds("a", true, "c", true);
			expect(result).to.deep.equal([
				{ name: "a", value: 1 },
				{ name: "b", value: 2 },
				{ name: "c", value: 3 },
			]);
		});

		it("should return all values between the lower and upper bounds inclusive", () => {
			const dict = new Dictionary({
				fieldName: "name",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { name: "A" });
			dict.insert(2, { name: "B" });
			dict.insert(3, { name: "C" });
			dict.insert(4, { name: "D" });
			dict.insert(5, { name: "E" });
			dict.insert(6, { name: "F" });

			const result = dict.betweenBounds(2,true, 5, true);
			expect(result.length).to.equal(4);
			expect(result[0].name).to.equal("B");
			expect(result[1].name).to.equal("C");
			expect(result[2].name).to.equal("D");
			expect(result[3].name).to.equal("E");
		});

		it("should return all values between the lower and upper bounds exclusive", () => {
			const dict = new Dictionary({
				fieldName: "name",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { name: "A" });
			dict.insert(2, { name: "B" });
			dict.insert(3, { name: "C" });
			dict.insert(4, { name: "D" });
			dict.insert(5, { name: "E" });
			dict.insert(6, { name: "F" });

			const result = dict.betweenBounds(2, false, 5, false);
			expect(result.length).to.equal(2);
			expect(result[0].name).to.equal("C");
			expect(result[1].name).to.equal("D");
		});

		it("should return values between the lower and upper bounds exclusive of the lower bound and inclusive of the upper bound", () => {
			const dict = new Dictionary({
				fieldName: "name",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { name: "A" });
			dict.insert(2, { name: "B" });
			dict.insert(3, { name: "C" });
			dict.insert(4, { name: "D" });
			dict.insert(5, { name: "E" });
			dict.insert(6, { name: "F" });

			const result = dict.betweenBounds(2, false, 5, true);
			expect(result.length).to.equal(3);
			expect(result[0].name).to.equal("C");
			expect(result[1].name).to.equal("D");
			expect(result[2].name).to.equal("E");
		});

        it("should return values between the lower and upper bounds inclusive of the lower bound and exclusive of the upper bound", () => {
			const dict = new Dictionary({
				fieldName: "name",
				unique: false,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			dict.insert(1, { name: "A" });
			dict.insert(2, { name: "B" });
			dict.insert(3, { name: "C" });
			dict.insert(4, { name: "D" });
			dict.insert(5, { name: "E" });
			dict.insert(6, { name: "F" });

			const result = dict.betweenBounds(2, true, 5, false);
			expect(result.length).to.equal(3);
			expect(result[0].name).to.equal("B");
			expect(result[1].name).to.equal("C");
			expect(result[2].name).to.equal("D");
		});
	});

	describe("#all", () => {
		it("should return all documents in the dictionary", () => {
			const dictionary = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			const document1 = { id: 1, name: "Alice" };
			const document2 = { id: 2, name: "Bob" };
			const document3 = { id: 3, name: "Charlie" };
			dictionary.insert(document1.id, document1);
			dictionary.insert(document2.id, document2);
			dictionary.insert(document3.id, document3);
			expect(dictionary.all).to.deep.equal([document1, document2, document3]);
		});
	});

	describe("#size", () => {
		it("should return the number of documents in the dictionary", () => {
			const dictionary = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			const document1 = { id: 1, name: "Alice" };
			const document2 = { id: 2, name: "Bob" };
			const document3 = { id: 3, name: "Charlie" };
			dictionary.insert(document1.id, document1);
			dictionary.insert(document2.id, document2);
			dictionary.insert(document3.id, document3);
			expect(dictionary.size).to.equal(3);
		});
	});

	describe("#numberOfKeys", () => {
		it("should return the number of keys in the dictionary", () => {
			const dictionary = new Dictionary<any>({
				fieldName: "id",
				unique: true,
				c: (a, b) => (a === b ? 0 : a > b ? 1 : -1),
			});
			const document1 = { id: 1, name: "Alice" };
			const document2 = { id: 2, name: "Bob" };
			const document3 = { id: 3, name: "Charlie" };
			dictionary.insert(document1.id, document1);
			dictionary.insert(document2.id, document2);
			dictionary.insert(document3.id, document3);
			expect(dictionary.numberOfKeys).to.equal(3);
		});
	});
});
