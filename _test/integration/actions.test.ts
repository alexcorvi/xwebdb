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

class Toy extends xwebdb.SubDoc {
	name: string = "";
	price: number = 0;
	undef: number;
	date: Date = new Date(0);
	get priceInUSD() {
		return this.price * 1.4;
	}
}

class Child extends xwebdb.SubDoc {
	fullName: string;
	age: number = 0;
	born: Date = new Date("2022");
	toys: Toy[] = xwebdb.mapSubModel(Toy, []);
	favoriteToy: Toy = xwebdb.mapSubModel(Toy, Toy.new({}));
	get numberOfToys() {
		return this.toys.length;
	}
}

class Employee extends Doc {
	name: string = "";
	age: number = 9;
	male: boolean = false;
	sArr: string[] = [];
	noDefault: number;
	mainChild: Child = xwebdb.mapSubModel(Child, Child.new({}));
	children: Child[] = xwebdb.mapSubModel(Child, []);
	d: {
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

class Simple extends Doc {
	a: number = 1;
}

describe("Actions", async () => {
	describe("Connection", () => {
		it("Connection with an object param", (done) => {
			const db = new Database<Simple>({ ref: "testdatabase", model: Simple });
			db.loaded
				.then(() => done())
				.catch((e) => {
					throw e;
				});
		});
		it("Connection with an already created DB", (done) => {
			const db1 = new Database({ ref: "testdatabase", model: Simple });
			const db2 = new Database({ ref: "testdatabase", model: Simple });
			Promise.all([db1.loaded, db2.loaded])
				.then(() => done())
				.catch((e) => {
					throw e;
				});
		});

		it("Deferred indexedDB actions", async function () {
			let ddb = new Database<Employee>({
				ref: "deferred",
				deferPersistence: 10,
			});
			const wait = (i: number) => new Promise((resolve) => setTimeout(resolve, i));
			await ddb._datastore.persistence.data.clear();
			let docs: Employee[] = [];
			let i = 10;
			while (i--) docs.push(Employee.new({}));

			await ddb.insert(docs);
			(await ddb._datastore.persistence.data.keys()).length.should.eq(0);
			await wait(11);
			(await ddb._datastore.persistence.data.keys()).length.should.eq(docs.length);

			await ddb.delete({}, true);
			(await ddb._datastore.persistence.data.keys()).length.should.eq(docs.length);
			await wait(11);
			(await ddb._datastore.persistence.data.keys()).length.should.eq(0);
		});

		it("Defining indexes on initialization", async () => {
			let db = new Database<Employee>({ ref: "testdatabase", indexes: ["age", "female", "male"] });
			await db.loaded;
			const indexes = Object.keys(db._datastore.indexes);
			indexes.length.should.eq(4);
			indexes.should.include("_id");
			indexes.should.include("age");
			indexes.should.include("female");
			indexes.should.include("male");
		});
	});

	describe("Operations", async () => {
		let dbName = testDb;

		let db = new Database<Employee>({
			ref: dbName,
			model: Employee,
		});

		beforeEach(async () => {
			await db.remove({}, true);
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
						children: [],
						male: true,
					}),
				]);
				const docs = await db.read({});
				expect(docs.length).to.be.equal(1);
				const doc = docs[0];
				expect(doc.name).to.be.equal("Alex");
				expect(doc.age).to.be.equal(12);
				expect(doc.male).to.be.equal(true);
				expect(doc.children.length).to.be.equal(0);
			});
			it("Creating while giving an ID", async () => {
				await db.insert([
					Employee.new({
						_id: "1234",
						name: "Alex",
						age: 12,
						children: [],
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
						children: [],
						male: true,
					}),
					Employee.new({
						_id: "2",
						name: "Dina",
						age: 1,
						children: [],
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
							children: [],
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
					expect(doc.children.length).to.be.equal(0);
				}
				{
					// inserting multiple documents
					const r = await db.insert([
						Employee.new({
							name: "Alex",
							age: 12,
							children: [],
							male: true,
						}),
						Employee.new({
							name: "Dina",
							age: 11,
							children: [],
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
					expect(doc1.children.length).to.be.equal(0);

					const doc2 = r.docs.find((x) => x.name === "Dina")!;
					expect(typeof doc2._id).to.equal("string");
					expect(doc2._id.split("-").length).to.be.greaterThan(1);
					// and other info
					expect(doc2.name).to.be.equal("Dina");
					expect(doc2.age).to.be.equal(11);
					expect(doc2.male).to.be.equal(false);
					expect(doc2.children.length).to.be.equal(0);
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
					Employee.new({ name: "a", age: 1, children: [], male: true }),
					Employee.new({ name: "b", age: 2, children: [], male: false }),
					Employee.new({ name: "c", age: 3, children: [], male: true }),
					Employee.new({
						name: "d",
						age: 4,
						children: [],
						male: false,
						d: { a: { x: 10 } },
					}),
					Employee.new({
						name: "e",
						age: 5,
						children: [],
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
					const res = await db.read({ $deep: { d: { a: { x: { $eq: 10 } } } } });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("d");
					expect(res[0].age).to.be.eq(4);
					expect(res[0].male).to.be.eq(false);
				}
				{
					const res = await db.read({ $deep: { d: { a: { x: { $eq: 20 } } } } });
					expect(res.length).to.be.eq(1);
					expect(res[0].name).to.be.eq("e");
					expect(res[0].age).to.be.eq(5);
					expect(res[0].male).to.be.eq(true);
				}
				{
					const res = await db.read({
						$deep: {
							d: { a: { x: { $lt: 20 } } },
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
				const res = await db.find({ name: "e" }, { project: { _id: 0, $deep: { d: { a: { x: 1 } } } } });
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
				const res1 = await db.find({}, { sort: { $deep: { d: { a: { x: 1 } } } } });
				expect(res1[res1.length - 1].d?.a.x).to.be.equal(20);
				expect(res1[res1.length - 2].d?.a.x).to.be.equal(10);

				const res2 = await db.find({}, { sort: { $deep: { d: { a: { x: -1 } } } } });
				expect(res2[0].d?.a.x).to.be.equal(20);
				expect(res2[1].d?.a.x).to.be.equal(10);
			});
			it("aggregation", async () => {
				const agg = await db.aggregate();
				expect(
					agg
						.$group({
							_id: "female",
							reducer: (g) => ({
								gender: g[0].female ? "female" : "male",
								count: g.length,
							}),
						})
						.$sort({ count: 1 })
						.toArray()
				).to.deep.eq([
					{ gender: "female", count: 2 },
					{ gender: "male", count: 3 },
				]);
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
						children: [],
						male: true,
						d: { a: { x: 0 } },
					}),
					Employee.new({
						name: "dina",
						age: 27,
						children: [],
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
				await db.update({ $deep: { d: { a: { x: { $eq: 0 } } } } }, { $set: { name: "name2" } });
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
						children: [],
						male: true,
						d: { a: { x: 0 } },
					}),
				]);
			});
			it("When the document is found", async () => {
				const res = await db.upsert({ name: "alex" }, { $set: { name: "aly" }, $setOnInsert: Employee.new({ name: "aly" }) });
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
				const res = await db.upsert({ name: "david" }, { $set: { name: "aly" }, $setOnInsert: Employee.new({ name: "aly", age: 19 }) });
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
						children: [],
						male: true,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "dina",
						age: 2,
						children: [],
						male: false,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "david",
						age: 2,
						children: [],
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
				expect(await db.count({ $deep: { d: { a: { x: 0 } } } })).eq(1);
				expect(await db.count({ $deep: { d: { a: { x: 1 } } } })).eq(2);
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
						children: [],
						male: true,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "dina",
						age: 2,
						children: [],
						male: false,
						d: { a: { x: 1 } },
					}),
					Employee.new({
						name: "david",
						age: 2,
						children: [],
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
				const res = await db.delete({ $deep: { d: { a: { x: 1 } } } });
				expect(res.number).eq(1);
				expect(await db.count({ $deep: { d: { a: { x: 1 } } } })).eq(
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
				const res = await db.delete({ $deep: { d: { a: { x: 1 } } } }, true);
				expect(res.number).eq(2);
				expect(await db.count({ $deep: { d: { a: { x: 1 } } } })).eq(
					0 // no one is left, since this is a multi delete
				);
				expect(await db.count()).eq(1);
			});
		});
	});

	describe("Object mapping", () => {
		let dbName = testDb;

		let db = new Database<Employee>({
			ref: dbName,
			model: Employee,
		});

		beforeEach(async () => {
			await db.remove({}, true);
			await db.reload();
			(await db.count({})).should.equal(0);
			await db.insert(
				Employee.new({
					name: "Ali",
					male: true,
					mainChild: Child.new({
						fullName: "Keko",
					}),
					noDefault: 10,
					children: [
						Child.new({
							fullName: "Keko",
							toys: [
								Toy.new({
									name: "Batman",
									price: 2000,
								}),
								Toy.new({
									undef: 0,
								}),
							],
						}),
					],
				})
			);
		});
		afterEach(async () => {
			await db.delete({}, true);
		});

		it("main document maps correctly", async () => {
			const doc = (await db.find({}))[0];
			expect(doc instanceof Employee).eq(true);
		});

		it("child document maps correctly", async () => {
			const doc = (await db.find({}))[0];
			expect(doc.mainChild instanceof Child).eq(true);
		});
		it("child document maps correctly even in arrays", async () => {
			const doc = (await db.find({}))[0];
			expect(doc.children[0] instanceof Child).eq(true);
		});
		it("grand child document maps correctly even in arrays", async () => {
			const doc = (await db.find({}))[0];
			expect(doc.children[0] instanceof Child).eq(true);
		});
		it("Undefined values in new() get replaced by defaults", async () => {
			const doc = (await db.find({}))[0];
			doc.age.should.eq(9);
			doc.children[0].age.should.eq(0);
			doc.mainChild.age.should.eq(0);
		});
		it("Defined values in new() gets set correctly", async () => {
			const doc = (await db.find({}))[0];
			doc.name.should.eq("Ali");
			doc.mainChild.fullName.should.eq("Keko");
		});
		it("Using getters in query", async () => {
			await db.insert(
				Employee.new({
					name: "Dina",
					male: false,
				})
			);
			const docs = await db.find({ female: true });
			const doc = docs[0];
			docs.length.should.eq(1);
			doc.name.should.eq("Dina");
			doc.male.should.eq(false);

			const docs2 = await db.find({ female: false });
			const doc2 = docs2[0];
			docs2.length.should.eq(1);
			doc2.name.should.eq("Ali");
			doc2.male.should.eq(true);
		});

		it("Using getters in query (sub document)", async () => {
			await db.insert(
				Employee.new({
					name: "doc1",
					mainChild: {
						toys: [Toy.new({}), Toy.new({}), Toy.new({})],
					},
				})
			);
			await db.insert(
				Employee.new({
					name: "doc2",
					mainChild: {
						toys: [Toy.new({}), Toy.new({}), Toy.new({}), Toy.new({})],
					},
				})
			);

			const docs = await db.find({ $deep: { mainChild: { numberOfToys: 3 } } });
			const doc = docs[0];
			docs.length.should.eq(1);
			doc.name.should.eq("doc1");

			const docs2 = await db.find({ $deep: { mainChild: { numberOfToys: 4 } } });
			const doc2 = docs2[0];
			docs2.length.should.eq(1);
			doc2.name.should.eq("doc2");
		});

		it("values that do not have defaults in model takes it from passed data", async () => {
			const doc = (await db.find({ name: "Ali" }))[0];
			doc.noDefault.should.eq(10);
		});
		it("values that do not have defaults in model takes it from passed data even if undefined", async () => {
			const doc = (await db.find({ name: "Ali" }))[0];
			expect(doc.children[0].toys[0].undef).eq(undefined);
		});
		it("values that do not have defaults in model takes it from passed data even if 0", async () => {
			const doc = (await db.find({ name: "Ali" }))[0];
			doc.children[0].toys[1].undef.should.eq(0);
		});
		it("Setting getters throws", async () => {
			expect(() =>
				Employee.new({
					name: "sg1",
					female: false,
				} as any)
			).to.throw();
		});

		describe("Stripping default values", () => {
			let empty = {};
			let primitive = {
				age: 17,
				noDefault: 8,
			};
			let nonPrimitive = {
				d: {
					a: {
						x: 7,
					},
				},
				sArr: ["a", "b"],
			};
			let nonStandard = {
				d: {
					a: {
						x: 7,
						y: 8,
					},
				},
				sArr: 10,
			} as any;
			let dateObj = {
				mainChild: Child.new({ born: new Date(1959) })._stripDefaults!(),
			};
			let primitiveSubDoc = {
				mainChild: Child.new({ fullName: "Alex" })._stripDefaults!(),
			};
			let nonPrimitiveSubDoc = {
				mainChild: Child.new({ favoriteToy: { name: "batman" } })._stripDefaults!(),
			};
			let complexSubDoc = {
				mainChild: Child.new({ favoriteToy: { undef: 7 }, toys: [] })._stripDefaults!(),
			};
			let complexSubDoc2 = {
				mainChild: Child.new({ favoriteToy: { undef: 7 }, toys: [Toy.new({ price: 17 })] })._stripDefaults!(),
			};
			let subDocsArr = {
				children: [
					Child.new({ fullName: "timmy" })._stripDefaults!(),
					Child.new({ fullName: "billy", age: 19, born: new Date(1992) })._stripDefaults!(),
					Child.new({ favoriteToy: { name: "batman" } })._stripDefaults!(),
					Child.new({ toys: [Toy.new({ name: "xbox", date: new Date(2005) })._stripDefaults!(), Toy.new({ price: 109 })._stripDefaults!()] })._stripDefaults!(),
				],
			};
			function strippedButSound(model: Employee) {
				return JSON.stringify(model) === JSON.stringify(Employee.new(model._stripDefaults!()));
			}
			it("Empty initialization", () => {
				let employee = Employee.new(empty);
				let s = employee._stripDefaults!();
				Object.keys(s).length.should.eq(1);
				Object.keys(s)[0].should.eq("_id");
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(empty);
			});
			it("Primitive initialization", () => {
				let employee = Employee.new(primitive);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(primitive);
			});
			it("non-primitive initialization", () => {
				let employee = Employee.new(nonPrimitive);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(nonPrimitive);
			});
			it("non-standard initialization", () => {
				let employee = Employee.new(nonStandard);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(nonStandard);
			});
			it("primitive SubDoc initialization", () => {
				let employee = Employee.new(primitiveSubDoc);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(primitiveSubDoc);
			});
			it("SubDoc with date object initialization", () => {
				let employee = Employee.new(dateObj);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(dateObj);
			});
			it("non primitive SubDoc initialization", () => {
				let employee = Employee.new(nonPrimitiveSubDoc);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(nonPrimitiveSubDoc);
			});
			it("complex SubDoc initialization", () => {
				let employee = Employee.new(complexSubDoc);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(complexSubDoc);
			});
			it("complex SubDoc initialization", () => {
				let employee = Employee.new(complexSubDoc2);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(complexSubDoc2);
			});
			it("SubDoc array initialization", () => {
				let employee = Employee.new(subDocsArr);
				let s = employee._stripDefaults!();
				strippedButSound(employee).should.eq(true);
				delete (s as any)._id;
				s.should.deep.eq(subDocsArr);
			});
		});
	});

	describe("More on $deep", () => {
		let dbName = testDb;

		let db = new Database<Employee>({
			ref: dbName,
			model: Employee,
		});

		beforeEach(async () => {
			await db.remove({}, true);
			await db.reload();
			(await db.count({})).should.equal(0);
			await db.insert(
				Employee.new({
					name: "Ali",
					male: true,
					mainChild: Child.new({
						fullName: "Keko",
						age: 2,
					}),
					noDefault: 10,
					children: [
						Child.new({
							fullName: "Alih",
							toys: [
								Toy.new({
									name: "Batman",
									price: 1,
								}),
								Toy.new({
									undef: 0,
								}),
							],
						}),
					],
				})
			);
			await db.insert(
				Employee.new({
					name: "Dina",
					male: false,
					mainChild: Child.new({
						fullName: "Siko",
						age: -0.3,
					}),
					noDefault: 10,
					children: [
						Child.new({
							fullName: "Dinah",
							toys: [
								Toy.new({
									name: "Barby",
									price: 3,
								}),
								Toy.new({
									undef: 0,
								}),
							],
						}),
					],
				})
			);
		});

		it("Query: flat", async () => {
			const doc = (await db.find({ $deep: { female: true } }))[0];
			doc.name.should.eq("Dina");

			{
				const doc = (await db.find({ $deep: { name: "Dina" } }))[0];
				doc.female.should.eq(true);
			}
		});
		it("Query: bit deeper", async () => {
			const doc = (await db.find({ $deep: { mainChild: { fullName: "Keko" } } }))[0];
			doc.name.should.eq("Ali");
		});
		it("Query: array elements", async () => {
			const d1 = (await db.find({ $deep: { children: { 0: { fullName: "Dinah" } } } }))[0];
			const d2 = (await db.find({ $deep: { children: { 0: { toys: { 0: { price: 3 } } } } } }))[0];
			const a1 = (await db.find({ $deep: { children: { 0: { fullName: "Alih" } } } }))[0];
			const a2 = (await db.find({ $deep: { children: { 0: { toys: { 0: { price: 1 } } } } } }))[0];
			d1.name.should.eq("Dina");
			d2.name.should.eq("Dina");
			a1.name.should.eq("Ali");
			a2.name.should.eq("Ali");
		});
		it("Query: multiple deeps", async () => {
			const d1 = (await db.find({ $deep: { children: { 0: { fullName: "Dinah", toys: { 0: { price: 3 } } } } } }))[0];
			const a1 = (await db.find({ $deep: { children: { 0: { fullName: "Alih", toys: { 0: { price: 1 } } } } } }))[0];
			d1.name.should.eq("Dina");
			a1.name.should.eq("Ali");
		});
		it("Query: mix deep with other queries", async () => {
			const d1 = (await db.find({ male: false, $deep: { children: { 0: { fullName: "Dinah" } } } }))[0];
			const d2 = (await db.find({ male: false, $deep: { children: { 0: { toys: { 0: { price: 3 } } } } } }))[0];
			const a1 = (await db.find({ female: false, $deep: { children: { 0: { fullName: "Alih" } } } }))[0];
			const a2 = (await db.find({ female: false, $deep: { children: { 0: { toys: { 0: { price: 1 } } } } } }))[0];
			d1.name.should.eq("Dina");
			d2.name.should.eq("Dina");
			a1.name.should.eq("Ali");
			a2.name.should.eq("Ali");
		});
		it("Query: using query operators", async () => {
			const d1 = (await db.find({ male: false, $deep: { children: { 0: { fullName: { $in: ["Dinah"] } } } } }))[0];
			const d2 = (await db.find({ male: false, $deep: { children: { 0: { toys: { 0: { price: { $lte: 3 } } } } } } }))[0];
			const a1 = (await db.find({ female: false, $deep: { children: { 0: { fullName: { $in: ["Alih"] } } } } }))[0];
			const a2 = (await db.find({ female: false, $deep: { children: { 0: { toys: { 0: { price: { $lte: 1 } } } } } } }))[0];
			d1.name.should.eq("Dina");
			d2.name.should.eq("Dina");
			a1.name.should.eq("Ali");
			a2.name.should.eq("Ali");
		});
		it("Query: using exact array match", async () => {
			const d2 = (
				await db.find({
					male: false,
					$deep: { children: { 0: { toys: [Toy.new({ name: "Barby", price: 3 }), Toy.new({ undef: 0 })] } } },
				})
			)[0];
			const a2 = (
				await db.find({
					female: false,
					$deep: {
						children: { 0: { toys: [Toy.new({ name: "Batman", price: 1 }), Toy.new({ undef: 0 })] } },
					},
				})
			)[0];
			d2.name.should.eq("Dina");
			a2.name.should.eq("Ali");
		});
		it("Update: Set", async () => {
			await db.update({ name: "Ali" }, { $set: { $deep: { mainChild: { age: 99 } } } });
			const res = await db.find({ name: "Ali" });
			res.length.should.eq(1);
			res[0].mainChild.age.should.eq(99);
		});
		it("Update: Set on array element", async () => {
			await db.update({ name: "Ali" }, { $set: { $deep: { children: { 0: { toys: { 0: { price: 70 } } } } } } });
			const res = await db.find({ name: "Ali" });
			res.length.should.eq(1);
			res[0].children[0].toys[0].price.should.eq(70);
		});
		it("Update: unSet", async () => {
			await db.update({ name: "Ali" }, { $unset: { $deep: { mainChild: { age: "" } } } });
			const res = await db.find({ name: "Ali" });
			res.length.should.eq(1);
			expect(res[0].mainChild.age).eq(0);
		});
		it("Update: unSet on array element", async () => {
			await db.update({ name: "Ali" }, { $unset: { $deep: { children: { 0: { toys: { 0: { price: "" } } } } } } });
			const res = await db.find({ name: "Ali" });
			res.length.should.eq(1);
			expect(res[0].children[0].toys[0].price).eq(0);
		});
		it("Update: $unset on array index", async () => {
			await db.insert(Employee.new({ _id: "x", mainChild: { toys: [Toy.new({ name: "A" }), Toy.new({ name: "B" })] } }));
			await db.update({ _id: "x" }, { $unset: { $deep: { mainChild: { toys: { 0: "" } } } } });
			const toys = (await db.find({ _id: "x" }))[0].mainChild.toys;
			toys.length.should.eq(1);
			toys[0].name.should.eq("B");
			await db.reload();
			{
				const toys = (await db.find({ _id: "x" }))[0].mainChild.toys;
				toys.length.should.eq(1);
				toys[0].name.should.eq("B");
			}
		});
		it("Update: min number", async () => {
			await db.update({ name: "Ali" }, { $min: { $deep: { children: { 0: { toys: { 0: { price: -500 } } } } } } });
			await db.update({ name: "Dina" }, { $min: { $deep: { children: { 0: { toys: { 0: { price: 500 } } } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].toys[0].price).eq(-500);
			expect((await db.find({ name: "Dina" }))[0].children[0].toys[0].price).not.eq(500);
		});
		it("Update: max number", async () => {
			await db.update({ name: "Ali" }, { $max: { $deep: { children: { 0: { toys: { 0: { price: -500 } } } } } } });
			await db.update({ name: "Dina" }, { $max: { $deep: { children: { 0: { toys: { 0: { price: 500 } } } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].toys[0].price).not.eq(-500);
			expect((await db.find({ name: "Dina" }))[0].children[0].toys[0].price).eq(500);
		});
		it("Update: min date", async () => {
			await db.update({ name: "Ali" }, { $min: { $deep: { children: { 0: { born: new Date("1992") } } } } });
			await db.update({ name: "Dina" }, { $min: { $deep: { children: { 0: { born: new Date("2023") } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].born).deep.eq(new Date("1992"));
			expect((await db.find({ name: "Dina" }))[0].children[0].born).not.deep.eq(new Date("2023"));
		});
		it("Update: max date", async () => {
			await db.update({ name: "Ali" }, { $max: { $deep: { children: { 0: { born: new Date("1992") } } } } });
			await db.update({ name: "Dina" }, { $max: { $deep: { children: { 0: { born: new Date("2023") } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].born).not.deep.eq(new Date("1992"));
			expect((await db.find({ name: "Dina" }))[0].children[0].born).deep.eq(new Date("2023"));
		});
		it("Update: current date (timestamp)", async () => {
			await db.update({ name: "Ali" }, { $currentDate: { $deep: { children: { 0: { age: { $type: "timestamp" } } } } } });
			await db.update({ name: "Dina" }, { $currentDate: { $deep: { children: { 0: { favoriteToy: { price: { $type: "timestamp" } } } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].age).gt(new Date("2023").getTime());
			expect((await db.find({ name: "Dina" }))[0].children[0].favoriteToy.price).gt(new Date("2023").getTime());
		});
		it("Update: current date (date object)", async () => {
			await db.update({ name: "Ali" }, { $currentDate: { $deep: { children: { 0: { born: { $type: "date" } } } } } });
			await db.update({ name: "Dina" }, { $currentDate: { $deep: { children: { 0: { favoriteToy: { date: { $type: "date" } } } } } } });
			expect((await db.find({ name: "Ali" }))[0].children[0].born).gt(new Date("2023"));
			expect((await db.find({ name: "Dina" }))[0].children[0].favoriteToy.date).gt(new Date("2023"));
		});
		it("Update: inc array object value & sub-document", async () => {
			await db.insert(Employee.new({ _id: "x", mainChild: { age: 2 } }));
			await db.insert(Employee.new({ _id: "y", children: [Child.new({ toys: [Toy.new({ price: 2 })] })] }));
			await db.update({ _id: "x" }, { $inc: { $deep: { mainChild: { age: 10 } } } });
			await db.update({ _id: "y" }, { $inc: { $deep: { children: { 0: { toys: { 0: { price: 10 } } } } } } });
			expect((await db.find({ _id: "x" }))[0].mainChild.age).eq(12);
			expect((await db.find({ _id: "y" }))[0].children[0].toys[0].price).eq(12);
		});
		it("Update: mul array object value & sub-document", async () => {
			await db.insert(Employee.new({ _id: "x", mainChild: { age: 2 } }));
			await db.insert(Employee.new({ _id: "y", children: [Child.new({ toys: [Toy.new({ price: 2 })] })] }));
			await db.update({ _id: "x" }, { $mul: { $deep: { mainChild: { age: 10 } } } });
			await db.update({ _id: "y" }, { $mul: { $deep: { children: { 0: { toys: { 0: { price: 10 } } } } } } });
			expect((await db.find({ _id: "x" }))[0].mainChild.age).eq(20);
			expect((await db.find({ _id: "y" }))[0].children[0].toys[0].price).eq(20);
		});
		it("Update: rename deep object property", async () => {
			await db.insert(Employee.new({ _id: "x", mainChild: { age: 2 } }));
			await db.update({ _id: "x" }, { $rename: { $deep: { mainChild: { age: "Age" } } } });
			await db.insert(Employee.new({ _id: "y", children: [Child.new({ toys: [Toy.new({ price: 2 })] })] }));
			await db.update({ _id: "y" }, { $rename: { $deep: { children: { 0: { toys: { 0: { price: "Price" } } } } } } });

			expect((await db.find({ _id: "x" }))[0].mainChild.age).eq(0); // replaced by default
			expect(((await db.find({ _id: "x" }))[0].mainChild as any).Age).eq(2);
			expect((await db.find({ _id: "y" }))[0].children[0].toys[0].price).eq(0); // replaced by default
			expect(((await db.find({ _id: "y" }))[0].children[0].toys[0] as any).Price).eq(2);
		});
		it("Update: $rename array index should be possible", async () => {
			await db.insert(Employee.new({ _id: "x", mainChild: { toys: [Toy.new({ name: "A" }), Toy.new({ name: "B" }), Toy.new({ name: "C" })] } }));
			await db.update({ _id: "x" }, { $rename: { $deep: { mainChild: { toys: { 0: "2" } } } } });
			const toys = (await db.find({ _id: "x" }))[0].mainChild.toys;
			toys[0].name.should.eq("B");
			toys[1].name.should.eq("C");
			toys[2].name.should.eq("A");
			{
				await db.reload();
				const toys = (await db.find({ _id: "x" }))[0].mainChild.toys;
				toys[0].name.should.eq("B");
				toys[1].name.should.eq("C");
				toys[2].name.should.eq("A");
			}
		});
		describe("$deep update with array operators", () => {
			beforeEach(async () => {
				await db.delete({}, true);
				await db.insert(Employee.new({ _id: "a", mainChild: Child.new({}), children: [Child.new({})] }));
				expect((await db.find({ _id: "a" }))[0].mainChild.toys.length).eq(0);
				expect((await db.find({ _id: "a" }))[0].children[0].toys.length).eq(0);
			});
			it("Update: array operators $addToSet with $each", async () => {
				await db.update({ _id: "a" }, { $addToSet: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "abc", price: 99 })] } } } } });
				expect((await db.find({ _id: "a" }))[0].mainChild.toys.length).eq(1);
				expect((await db.find({ _id: "a" }))[0].mainChild.toys[0].name).eq("abc");
				expect((await db.find({ _id: "a" }))[0].mainChild.toys[0].priceInUSD).eq(99 * 1.4);
			});
			it("Update: array operators $addToSet with $each (deeper)", async () => {
				await db.update({ _id: "a" }, { $addToSet: { $deep: { children: { 0: { toys: { $each: [Toy.new({ name: "abc", price: 99 })] } } } } } });
				expect((await db.find({ _id: "a" }))[0].children[0].toys.length).eq(1);
				expect((await db.find({ _id: "a" }))[0].children[0].toys[0].name).eq("abc");
				expect((await db.find({ _id: "a" }))[0].children[0].toys[0].priceInUSD).eq(99 * 1.4);
			});
			it("Update: array operators $pop", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } }
				);
				await db.update({ _id: "a" }, { $pop: { $deep: { mainChild: { toys: -1 } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys1.length).eq(2);
				expect(toys1[0].name).eq("y");
				expect(toys1[1].name).eq("z");
				await db.update({ _id: "a" }, { $pop: { $deep: { mainChild: { toys: 1 } } } });
				const toys2 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys2.length).eq(1);
				expect(toys2[0].name).eq("y");
			});
			it("Update: array operators $pop (deeper)", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { children: { 0: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } } }
				);
				await db.update({ _id: "a" }, { $pop: { $deep: { children: { 0: { toys: -1 } } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].children[0].toys;
				expect(toys1.length).eq(2);
				expect(toys1[0].name).eq("y");
				expect(toys1[1].name).eq("z");
				await db.update({ _id: "a" }, { $pop: { $deep: { children: { 0: { toys: 1 } } } } });
				const toys2 = (await db.find({ _id: "a" }))[0].children[0].toys;
				expect(toys2.length).eq(1);
				expect(toys2[0].name).eq("y");
			});
			it("Update: array operators $pull", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } }
				);
				await db.update({ _id: "a" }, { $pull: { $deep: { mainChild: { toys: { $eq: Toy.new({ name: "x" }) } } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys1.length).eq(2);
				expect(toys1[0].name).eq("y");
				expect(toys1[1].name).eq("z");
				await db.update({ _id: "a" }, { $pull: { $deep: { mainChild: { toys: { $eq: Toy.new({ name: "z" }) } } } } });
				const toys2 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys2.length).eq(1);
				expect(toys2[0].name).eq("y");
			});
			it("Update: array operators $pull (deeper)", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { children: { 0: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } } }
				);
				await db.update({ _id: "a" }, { $pull: { $deep: { children: { 0: { toys: { $eq: Toy.new({ name: "x" }) } } } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].children[0].toys;
				expect(toys1.length).eq(2);
				expect(toys1[0].name).eq("y");
				expect(toys1[1].name).eq("z");
				await db.update({ _id: "a" }, { $pull: { $deep: { children: { 0: { toys: { $eq: Toy.new({ name: "z" }) } } } } } });
				const toys2 = (await db.find({ _id: "a" }))[0].children[0].toys;
				expect(toys2.length).eq(1);
				expect(toys2[0].name).eq("y");
			});
			it("Update: array operators with $logical operators", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } }
				);
				await db.update({ _id: "a" }, { $pull: { $deep: { mainChild: { toys: { $or: [{ name: "x" }, { name: "z" }] } } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys1.length).eq(1);
				expect(toys1[0].name).eq("y");
			});
			it("Update: array operators $pullAll", async () => {
				await db.update(
					{ _id: "a" },
					{ $addToSet: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })] } } } } }
				);
				await db.update({ _id: "a" }, { $pullAll: { $deep: { mainChild: { toys: [{ $eq: Toy.new({ name: "x" }) }, { $eq: Toy.new({ name: "z" }) }] } } } });
				const toys1 = (await db.find({ _id: "a" }))[0].mainChild.toys;
				expect(toys1.length).eq(1);
				expect(toys1[0].name).eq("y");
			});
			it("Update: array operators $push", async () => {
				await db.update(
					{ _id: "a" },
					{ $push: { $deep: { mainChild: { toys: { $each: [Toy.new({ name: "x" }), Toy.new({ name: "y" }), Toy.new({ name: "z" })], $sort: { name: -1 } } } } } }
				);
				const toys = (await db.find({ _id: "a" }))[0].mainChild.toys;
				toys.length.should.eq(3);
				toys[0].name.should.eq("z");
				toys[1].name.should.eq("y");
				toys[2].name.should.eq("x");
			});
		});
	});
});
