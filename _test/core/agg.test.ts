/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js";
const Aggregate = xwebdb._internal.Aggregate;
const assert = chai.assert;

describe("Aggregate", () => {
	let documents = [
		{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
		{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
		{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
		{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
	];
	let aggregate = new Aggregate(documents);

	beforeEach(() => {
		// Prepare the test data (documents) and create a new instance of Aggregate
		documents = [
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
			{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
		];
		aggregate = new Aggregate(documents);
	});

	it("should filter documents based on a given condition", () => {
		const filtered = aggregate.$match({ city: "San Francisco" }).toArray();
		assert.deepEqual(filtered, [
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
		]);
	});

	it("should filter documents based on a given condition (using operators)", () => {
		const filtered = aggregate.$match({ age: { $lte: 30 } }).toArray();
		assert.deepEqual(filtered, [
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
		]);
	});

	it("should group documents based on a given field and apply a reducer function", () => {
		const grouped = aggregate
			.$group({
				_id: "city",
				reducer: (group) => {
					const totalAge = group.reduce((sum, doc) => sum + doc.age, 0);
					return { city: group[0].city, totalAge };
				},
			})
			.toArray();
		assert.deepEqual(grouped, [
			{ city: "New York", totalAge: 60 },
			{ city: "San Francisco", totalAge: 70 },
		]);
	});

	it("should limit the number of documents returned", () => {
		const limited = aggregate.$limit(2).toArray();
		assert.deepEqual(limited, [
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
		]);
	});

	it("should skip a specified number of documents", () => {
		const skipped = aggregate.$skip(2).toArray();
		assert.deepEqual(skipped, [
			{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
		]);
	});

	it("should add new fields to each document", () => {
		const withNewFields = aggregate.$addFields((doc) => ({ isYoung: doc.age < 30 })).toArray();
		assert.deepEqual(withNewFields, [
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"], isYoung: true },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"], isYoung: false },
			{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"], isYoung: false },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"], isYoung: false },
		]);
	});

	it("should sort the documents based on a given criteria", () => {
		const sorted = aggregate.$sort({ age: -1 }).toArray();
		assert.deepEqual(sorted, [
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
			{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
		]);
	});

	it("should sort documents based on multiple fields", () => {
		const sorted = aggregate.$sort({ city: 1, name: -1 }).toArray();
		assert.deepEqual(sorted, [
			{ name: "Charlie", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Alice", age: 25, city: "New York", hobbies: ["reading", "painting"] },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking"] },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: ["writing", "gardening"] },
		]);
	});

	it("should unwind an array field and create separate documents for each element", () => {
		const unwound = aggregate.$unwind("hobbies").toArray();
		assert.deepEqual(unwound, [
			{ name: "Alice", age: 25, city: "New York", hobbies: "reading" },
			{ name: "Alice", age: 25, city: "New York", hobbies: "painting" },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: "writing" },
			{ name: "Bob", age: 30, city: "San Francisco", hobbies: "gardening" },
			{ name: "Charlie", age: 35, city: "New York", hobbies: "swimming" },
			{ name: "Charlie", age: 35, city: "New York", hobbies: "photography" },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: "cooking" },
			{ name: "Dave", age: 40, city: "San Francisco", hobbies: "hiking" },
		]);
	});

	it("should project only specified fields in the documents", () => {
		const projected = aggregate.$project({ name: 1, age: 1 }).toArray();
		assert.deepEqual(projected, [
			{ name: "Alice", age: 25 },
			{ name: "Bob", age: 30 },
			{ name: "Charlie", age: 35 },
			{ name: "Dave", age: 40 },
		] as any);
	});

	it("should omit specified fields in the documents", () => {
		const projected = aggregate.$project({ name: 0, city: 0, hobbies: 0 }).toArray();
		assert.deepEqual(projected, [{ age: 25 }, { age: 30 }, { age: 35 }, { age: 40 }] as any);
	});

	it("should perform a complete aggregation pipeline", () => {
		const documents = [
			{ name: "Ali Salem", age: 25, city: "New York", hobbies: ["reading", "fishing"] },
			{ name: "Dina Salem", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Bob Marly", age: 30, city: "San Francisco", hobbies: ["writing", "gardening", "TV", "swimming"] },
			{ name: "Ridley Scott", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking", "TV", "movies"] },
		];

		const aggregate = new Aggregate(documents);

		const result = aggregate
			.$addFields((doc) => ({ firstName: doc.name.split(" ")[0], lastName: doc.name.split(" ")[1] }))
			.$sort({ age: 1 })
			.$unwind("hobbies")
			.$match({ lastName: "Salem" })
			.$sort({ hobbies: -1 })
			.$skip(1)
			.$limit(2)
			.$project({ city: 1, age: 1 })
			.$group({
				_id: "city",
				reducer: (group) => ({
					averageAge: group.reduce((sum, doc) => sum + doc.age, 0) / group.length,
					count: group.length,
				}),
			})
			.$project({
				count: 0,
			})
			.toArray();
		assert.deepEqual(result, [{ averageAge: 30 }] as any);
	});
	it("Aggregation method chaining can be divided", () => {
		const documents = [
			{ name: "Ali Salem", age: 25, city: "New York", hobbies: ["reading", "fishing"] },
			{ name: "Daniel Xavier", age: 35, city: "New York", hobbies: ["swimming", "photography"] },
			{ name: "Bob Adams", age: 30, city: "San Francisco", hobbies: ["writing", "gardening", "TV", "swimming"] },
			{ name: "Ridley Scott", age: 40, city: "San Francisco", hobbies: ["cooking", "hiking", "TV", "movies"] },
		];
		const aggregate = new Aggregate(documents);
		const baseAggregate = aggregate.$addFields((doc) => ({ firstName: doc.name.split(" ")[0], lastName: doc.name.split(" ")[1] }));
		const aggregate1 = baseAggregate.$sort({ lastName: 1 }).$project({ lastName: 1 });
		const aggregate2 = baseAggregate.$sort({ firstName: 1 }).$project({ firstName: 1 });
		assert.deepEqual(aggregate1.toArray(), [{ lastName: "Adams" }, { lastName: "Salem" }, { lastName: "Scott" }, { lastName: "Xavier" }] as any);
		assert.deepEqual(aggregate2.toArray(), [{ firstName: "Ali" }, { firstName: "Bob" }, { firstName: "Daniel" }, { firstName: "Ridley" }] as any);
	});
});
