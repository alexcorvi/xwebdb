/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../dist/core/observable.d.ts"/>
import xwebdb from "../../dist/xwebdb.js";
const { Database, Doc } = xwebdb;
const expect = chai.expect;
class Person extends Doc {
	name = "name";
	age: number = 12;
	array: [1, 2, 3, 4];
	obj: {
		a: 1;
	};
	get getter() {
		return this.age * 10;
	}
	notIndexed = 10;
}

describe("Matching from tree", () => {
	let db = new Database<Person>({
		ref: "db_1",
		indexes: ["age", "getter", "name"],
		model: Person
	});

	beforeEach(async () => {
		await db.remove({}, true);
		await db.insert(
			Person.new({
				age: 1,
				name: "a",
			})
		);
		await db.insert(
			Person.new({
				age: 2,
				name: "b",
			})
		);
		await db.insert(
			Person.new({
				age: 3,
				name: "c",
			})
		);
	});

	describe("No top level", () => {
		describe("Basic matching", () => {
			it("One prop", async () => {
				expect(db._datastore.fromDict({ age: 1 })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: "a" })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: "b" })!.map((x) => x.age)).deep.eq([2]);
			});
			it("Multiple props", async () => {
				expect(db._datastore.fromDict({ age: 1, name: "a" })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: "a", age: 1 })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: "b", age: 2 })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ name: "bbb", age: 33 })!.map((x) => x.age)).deep.eq([]);
			});
			it("getter matching should be got from tree", async () => {
				expect(db._datastore.fromDict({ getter: 10 })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ getter: 20 })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ getter: 30, name: "c" })!.map((x) => x.age)).deep.eq([3]);
			});
			it("un-indexed should be null", async () => {
				expect(db._datastore.fromDict({ notIndexed: 30 })).eq(null);
			});
		});

		describe("$eq matching", () => {
			it("One prop", async () => {
				expect(db._datastore.fromDict({ age: { $eq: 1 } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $eq: "a" } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $eq: "b" } })!.map((x) => x.age)).deep.eq([2]);
			});
			it("Multiple props", async () => {
				expect(db._datastore.fromDict({ age: { $eq: 1 }, name: { $eq: "a" } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $eq: "a" }, age: { $eq: 1 } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $eq: "b" }, age: { $eq: 2 } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ name: { $eq: "bb" }, age: { $eq: 333 } })!.map((x) => x.age)).deep.eq([]);
			});
			it("getter matching should be got from tree", async () => {
				expect(db._datastore.fromDict({ getter: { $eq: 10 } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ getter: { $eq: 20 } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ getter: { $eq: 30 }, name: { $eq: "c" } })!.map((x) => x.age)).deep.eq([3]);
			});
			it("un-indexed should be null", async () => {
				expect(db._datastore.fromDict({ notIndexed: { $eq: 30 } })).eq(null);
			});
		});
		describe("$in matching", () => {
			it("One prop", async () => {
				expect(db._datastore.fromDict({ age: { $in: [1] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $in: ["a"] } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $in: ["b"] } })!.map((x) => x.age)).deep.eq([2]);
			});
			it("Multiple props", async () => {
				expect(db._datastore.fromDict({ age: { $in: [1] }, name: { $in: ["a"] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $in: ["a"] }, age: { $in: [1] } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $in: ["b"] }, age: { $in: [2] } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ name: { $in: ["b$"] }, age: { $in: [333] } })!.map((x) => x.age)).deep.eq([]);
			});
			it("getter matching should be got from tree", async () => {
				expect(db._datastore.fromDict({ getter: { $in: [10] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ getter: { $in: [20] } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ getter: { $in: [30] }, name: { $in: ["c"] } })!.map((x) => x.age)).deep.eq([3]);
			});
			it("un-indexed should be null", async () => {
				expect(db._datastore.fromDict({ notIndexed: { $in: [30] } })).eq(null);
			});
		});
		describe("$nin matching", () => {
			it("One prop", async () => {
				expect(db._datastore.fromDict({ age: { $nin: [2, 3] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $nin: ["b", "c"] } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $nin: ["a", "c"] } })!.map((x) => x.age)).deep.eq([2]);
			});
			it("Multiple props", async () => {
				expect(db._datastore.fromDict({ age: { $nin: [2, 3] }, name: { $nin: ["b", "c"] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ name: { $nin: ["b", "c"] }, age: { $nin: [2, 3] } })!.map((x) => x.age)).deep.eq([1]);
				expect(db._datastore.fromDict({ name: { $nin: ["a", "c"] }, age: { $nin: [1, 3] } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ name: { $nin: ["a", "c", "b"] }, age: { $nin: [2, 1, 3] } })!.map((x) => x.age)).deep.eq([]);
			});
			it("getter matching should be got from tree", async () => {
				expect(db._datastore.fromDict({ getter: { $nin: [20, 30] } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ getter: { $nin: [10, 30] } })!.map((x) => x.age)).deep.eq([2]);
				expect(db._datastore.fromDict({ getter: { $nin: [10, 20] }, name: { $nin: ["a"] } })!.map((x) => x.age)).deep.eq([3]);
			});
			it("un-indexed should be null", async () => {
				expect(db._datastore.fromDict({ notIndexed: { $nin: [30] } })).eq(null);
			});
		});
		describe("numerical bounded matching", () => {
			it("One prop", async () => {
				expect(db._datastore.fromDict({ age: { $lt: 2 } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ age: { $lt: 3, $gt: 1 } })!.map((x) => x.name)).deep.eq(["b"]);
			});
			it("getter matching should be got from tree", async () => {
				expect(db._datastore.fromDict({ getter: { $lt: 20 } })!.map((x) => x.name)).deep.eq(["a"]);
				expect(db._datastore.fromDict({ getter: { $lt: 30, $gt: 10 } })!.map((x) => x.name)).deep.eq(["b"]);
			});
			it("un-indexed should be null", async () => {
				expect(db._datastore.fromDict({ notIndexed: { $lt: 30 } })).eq(null);
			});
		});
	});
});
