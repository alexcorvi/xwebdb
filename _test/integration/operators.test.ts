/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../node_modules/@types/underscore/index.d.ts" />

import xwebdb from "../../dist/xwebdb.js";
const Doc = xwebdb.Doc;
const Database = xwebdb.Database;
const expect = chai.expect;

const testDb = "testdatabase";

async function rejected(f: () => Promise<any>) {
	let rejected = false;
	try {
		await f();
	} catch (e) {
		rejected = true;
	}
	return rejected;
}

interface Child {
	name: string;
	age: number;
}

class Employee extends Doc {
	name: string = "";
	rooms: string[] = [];
	events: number[] = [];
	age: number = 9;
	male: boolean = false;
	children: Child[] = [];
	props: {
		h: number;
		w: number;
	} = { h: 0, w: 0 };

	additional: boolean | undefined;
	variant: number | string | undefined;

	isFemale() {
		return !this.male;
	}
	lastLogin: Date = new Date();
	lastLoginTimestamp: number = 0;
	get female() {
		return !this.male;
	}
}

describe("Operators tests", () => {
	let dbName = testDb;

	let db = new Database<Employee>({
		ref: dbName,
		model: Employee,
	});

	beforeEach(async () => {
		db = new Database<Employee>({
			ref: dbName,
			model: Employee,
		});
		await db.delete({}, true);
		await db.reload();
		(await db.count({})).should.equal(0);

		await db.insert([
			Employee.new({
				name: "alex",
				age: 28,
				male: true,
				children: [],
				rooms: ["a", "b", "c"],
				events: [2, 4, 6],
				props: { h: 174, w: 59 },
				variant: "str",
			}),
			Employee.new({
				name: "dina",
				age: 27,
				male: false,
				children: [],
				rooms: ["a", "c"],
				events: [3, 6, 9],
				props: { h: 165, w: 69 },
				variant: 12,
			}),
			Employee.new({
				name: "john",
				age: 35,
				male: true,
				rooms: ["a", "b", "c", "d"],
				events: [5, 10, 15],
				children: [
					{ name: "jim", age: 3 },
					{ name: "tom", age: 4 },
					{ name: "roy", age: 8 },
				],
				props: { h: 160, w: 69 },
				additional: true,
			}),
		]);
	});
	afterEach(async () => {
		await db.delete({}, true);
	});

	describe("Query Selectors", () => {
		describe("Comparison", () => {
			it("$eq", async () => {
				{
					// basic
					const res = await db.find({ name: { $eq: "john" } });
					expect(res.length).eq(1);
					expect(res[0].age).eq(35);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $eq: 160 } } } });
					expect(res.length).eq(1);
					expect(res[0].age).eq(35);
				}
				{
					// in array
					const res = await db.find({ rooms: { $eq: "d" } });
					expect(res.length).eq(1);
					expect(res[0].age).eq(35);
				}
			});
			it("$ne", async () => {
				{
					// basic
					const res = await db.find({ name: { $ne: "john" } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $ne: 160 } } } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
				{
					// in array
					const res = await db.find({ rooms: { $ne: "d" } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
			});
			it("$gt", async () => {
				{
					// basic
					const res = await db.find({ age: { $gt: 27 } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.name === "dina")).eq(-1);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $gt: 160 } } } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
				{
					// in array
					const res = await db.find({ events: { $gt: 12 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
			});
			it("$lt", async () => {
				{
					// basic
					const res = await db.find({ age: { $lt: 28 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.name === "dina")).eq(0);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $lt: 165 } } } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
				{
					// in array
					const res = await db.find({ events: { $lt: 3 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 28)).eq(0);
				}
			});
			it("$gte", async () => {
				{
					// basic
					const res = await db.find({ age: { $gte: 28 } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.name === "dina")).eq(-1);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $gte: 165 } } } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
				{
					// in array
					const res = await db.find({ events: { $gte: 15 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
			});
			it("$lte", async () => {
				{
					// basic
					const res = await db.find({ age: { $lte: 27 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.name === "dina")).eq(0);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $lte: 160 } } } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
				{
					// in array
					const res = await db.find({ events: { $lte: 2 } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 28)).eq(0);
				}
			});
			it("$in", async () => {
				{
					// basic
					const res = await db.find({ age: { $in: [28, 27, 39] } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.name === "john")).eq(-1);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $in: [160] } } } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
				{
					// in array
					const res = await db.find({ events: { $in: [2, 4, 6, 8] } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.age === 35)).eq(-1);
				}
			});
			it("$nin", async () => {
				{
					// basic
					const res = await db.find({ age: { $nin: [28, 27, 39] } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.name === "john")).eq(0);
				}
				{
					// deep
					const res = await db.find({ $deep: { props: { h: { $nin: [165, 174] } } } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
				{
					// in array
					const res = await db.find({ events: { $nin: [6, 12] } });
					expect(res.length).eq(1);
					expect(res.findIndex((x) => x.age === 35)).eq(0);
				}
			});
		});
		describe("Element", () => {
			it("$exists", async () => {
				{
					const res = await db.find({ additional: { $exists: true } });
					expect(res.length).eq(1);
					expect(res[0].name).eq("john");
				}
				{
					const res = await db.find({ additional: { $exists: false } });
					expect(res.length).eq(2);
					expect(res.findIndex((x) => x.name === "john")).eq(-1);
				}
			});
			it("$type", async () => {
				{
					const res = await db.find({ variant: { $type: "number" } });
					expect(res.length).eq(1);
					expect(res[0].name).eq("dina");
				}
				{
					const res = await db.find({ variant: { $type: "string" } });
					expect(res.length).eq(1);
					expect(res[0].name).eq("alex");
				}
				{
					const res = await db.find({
						$nor: [{ variant: { $type: "string" } }, { variant: { $type: "number" } }],
					});
					expect(res.length).eq(1);
					expect(res[0].name).eq("john");
				}
			});
		});
		describe("Evaluation", () => {
			it("$mod", async () => {
				const res = await db.find({ age: { $mod: [5, 0] } });
				expect(res.length).eq(1);
				expect(res[0].name).eq("john");
			});
			it("$regex", async () => {
				const res = await db.find({ name: { $regex: /a/ } });
				expect(res.length).eq(2);
				expect(res.findIndex((x) => x.name === "john")).eq(-1);
			});
			it("$where", async () => {
				const res = await db.find({
					$where: function () {
						return this.rooms.indexOf("b") > -1 && this.age > 30;
					},
				});
				expect(res.length).eq(1);
				expect(res[0].name).eq("john");
			});
		});
		describe("Array", () => {
			it("$all", async () => {
				const res = await db.find({ rooms: { $all: ["b", "c"] } });
				expect(res.length).eq(2);
				expect(res.find((x) => x.name === "dina")).eq(undefined);
			});
			it("$elemMatch", async () => {
				{
					const res = await db.find({ events: { $elemMatch: { $gt: 12 } } });
					expect(res.length).eq(1);
					expect(res[0].name).eq("john");
				}
				{
					const res = await db.find({ events: { $elemMatch: { $not: { $lt: 12 } } } });
					expect(res.length).eq(1);
					expect(res[0].name).eq("john");
				}
			});
			it("$size", async () => {
				const res = await db.find({
					rooms: { $size: 2 },
				});
				expect(res.length).eq(1);
				expect(res[0].name).eq("dina");
			});
		});
		describe("Logical", () => {
			it("$and", async () => {
				const res = await db.find({
					$and: [{ events: { $lte: 12 } }, { events: { $gt: 9 } }],
				});
				expect(res.length).eq(1);
				expect(res[0].name).eq("john");
			});
			it("$nor", async () => {
				const res = await db.find({ $nor: [{ age: { $lt: 28 } }, { age: { $gt: 30 } }] });
				expect(res.length).eq(1);
				expect(res[0].name).eq("alex");
			});
			it("$not", async () => {
				const res = await db.find({ events: { $not: { $lt: 10 } } });
				expect(res.length).eq(1);
				expect(res[0].name).eq("john");
			});
			it("$or", async () => {
				const res = await db.find({ $or: [{ age: { $lt: 28 } }, { age: { $gt: 30 } }] });
				expect(res.length).eq(2);
				expect(res.findIndex((x) => x.name === "alex")).eq(-1);
			});
		});
	});

	describe("Update Operators", () => {
		describe("Field update operators", () => {
			it("$currentDate", async () => {
				await db.update({ name: "john" }, { $currentDate: { lastLogin: true } });
				await db.update({ name: "dina" }, { $currentDate: { lastLogin: { $type: "date" } } });
				await db.update({ name: "alex" }, { $currentDate: { lastLoginTimestamp: { $type: "timestamp" } } });
				expect((await db.find({ name: "john" }))[0].lastLogin instanceof Date).eq(true);

				expect((await db.find({ name: "dina" }))[0].lastLogin instanceof Date).eq(true);

				expect(typeof (await db.find({ name: "alex" }))[0].lastLoginTimestamp === "number").eq(true);
			});
			it("$inc", async () => {
				await db.update({ name: "john" }, { $inc: { age: 1 } });
				expect((await db.find({ name: "john" }))[0].age).eq(36);
				await db.update({ name: "john" }, { $inc: { age: 1 } });
				expect((await db.find({ name: "john" }))[0].age).eq(37);
				await db.update({ name: "john" }, { $inc: { age: 3 } });
				expect((await db.find({ name: "john" }))[0].age).eq(40);
				await db.update({ name: "john" }, { $inc: { age: -5 } });
				expect((await db.find({ name: "john" }))[0].age).eq(35);
			});
			it("$mul", async () => {
				await db.update({ name: "john" }, { $mul: { age: 2 } });
				expect((await db.find({ name: "john" }))[0].age).eq(70);
			});
			it("$min", async () => {
				await db.update({ name: "john" }, { $min: { age: 37 } });
				expect((await db.find({ name: "john" }))[0].age).eq(35);
				await db.update({ name: "john" }, { $min: { age: 32 } });
				expect((await db.find({ name: "john" }))[0].age).eq(32);
			});
			it("$max", async () => {
				await db.update({ name: "john" }, { $max: { age: 32 } });
				expect((await db.find({ name: "john" }))[0].age).eq(35);
				await db.update({ name: "john" }, { $max: { age: 37 } });
				expect((await db.find({ name: "john" }))[0].age).eq(37);
			});
			it("$rename", async () => {
				await db.update({ name: "john" }, { $rename: { rooms: "_rooms" } });
				expect(((await db.find({ name: "john" })) as any)[0]._rooms.length).eq(4);
			});
			it("$set", async () => {
				await db.update({ name: "john" }, { $set: { $deep: { props: { h: 192 } } } });
				expect((await db.find({ name: "john" }))[0].props.h).eq(192);
				await db.update({ name: "john" }, { $set: { age: 90 } });
				expect((await db.find({ name: "john" }))[0].age).eq(90);
			});
			it("$unset", async () => {
				await db.update({ name: "john" }, { $unset: { $deep: { props: { h: "" } } } });
				expect((await db.find({ name: "john" }))[0].props.h).eq(undefined);
				await db.update({ name: "john" }, { $unset: { additional: "" } });
				expect((await db.find({ name: "john" }))[0].additional).eq(undefined);
			});
			it("$setOnInsert", async () => {
				await db.upsert({ name: "john" }, { $set: { name: "joe" }, $setOnInsert: Employee.new({ name: "joe" }) });
				expect((await db.find({ name: "joe" }))[0].age).eq(35);
				await db.upsert({ name: "elizabeth" }, { $set: { name: "beth" }, $setOnInsert: Employee.new({ name: "beth" }) });
				expect((await db.find({ name: "beth" }))[0].age).eq(9);
			});
		});
		describe("Array update operators", () => {
			it("$addToSet", async () => {
				await db.update({ name: "john" }, { $addToSet: { rooms: "f" } });
				await db.update({ name: "john" }, { $addToSet: { rooms: { $each: ["a", "n"] } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(doc.rooms.length).eq(6);
				expect(doc.rooms[doc.rooms.length - 1]).eq("n");
				expect(doc.rooms[doc.rooms.length - 2]).eq("f");
			});
			it("$pop", async () => {
				{
					await db.update({ name: "john" }, { $pop: { rooms: -1 } });
					const doc = (await db.find({ name: "john" }))[0];
					expect(doc.rooms.length).eq(3);
					expect(JSON.stringify(doc.rooms)).eq(JSON.stringify(["b", "c", "d"]));
				}
				{
					await db.update({ name: "john" }, { $pop: { rooms: 1 } });
					const doc = (await db.find({ name: "john" }))[0];
					expect(doc.rooms.length).eq(2);
					expect(JSON.stringify(doc.rooms)).eq(JSON.stringify(["b", "c"]));
				}
			});
			it("$pull", async () => {
				await db.update({ name: "john" }, { $pull: { rooms: "a", events: { $lte: 10 } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.rooms)).eq(JSON.stringify(["b", "c", "d"]));
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([15]));
			});
			it("$pull $eq", async () => {
				await db.update({ name: "john" }, { $pull: { rooms: "a", events: { $in: [10, 11, 12] } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.rooms)).eq(JSON.stringify(["b", "c", "d"]));
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 15]));
			});
			it("$pull $or", async () => {
				await db.update({ name: "john" }, { $pull: { children: { $or: [{ name: "jim" }, { name: "roy" }] } } });
				const doc = (await db.find({ name: "john" }))[0];
				doc.children.length.should.eq(1);
				doc.children[0].name.should.eq("tom");
			});
			it("$pullAll", async () => {
				await db.update({ name: "john" }, { $pullAll: { rooms: ["a"], events: [5, 10] } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.rooms)).eq(JSON.stringify(["b", "c", "d"]));
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([15]));
			});
			it("$push", async () => {
				await db.update({ name: "john" }, { $push: { events: 5 } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 10, 15, 5]));
			});
			it("$push $each", async () => {
				await db.update({ name: "john" }, { $push: { events: { $each: [5, 10, 15] } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 10, 15, 5, 10, 15]));
			});
			it("$push $each $position", async () => {
				await db.update({ name: "john" }, { $push: { events: { $each: [5, 10, 15], $position: 1 } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 5, 10, 15, 10, 15]));
			});
			it("$push $each $slice", async () => {
				await db.update({ name: "john" }, { $push: { events: { $each: [5, 10, 15], $position: 1, $slice: 3 } } });
				const doc = (await db.find({ name: "john" }))[0];
				expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 5, 10]));
			});
			it("$push $each $sort", async () => {
				{
					await db.update({ name: "john" }, { $push: { events: { $each: [5, 10, 15], $sort: 1 } } });
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.events)).eq(JSON.stringify([5, 5, 10, 10, 15, 15]));
				}
				{
					await db.update({ name: "john" }, { $push: { events: { $each: [5, 10, 15], $sort: -1 } } });
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.events)).eq(JSON.stringify([15, 15, 15, 10, 10, 10, 5, 5, 5]));
				}
			});
			describe("variations on the sort mechanism", () => {
				it("$push $each $sort 1", async () => {
					await db.update(
						{ name: "john" },
						{
							$push: { children: { $each: [{ name: "tim", age: 3 }], $sort: { age: 1, name: 1 } } },
						}
					);
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.children.map((x) => x.name))).eq(JSON.stringify(["jim", "tim", "tom", "roy"]));
				});
				it("$push $each $sort 2", async () => {
					await db.update(
						{ name: "john" },
						{
							$push: { children: { $each: [{ name: "tim", age: 3 }], $sort: { age: 1, name: -1 } } },
						}
					);
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.children.map((x) => x.name))).eq(JSON.stringify(["tim", "jim", "tom", "roy"]));
				});
				it("$push $each $sort 3", async () => {
					await db.update(
						{ name: "john" },
						{
							$push: { children: { $each: [{ name: "tim", age: 3 }], $sort: { age: -1, name: -1 } } },
						}
					);
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.children.map((x) => x.name))).eq(JSON.stringify(["roy", "tom", "tim", "jim"]));
				});
				it("$push $each $sort 4", async () => {
					await db.update(
						{ name: "john" },
						{
							$push: { children: { $each: [{ name: "tim", age: 3 }], $sort: { age: -1, name: 1 } } },
						}
					);
					const doc = (await db.find({ name: "john" }))[0];
					expect(JSON.stringify(doc.children.map((x) => x.name))).eq(JSON.stringify(["roy", "tom", "jim", "tim"]));
				});
			});
		});
	});
});
