/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/index.d.ts" />
/// <reference path="../../node_modules/@types/underscore/index.d.ts" />

import unifydb from "../../dist/unifydb.js";
import underscore from "../../node_modules/underscore/underscore.js";

const customUtils = unifydb._internal.customUtils;
const _: any = underscore;
const idb: any = (window as any).localforage;
const { Datastore, modelling: model } = unifydb._internal;
const BaseModel = unifydb.BaseModel;
const Database = unifydb.Database;
const assert = chai.assert;
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

interface Toy {
	name: string;
	price: number;
}

interface Child {
	fullName: string;
	toys: Toy[];
}

class Employee extends BaseModel<Employee> {
	name: string = "";
	age: number = 9;
	male: boolean = false;
	arr: Child[] = [];
	d?: {
		a: {
			x: number;
		};
	};

	isFemale() {
		return !this.male;
	}

	get female() {
		return !this.male;
	}
}

class Simple extends BaseModel<Simple> {
	a: number = 1;
}

describe("Actions", async () => {
	describe("Connection", () => {
		it("Connection with an object param", (done) => {
			const db = new Database<Simple>({ ref: "ref", model: Simple });
			db.loaded
				.then(() => done())
				.catch((e) => {
					throw e;
				});
		});
		it("Connection with an already created DB", (done) => {
			const db1 = new Database({ ref: "ref", model: Simple });
			const db2 = new Database({ ref: "ref", model: Simple });
			Promise.all([db1.loaded, db2.loaded])
				.then(() => done())
				.catch((e) => {
					throw e;
				});
		});
	});

	describe("Operations", () => {
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
			await db.reload();
			(await db.count({})).should.equal(0);
		});
		afterEach(async () => {
			await db.delete({}, true);
		});

		describe("Creating", () => {
			it("Basic creation", async () => {
				await db.insert([
					Employee.new({
						name: "Alex",
						age: 12,
						arr: [],
						male: true,
					}),
				]);
				const docs = await db.read({});
				expect(docs.length).to.be.equal(1);
				const doc = docs[0];
				expect(doc.name).to.be.equal("Alex");
				expect(doc.age).to.be.equal(12);
				expect(doc.male).to.be.equal(true);
				expect(doc.arr.length).to.be.equal(0);
			});
			it("Creating while giving an ID", async () => {
				await db.insert([
					Employee.new({
						_id: "1234",
						name: "Alex",
						age: 12,
						arr: [],
						male: true,
					}),
				]);
				const docs = await db.read({});
				expect(docs.length).to.be.equal(1);
				const doc = docs[0];
				expect(doc._id).to.be.equal("1234");
			});
			it("Creating multiple in single call", async () => {
				await db.insert([
					Employee.new({
						_id: "1",
						name: "Alex",
						age: 12,
						arr: [],
						male: true,
					}),
					Employee.new({
						_id: "2",
						name: "Dina",
						age: 1,
						arr: [],
						male: false,
					}),
				]);
				const docs = await db.read({});
				expect(docs.length).to.be.equal(2);
				expect(docs.findIndex((x) => x._id === "1")).to.be.greaterThan(-1);
				expect(docs.findIndex((x) => x._id === "2")).to.be.greaterThan(-1);
			});
			it("Test signature", async () => {
				{
					// inserting single document
					const r = await db.insert([
						Employee.new({
							name: "Alex",
							age: 12,
							arr: [],
							male: true,
						}),
					]);
					expect(Object.keys(r).length).to.be.equal(2);
					expect(r.number).to.equal(1);
					expect(Array.isArray(r.docs)).to.equal(true);
					expect(r.docs.length).to.equal(1);
					// returning an id
					const doc = r.docs[0];
					expect(typeof doc._id).to.equal("string");
					expect(doc._id.split("-").length).to.be.greaterThan(1);
					// and other info
					expect(doc.name).to.be.equal("Alex");
					expect(doc.age).to.be.equal(12);
					expect(doc.male).to.be.equal(true);
					expect(doc.arr.length).to.be.equal(0);
				}
				{
					// inserting multiple documents
					const r = await db.insert([
						Employee.new({
							name: "Alex",
							age: 12,
							arr: [],
							male: true,
						}),
						Employee.new({
							name: "Dina",
							age: 11,
							arr: [],
							male: false,
						}),
					]);
					expect(Object.keys(r).length).to.be.equal(2);
					expect(r.number).to.equal(2);
					expect(Array.isArray(r.docs)).to.equal(true);
					expect(r.docs.length).to.equal(2);
					// returning an id
					const doc1 = r.docs.find((x) => x.name === "Alex")!;
					expect(typeof doc1._id).to.equal("string");
					expect(doc1._id.split("-").length).to.be.greaterThan(1);
					// and other info
					expect(doc1.name).to.be.equal("Alex");
					expect(doc1.age).to.be.equal(12);
					expect(doc1.male).to.be.equal(true);
					expect(doc1.arr.length).to.be.equal(0);

					const doc2 = r.docs.find((x) => x.name === "Dina")!;
					expect(typeof doc2._id).to.equal("string");
					expect(doc2._id.split("-").length).to.be.greaterThan(1);
					// and other info
					expect(doc2.name).to.be.equal("Dina");
					expect(doc2.age).to.be.equal(11);
					expect(doc2.male).to.be.equal(false);
					expect(doc2.arr.length).to.be.equal(0);
				}
			});
			it("Modeling", async () => {
				const res = await db.insert([Employee.new({ male: false })]);
				const doc = res.docs[0];
				expect(doc.isFemale()).to.be.eq(true);
				expect(doc.female).to.be.eq(true);
			});
		});

		describe("Read", () => {
			beforeEach(async () => {
				await db.insert([
					Employee.new({ name: "a", age: 1, arr: [], male: true }),
					Employee.new({ name: "b", age: 2, arr: [], male: false }),
					Employee.new({ name: "c", age: 3, arr: [], male: true }),
					Employee.new({
						name: "d",
						age: 4,
						arr: [],
						male: false,
						d: { a: { x: 10 } },
					}),
					Employee.new({
						name: "e",
						age: 5,
						arr: [],
						male: true,
						d: { a: { x: 20 } },
					}),
				]);
			});
			it("Basic filter", async () => {
				{
					const res = await db.read({ name: "a" });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("a");
					expect(res[0].age).to.be.eq(1);
					expect(res[0].male).to.be.eq(true);
				}
				{
					const res = await db.read({ name: "b" });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("b");
					expect(res[0].age).to.be.eq(2);
					expect(res[0].male).to.be.eq(false);
				}
				{
					const res = await db.read(
						{
							age: {
								$lt: 3,
							},
						},
						{
							sort: {
								age: 1,
							},
						}
					);
					expect(res.length).to.be.eq(2);
					const doc1 = res.find((x) => x.name === "a")!;
					const doc2 = res.find((x) => x.name === "b")!;
					expect(doc1.name).to.be.eq("a");
					expect(doc1.age).to.be.eq(1);
					expect(doc1.male).to.be.eq(true);
					expect(doc2.name).to.be.eq("b");
					expect(doc2.age).to.be.eq(2);
					expect(doc2.male).to.be.eq(false);
				}
			});
			it("Deep filter", async () => {
				{
					const res = await db.read({ $deep: { "d.a.x": { $eq: 10 } } });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("d");
					expect(res[0].age).to.be.eq(4);
					expect(res[0].male).to.be.eq(false);
				}
				{
					const res = await db.read({ $deep: { "d.a.x": { $eq: 20 } } });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("e");
					expect(res[0].age).to.be.eq(5);
					expect(res[0].male).to.be.eq(true);
				}
				{
					const res = await db.read({
						$deep: {
							"d.a.x": { $lt: 20 },
						},
					});
					expect(res.length).to.be.eq(1);
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("d");
					expect(res[0].age).to.be.eq(4);
					expect(res[0].male).to.be.eq(false);
				}
			});
			it("with no filter", async () => {
				const res = await db.find({});
				expect(res.length).to.be.eq(5);
				expect(res.findIndex((x) => x.age === 1)).to.be.greaterThan(-1);
				expect(res.findIndex((x) => x.age === 2)).to.be.greaterThan(-1);
				expect(res.findIndex((x) => x.age === 3)).to.be.greaterThan(-1);
				expect(res.findIndex((x) => x.age === 4)).to.be.greaterThan(-1);
				expect(res.findIndex((x) => x.age === 5)).to.be.greaterThan(-1);
			});
			it("limiting", async () => {
				const res = await db.find({}, { limit: 3 });
				expect(res.length).to.be.eq(3);
			});
			it("skipping", async () => {
				const res = await db.find({}, { skip: 3 });
				expect(res.length).to.be.eq(2);
			});
			it("projecting", async () => {
				const res = await db.find({ name: "a" }, { project: { _id: 0, male: 1 } });
				expect(res[0]).to.be.deep.equal({ male: true });
			});
			it("deep projecting", async () => {
				const res = await db.find({ name: "e" }, { project: { _id: 0, $deep: { "d.a.x": 1 } } });
				expect(res[0]).to.be.deep.equal({ d: { a: { x: 20 } } });
			});
			it("sorting", async () => {
				{
					const res1 = await db.find({}, { sort: { male: 1 } });
					expect(res1[0].male).to.be.eq(false);
					expect(res1[1].male).to.be.eq(false);
					expect(res1[2].male).to.be.eq(true);
					expect(res1[3].male).to.be.eq(true);
					expect(res1[4].male).to.be.eq(true);
				}
				{
					const res2 = await db.find({}, { sort: { male: -1 } });
					expect(res2[0].male).to.be.eq(true);
					expect(res2[1].male).to.be.eq(true);
					expect(res2[2].male).to.be.eq(true);
					expect(res2[3].male).to.be.eq(false);
					expect(res2[4].male).to.be.eq(false);
				}
			});
			it("deep sorting", async () => {
				const res1 = await db.find({}, { sort: { $deep: { "d.a.x": 1 } } });
				expect(res1[res1.length - 1].d?.a.x).to.be.equal(20);
				expect(res1[res1.length - 2].d?.a.x).to.be.equal(10);

				const res2 = await db.find({}, { sort: { $deep: { "d.a.x": -1 } } });
				expect(res2[0].d?.a.x).to.be.equal(20);
				expect(res2[1].d?.a.x).to.be.equal(10);
			});
			describe("Modeling", () => {
				it("Is in fact an instance of the model", async () => {
					const res = await db.find({});
					expect(res[0] instanceof Employee).to.be.equal(true);
				});
				it("Methods exists", async () => {
					const res = await db.find({});
					const doc = res[0];
					expect(typeof doc.isFemale).to.be.eq("function");
				});
				it("filter by getter", async () => {
					const res = await db.find({ female: true });
					expect(res.length).to.be.eq(2);
					expect(res.findIndex((x) => x.name === "b")).to.be.greaterThan(-1);
					expect(res.findIndex((x) => x.name === "d")).to.be.greaterThan(-1);
				});
				it("sort by getter", async () => {
					{
						const res1 = await db.find({}, { sort: { female: -1 } });
						expect(res1[0].male).to.be.eq(false);
						expect(res1[1].male).to.be.eq(false);
						expect(res1[2].male).to.be.eq(true);
						expect(res1[3].male).to.be.eq(true);
						expect(res1[4].male).to.be.eq(true);
					}
					{
						const res2 = await db.find({}, { sort: { female: 1 } });
						expect(res2[0].male).to.be.eq(true);
						expect(res2[1].male).to.be.eq(true);
						expect(res2[2].male).to.be.eq(true);
						expect(res2[3].male).to.be.eq(false);
						expect(res2[4].male).to.be.eq(false);
					}
				});
				it("projecting a getter", async () => {
					const res = await db.find(
						{ name: "a" },
						{
							project: { _id: 0, female: 1 },
						}
					);
					expect(res[0]).to.be.deep.equal({ female: false });
				});
				it("run function", async () => {
					const doc = (await db.find({ female: true }))[0];
					expect(doc.isFemale()).to.be.eq(true);
				});
			});
		});

		describe("Update", () => {
			beforeEach(async () => {
				await db.insert([
					Employee.new({
						name: "alex",
						age: 28,
						arr: [],
						male: true,
						d: { a: { x: 0 } },
					}),
					Employee.new({
						name: "dina",
						age: 27,
						arr: [],
						male: false,
						d: { a: { x: -1 } },
					}),
				]);
			});
			it("Basic filter", async () => {
				await db.update({ age: 28 }, { $set: { name: "aly" } });
				const afterUpdate = await db.find({ age: 28 });
				expect(afterUpdate.length).to.be.eq(1);
				expect(afterUpdate[0].name).to.be.eq("aly");
			});
			it("Deep filter", async () => {
				await db.update({ $deep: { "d.a.x": { $eq: 0 } } }, { $set: { name: "name2" } });
				const afterUpdate = await db.find({ age: 28 });
				expect(afterUpdate.length).to.be.eq(1);
				expect(afterUpdate[0].name).to.be.eq("name2");
			});
			it("with no filter", async () => {
				await db.update({}, { $set: { name: "all" } });
				const afterUpdate = await db.find({ name: "all" });
				expect(afterUpdate.length).to.be.eq(1);
			});
			it("Multi update", async () => {
				await db.update({}, { $set: { name: "all" } }, true);
				const afterUpdate = await db.find({ name: "all" });
				expect(afterUpdate.length).to.be.eq(2);
			});
			it("Test signature & modeling", async () => {
				{
					const res = await db.update({}, { $set: { male: true } }, true);
					expect(res.number).eq(2);
					expect(res.docs.length).eq(2);
					expect(res.docs[0].female).eq(false);
					expect(res.docs[0].isFemale()).eq(false);
					expect(res.docs[1].female).eq(false);
					expect(res.docs[1].isFemale()).eq(false);
				}
				{
					const res = await db.update({ female: false }, { $set: { male: false } }, true);
					expect(res.number).eq(2);
					expect(res.docs.length).eq(2);
					expect(res.docs[0].female).eq(true);
					expect(res.docs[0].isFemale()).eq(true);
					expect(res.docs[1].female).eq(true);
					expect(res.docs[1].isFemale()).eq(true);
				}
			});
		});

		describe("Upserting", () => {
			beforeEach(async () => {
				await db.insert([
					Employee.new({
						name: "alex",
						age: 27,
						arr: [],
						male: true,
						d: { a: { x: 0 } },
					}),
				]);
			});
			it("When the document is found", async () => {
				const res = await db.upsert(
					{ name: "alex" },
					{ $set: { name: "aly" }, $setOnInsert: Employee.new({ name: "aly" }) }
				);
				expect(res.upsert).eq(false);
				expect(res.number).eq(1);
				expect(res.docs.length).eq(1);
				expect(res.docs[0].name).eq("aly");
				const find = await db.find({ name: "aly" });
				expect(find.length).eq(1);
				expect(find[0].age).eq(27);
				const findAll = await db.find({});
				expect(findAll.length).eq(1); // no insertion occurred
			});
			it("When the document is not found", async () => {
				const res = await db.upsert(
					{ name: "david" },
					{ $set: { name: "aly" }, $setOnInsert: Employee.new({ name: "aly", age: 19 }) }
				);
				expect(res.upsert).eq(true);
				expect(res.number).eq(1);
				expect(res.docs.length).eq(1);
				expect(res.docs[0].name).eq("aly");
				const find = await db.find({ name: "aly" });
				expect(find.length).eq(1);
				expect(find[0].age).eq(19);
				const findAll = await db.find({});
				expect(findAll.length).eq(2); // insertion of a new document occurred
			});
		});

		describe("Counting", () => {
			beforeEach(async () => {
				await db.insert([
					Employee.new({
						name: "alex",
						age: 1,
						arr: [],
						male: true,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "dina",
						age: 2,
						arr: [],
						male: false,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "david",
						age: 2,
						arr: [],
						male: false,
						d: { a: { x: 0 } },
					}),
				]);
			});
			it("Basic filter", async () => {
				expect(await db.count({ age: 1 })).eq(1);
				expect(await db.count({ age: 2 })).eq(2);
			});
			it("Deep filter", async () => {
				expect(await db.count({ $deep: { "d.a.x": { $eq: 0 } } })).eq(1);
				expect(await db.count({ $deep: { "d.a.x": { $eq: 1 } } })).eq(2);
			});
			it("with no filter", async () => {
				expect(await db.count()).eq(3);
				expect(await db.count({})).eq(3);
			});
		});

		describe("Delete", () => {
			beforeEach(async () => {
				await db.insert([
					Employee.new({
						name: "alex",
						age: 1,
						arr: [],
						male: true,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "dina",
						age: 2,
						arr: [],
						male: false,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "david",
						age: 2,
						arr: [],
						male: true,
						d: { a: { x: 0 } },
					}),
				]);
			});
			it("Basic filter", async () => {
				const res = await db.delete({ female: true });
				expect(res.number).eq(1);
				expect(res.docs[0].name).eq("dina");
				expect(res.docs[0].female).eq(true);
				expect(res.docs[0].isFemale()).eq(true);
				expect(await db.count({ female: true })).eq(0);
				expect(await db.count({ male: false })).eq(0);
				expect(await db.count({ name: "dina" })).eq(0);
			});
			it("Deep filter", async () => {
				const res = await db.delete({ $deep: { "d.a.x": { $eq: 1 } } });
				expect(res.number).eq(1);
				expect(await db.count({ $deep: { "d.a.x": { $eq: 1 } } })).eq(
					1 // one is left, since this is not a multi delete
				);
				expect(await db.count()).eq(2);
			});
			it("with no filter", async () => {
				const res = await db.delete({});
				expect(res.number).eq(1);
				expect(await db.count()).eq(2);
			});
			it("multi delete", async () => {
				const res = await db.delete({ $deep: { "d.a.x": { $eq: 1 } } }, true);
				expect(res.number).eq(2);
				expect(await db.count({ $deep: { "d.a.x": { $eq: 1 } } })).eq(
					0 // no one is left, since this is a multi delete
				);
				expect(await db.count()).eq(1);
			});
		});
	});
});
