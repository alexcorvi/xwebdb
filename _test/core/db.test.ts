/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../node_modules/@types/underscore/index.d.ts" />

import xwebdb from "../../dist/xwebdb.js";
import underscore from "../../node_modules/underscore/underscore.js";

const _: any = underscore;
const { Datastore, modelling: model } = xwebdb._internal;

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

const reloadTimeUpperBound = 80; // In ms, an upper bound for the reload time used to check createdAt and updatedAt
describe("Database", function () {
	let d: InstanceType<typeof Datastore> & { insert: any } = new Datastore({
		ref: testDb,
	});
	beforeEach(async () => {
		d = new Datastore({
			ref: testDb,
		});
		d.ref.should.equal(testDb);
		await d.loadDatabase();
		d.getAllData().length.should.equal(0);
	});
	afterEach(async () => {
		await d.persistence.deleteEverything();
	});

	describe("Insert", () => {
		it("Able to insert a document in the database, setting an _id if none provided, and retrieve it even after a reload", async () => {
			const length = (await d.find({})).length;
			length.should.equal(0);

			await d.insert({ somedata: "ok" } as any);

			// The data was correctly updated
			const docs: any[] = await d.find({});

			docs.length.should.equal(1);
			Object.keys(docs[0]).length.should.equal(2);
			docs[0].somedata.should.equal("ok");
			assert.isDefined(docs[0]._id);
			{
				// After a reload the data has been correctly persisted
				await d.loadDatabase();
				const docs: any[] = await d.find({});
				docs.length.should.equal(1);
				Object.keys(docs[0]).length.should.equal(2);
				docs[0].somedata.should.equal("ok");
				assert.isDefined(docs[0]._id);
			}
		});
		it("Can insert multiple documents in the database", async () => {
			const length = (await d.find({})).length;
			length.should.equal(0);
			await d.insert({ somedata: "ok" } as any);
			await d.insert({ somedata: "another" } as any);
			await d.insert({ somedata: "again" } as any);
			const docs = await d.find({});
			docs.length.should.equal(3);
			_.pluck(docs, "somedata").should.contain("ok");
			_.pluck(docs, "somedata").should.contain("another");
			_.pluck(docs, "somedata").should.contain("again");
		});
		it("Can insert and get back from DB complex objects with all primitive and secondary types", async () => {
			const da = new Date();
			const obj = {
				a: ["ee", "ff", 42],
				date: da,
				subobj: {
					a: "b",
					b: "c",
				},
			};
			await d.insert(obj as any);
			const doc: any = (await d.find({}))[0];
			doc.a.length.should.equal(3);
			doc.a[0].should.equal("ee");
			doc.a[1].should.equal("ff");
			doc.a[2].should.equal(42);
			doc.date.getTime().should.equal(da.getTime());
			doc.subobj.a.should.equal("b");
			doc.subobj.b.should.equal("c");
		});
		it("If an object returned from the DB is modified and refetched, the original value should be found", async () => {
			await d.insert({ a: "something" } as any);
			{
				const doc: any = (await d.find({}))[0];
				doc.a.should.equal("something");
				doc.a = "another thing";
				doc.a.should.equal("another thing");
			}
			{
				const doc: any = (await d.find({}))[0];
				doc.a.should.equal("something");
				doc.a = "another thing";
				doc.a.should.equal("another thing");
			}
			{
				const doc: any = (await d.find({}))[0];
				doc.a.should.equal("something");
			}
		});
		it("Cannot insert a doc that has a field beginning with a $ sign", async () => {
			let inserted = 0;
			try {
				await d.insert({ $something: "atest" } as any);
				inserted = 1;
			} catch (e) {
				inserted = -1;
			}
			expect(inserted).eq(-1);
		});
		it("If an _id is already given when we insert a document, use that instead of generating a random one", async () => {
			{
				const doc = await d.insert({
					_id: "test",
					stuff: true,
				});
				doc.docs[0]._id!.should.equal("test");
			}
			{
				const docs = await d.find({ stuff: true });
				docs.length.should.equal(1);
				(docs[0] as any)._id.should.equal("test");
			}
			{
				let inserted = 0;
				try {
					await d.insert({ _id: "test", stuff: true });
					inserted = 1;
				} catch (e) {
					inserted = -1;
				}
				expect(inserted).eq(-1);
			}
		});
		it("Modifying the insertedDoc after an insert doesnt change the copy saved in the database", (done) => {
			d.insert({
				a: 2,
				hello: "world",
			} as any)
				.then((newDoc) => {
					newDoc.docs[0].hello = "changed";
					return d.find({ a: 2 });
				})
				.then((docs) => {
					(docs[0] as any).hello.should.equal("world");
					done();
				});
		});
		it("Can insert an array of documents at once", async () => {
			const docs = [
				{
					a: 5,
					b: "hello",
				},
				{
					a: 42,
					b: "world",
				},
			];
			await d.insert(docs);
			const docsInDb = await d.find({});
			docsInDb.length.should.equal(2);
			_.find(docsInDb, (doc) => doc.a === 5).b.should.equal("hello");
			_.find(docsInDb, (doc) => doc.a === 42).b.should.equal("world");
			// The data has been persisted correctly
			(await d.persistence.data.length()).should.be.eq(2);
		});
		it("If a bulk insert violates a constraint, all changes are rolled back", async () => {
			const docs = [
				{
					a: 5,
					b: "hello",
				},
				{
					a: 42,
					b: "world",
				},
				{
					a: 5,
					b: "bloup",
				},
				{ a: 7 },
			];
			await d.ensureIndex({
				fieldName: "a",
				unique: true,
			});

			let inserted = 0;
			try {
				await d.insert(docs);
				inserted = 1;
			} catch (e) {
				inserted = -1;
			}
			expect(inserted).eq(-1);

			const memoryLength = (await d.find({})).length;
			memoryLength.should.equal(0);

			const persistenceLength = await d.persistence.data.length();
			persistenceLength.should.equal(1); // index only
		});
		it("CreatedAt field is added and persisted", async () => {
			{
				const newDoc = { hello: "world" };
				d = new Datastore<any, any>({
					ref: testDb,
					timestampData: true,
				});
				const beginning = Date.now();
				await d.loadDatabase();
				const length = (await d.find({})).length;
				length.should.equal(0);
				const insertedDoc = (await d.insert(newDoc)).docs[0];

				// No side effect on given input
				assert.deepEqual(newDoc, { hello: "world" });
				// Insert doc has two new fields, _id and createdAt
				insertedDoc.hello.should.equal("world");
				assert.isDefined(insertedDoc.createdAt);
				assert.isDefined(insertedDoc.updatedAt);
				insertedDoc.createdAt!.should.equal(insertedDoc.updatedAt);
				assert.isDefined(insertedDoc._id);
				Object.keys(insertedDoc).length.should.equal(4);
				assert.isBelow(Math.abs(insertedDoc.createdAt!.getTime() - beginning), reloadTimeUpperBound);
				// No more than 30ms should have elapsed (worst case, if there is a flush)
				// Modifying results of insert doesn't change the cache
				insertedDoc.bloup = "another";
				Object.keys(insertedDoc).length.should.equal(5);

				await d.loadDatabase();
				const docs = await d.find({});
				docs.length.should.equal(1);
				assert.deepEqual(newDoc, { hello: "world" });
				assert.deepEqual(
					{
						hello: "world",
						_id: insertedDoc._id,
						createdAt: insertedDoc.createdAt,
						updatedAt: insertedDoc.updatedAt,
					},
					docs[0]
				);

				await d.loadDatabase();
				const docs2 = await d.find({});
				docs2.length.should.equal(1);
				assert.deepEqual(newDoc, { hello: "world" });
				assert.deepEqual(
					{
						hello: "world",
						_id: insertedDoc._id,
						createdAt: insertedDoc.createdAt,
						updatedAt: insertedDoc.updatedAt,
					},
					docs2[0]
				);
			}
		});
		it("If createdAt is specified by user, don't change it", async () => {
			const newDoc = {
				hello: "world",
				createdAt: new Date(234),
			};

			const beginning = Date.now();
			d = new Datastore<any, any>({
				ref: testDb,
				timestampData: true,
			});

			await d.loadDatabase();

			const insertedDoc = (await d.insert(newDoc)).docs[0];

			Object.keys(insertedDoc).length.should.equal(4);
			insertedDoc.createdAt!.getTime().should.equal(234);
			// Not modified
			assert.isBelow(insertedDoc.updatedAt!.getTime() - beginning, reloadTimeUpperBound);
			// Created
			const docs = await d.find({});

			assert.deepEqual(insertedDoc, docs[0]);
			await d.loadDatabase();

			{
				const docs = await d.find({});
				assert.deepEqual(insertedDoc, docs[0]);
			}
		});
		it("If updatedAt is specified by user, don't change it", async () => {
			const newDoc = {
				hello: "world",
				updatedAt: new Date(9),
			};

			const beginning = Date.now();
			d = new Datastore<any, any>({
				ref: testDb,
				timestampData: true,
			});
			await d.loadDatabase();
			const insertedDoc = (await d.insert(newDoc)).docs[0];
			Object.keys(insertedDoc).length.should.equal(4);
			insertedDoc.updatedAt!.getTime().should.equal(9);
			// Not modified
			assert.isBelow(insertedDoc.createdAt!.getTime() - beginning, reloadTimeUpperBound);
			// Created
			const docs = await d.find({});
			assert.deepEqual(insertedDoc, docs[0]);
			await d.loadDatabase();

			{
				const docs = await d.find({});
				assert.deepEqual(insertedDoc, docs[0]);
			}
		});
		it("Can insert a doc with id 0", (done) => {
			d.insert({
				_id: 0 as any,
				hello: "world",
			}).then(({ docs }) => {
				const { _id, hello } = docs[0];
				_id!.should.equal(0);
				hello.should.equal("world");
				done();
			});
		});
	}); // ==== End of 'Insert' ==== //

	describe("#getCandidates", () => {
		it("Can use an index to get docs with a basic match", async () => {
			await d.ensureIndex({ fieldName: "tf" });
			const _doc1 = (await d.insert({ tf: 4 })).docs[0];
			await d.insert({ tf: 6 });
			const _doc2 = (
				await d.insert({
					tf: 4,
					an: "other",
				})
			).docs[0];
			await d.insert({ tf: 9 });
			const data = await d.getCandidates({
				r: 6,
				tf: 4,
			});
			var doc1 = _.find(data, function (d) {
					return d._id === _doc1._id;
				}),
				doc2 = _.find(data, function (d) {
					return d._id === _doc2._id;
				});
			data.length.should.equal(2);
			assert.deepEqual(doc1, {
				_id: doc1._id,
				tf: 4,
			});
			assert.deepEqual(doc2, {
				_id: doc2._id,
				tf: 4,
				an: "other",
			});
		});
		it("Can use an index to get docs with a $in match", async () => {
			await d.ensureIndex({ fieldName: "tf" });
			await d.insert({ tf: 4 });
			const _doc1 = (await d.insert({ tf: 6 })).docs[0];
			await d.insert({
				tf: 4,
				an: "other",
			});
			const _doc2 = (await d.insert({ tf: 9 })).docs[0];
			const data = await d.getCandidates({
				r: 6,
				tf: {
					$in: [6, 9, 5],
				},
			});
			const doc1 = _.find(data, function (d) {
				return d._id === _doc1._id;
			});
			const doc2 = _.find(data, function (d) {
				return d._id === _doc2._id;
			});
			data.length.should.equal(2);
			assert.deepEqual(doc1, {
				_id: doc1._id,
				tf: 6,
			});
			assert.deepEqual(doc2, {
				_id: doc2._id,
				tf: 9,
			});
		});
		it("Can use an index to get docs with a $eq match", async () => {
			await d.ensureIndex({ fieldName: "tf" });
			const _doc1 = (await d.insert({ tf: 4 })).docs[0];
			await d.insert({ tf: 6 });
			const _doc2 = (
				await d.insert({
					tf: 4,
					an: "other",
				})
			).docs[0];
			await d.insert({ tf: 9 });
			const data = await d.getCandidates({
				r: 6,
				tf: {
					$eq: 4,
				},
			});
			var doc1 = _.find(data, function (d) {
					return d._id === _doc1._id;
				}),
				doc2 = _.find(data, function (d) {
					return d._id === _doc2._id;
				});
			data.length.should.equal(2);
			assert.deepEqual(doc1, {
				_id: doc1._id,
				tf: 4,
			});
			assert.deepEqual(doc2, {
				_id: doc2._id,
				tf: 4,
				an: "other",
			});
		});
		it("If no index can be used, return the whole database", async () => {
			await d.ensureIndex({ fieldName: "tf" });
			const _doc1 = (await d.insert({ tf: 4 })).docs[0];
			const _doc2 = (await d.insert({ tf: 6 })).docs[0];
			const _doc3 = (
				await d.insert({
					tf: 4,
					an: "other",
				})
			).docs[0];
			const _doc4 = (await d.insert({ tf: 9 })).docs[0];

			const data = await d.getCandidates({
				r: 6,
				notf: {
					$in: [6, 9, 5],
				},
			});
			const doc1 = _.find(data, function (d) {
				return d._id === _doc1._id;
			});

			const doc2 = _.find(data, function (d) {
				return d._id === _doc2._id;
			});

			const doc3 = _.find(data, function (d) {
				return d._id === _doc3._id;
			});

			const doc4 = _.find(data, function (d) {
				return d._id === _doc4._id;
			});
			data.length.should.equal(4);
			assert.deepEqual(doc1, {
				_id: doc1._id,
				tf: 4,
			});
			assert.deepEqual(doc2, {
				_id: doc2._id,
				tf: 6,
			});
			assert.deepEqual(doc3, {
				_id: doc3._id,
				tf: 4,
				an: "other",
			});
			assert.deepEqual(doc4, {
				_id: doc4._id,
				tf: 9,
			});
		});
		it("Can use indexes for comparison matches", async () => {
			await d.ensureIndex({ fieldName: "tf" });
			const _doc1 = await d.insert({ tf: 4 });
			const _doc2 = (await d.insert({ tf: 6 })).docs[0];
			const _doc3 = await d.insert({
				tf: 4,
				an: "other",
			});
			const _doc4 = (await d.insert({ tf: 9 })).docs[0];

			const data = await d.getCandidates({
				r: 6,
				tf: {
					$lte: 9,
					$gte: 6,
				},
			});

			var doc2 = _.find(data, function (d) {
					return d._id === _doc2._id;
				}),
				doc4 = _.find(data, function (d) {
					return d._id === _doc4._id;
				});
			data.length.should.equal(2);
			assert.deepEqual(doc2, {
				_id: doc2._id,
				tf: 6,
			});
			assert.deepEqual(doc4, {
				_id: doc4._id,
				tf: 9,
			});
		});
	}); // ==== End of '#getCandidates' ==== //

	describe("Find", () => {
		it("Can find all documents if an empty query is used", async () => {
			await d.insert({ somedata: "ok" } as any);
			await d.insert({
				somedata: "another",
				plus: "additional data",
			});
			await d.insert({ somedata: "again" } as any);
			const docs = await d.find({});
			docs.length.should.equal(3);
			_.pluck(docs, "somedata").should.contain("ok");
			_.pluck(docs, "somedata").should.contain("another");
			_.find(docs, ({ somedata }) => somedata === "another").plus.should.equal("additional data");
			_.pluck(docs, "somedata").should.contain("again");
		});
		it("Can find all documents matching a basic query", async () => {
			await d.insert({ somedata: "ok" } as any);
			await d.insert({
				somedata: "again",
				plus: "additional data",
			});
			await d.insert({ somedata: "again" } as any);
			const docs = await d.find({ somedata: "again" });
			docs.length.should.equal(2);
			_.pluck(docs, "somedata").should.not.contain("ok");
			const length = (await d.find({ somedata: "nope" })).length;
			length.should.equal(0);
		});
		it("Can find dates and objects (non JS-native types)", (done) => {
			const date1 = new Date(1234543);
			const date2 = new Date(9999);
			d.insert({
				now: date1,
				sth: { name: "xwebdb" },
			})
				.then(() => d.find({ now: date1 }))
				.then((docs) => {
					(docs[0] as any).sth.name.should.equal("xwebdb");
					return d.find({ now: date2 });
				})
				.then((docs) => {
					assert.isEmpty(docs);
					return d.find({ sth: { name: "xwebdb" } });
				})
				.then((docs) => {
					(docs[0] as any).sth.name.should.equal("xwebdb");
					return d.find({ sth: { name: "other" } });
				})
				.then((docs) => {
					assert.isEmpty(docs);
					done();
				});
		});
		it("Can use dot-notation to query subfields", (done) => {
			d.insert({ greeting: { english: "hello" } })
				.then(() => d.find({ "greeting.english": "hello" }))
				.then((docs) => {
					(docs[0] as any).greeting.english.should.equal("hello");
					return d.find({ "greeting.english": "hellooo" });
				})
				.then((docs) => {
					assert.isEmpty(docs);
					return d.find({ "greeting.englis": "hello" });
				})
				.then((docs) => {
					assert.isEmpty(docs);
					done();
				});
		});
		it("Array fields match if any element matches", (done) => {
			d.insert({
				fruits: ["pear", "apple", "banana"],
			}).then(function (res) {
				const doc1 = res.docs[0];
				d.insert({
					fruits: ["coconut", "orange", "pear"],
				}).then(function (res) {
					const doc2 = res.docs[0];
					d.insert({ fruits: ["banana"] }).then(function (res) {
						const doc3 = res.docs[0];
						d.find({ fruits: "pear" })
							.then(function (docs) {
								docs.length.should.equal(2);
								_.pluck(docs, "_id").should.contain(doc1._id);
								_.pluck(docs, "_id").should.contain(doc2._id);
								return d.find({ fruits: "banana" });
							})
							.then(function (docs) {
								docs.length.should.equal(2);
								_.pluck(docs, "_id").should.contain(doc1._id);
								_.pluck(docs, "_id").should.contain(doc3._id);
								return d.find({ fruits: "doesntexist" });
							})
							.then(function (docs) {
								docs.length.should.equal(0);
								done();
							});
					});
				});
			});
		});
		it("Returns an error if the query is not well formed", async () => {
			await d.insert({ hello: "world" });
			let ran = -1;
			try {
				await d.find({ $or: { hello: "world" } });
				ran = 1;
			} catch (e) {
				ran = 0;
			}
			expect(ran).to.eq(0);
		});
		it("Changing the documents returned by find or findOne do not change the database state", (done) => {
			d.insert({
				a: 2,
				hello: "world",
			})
				.then(() => d.find({ a: 2 }))
				.then((docs) => {
					(docs[0] as any).hello = "changed";
					return d.find({ a: 2 });
				})
				.then((docs) => {
					(docs[0] as any).hello.should.equal("world");
					return d.find({ a: 2 });
				})
				.then((docs) => {
					(docs[0] as any).hello = "changed";
					return d.find({ a: 2 });
				})
				.then((docs) => {
					(docs[0] as any).hello.should.equal("world");
					done();
				});
		});
	}); // ==== End of 'Find' ==== //

	describe("Count", () => {
		it("Count all documents if an empty query is used", async () => {
			await d.insert({ somedata: "ok" });
			await d.insert({
				somedata: "another",
				plus: "additional data",
			});
			await d.insert({ somedata: "again" });
			(await d.count({})).should.equal(3);
		});
		it("Count all documents matching a basic query", async () => {
			await d.insert({ somedata: "ok" });
			await d.insert({
				somedata: "again",
				plus: "additional data",
			});
			await d.insert({ somedata: "again" });
			(await d.count({ somedata: "again" })).should.equal(2);
			(await d.count({ somedata: "ok" })).should.equal(1);
			(await d.count({ somedata: "x" })).should.equal(0);
			(await d.count({ somedata: { $eq: "again" } })).should.equal(2);
			(await d.count({ somedata: { $in: ["again", "ok"] } })).should.equal(3);
		});
		it("Array fields match if any element matches", (done) => {
			d.insert({
				fruits: ["pear", "apple", "banana"],
			})
				.then(() =>
					d.insert({
						fruits: ["coconut", "orange", "pear"],
					})
				)
				.then(() => d.insert({ fruits: ["banana"] }))
				.then(() => d.count({ fruits: "pear" }))
				.then((docs) => {
					docs.should.equal(2);
					return d.count({ fruits: "banana" });
				})
				.then((docs) => {
					docs.should.equal(2);
					return d.count({ fruits: "doesntexist" });
				})
				.then((docs) => {
					docs.should.equal(0);
					done();
				});
		});
		it("Returns an error if the query is not well formed", async () => {
			await d.insert({ hello: "world" });
			let ran = -1;
			try {
				await d.count({ $or: { hello: "world" } });
				ran = 1;
			} catch (e) {
				ran = 0;
			}
			expect(ran).to.eq(0);
		});
	}); // ==== End of 'Count' ==== //

	describe("Update", () => {
		it("If the query doesn't match anything, database is not modified", async () => {
			await d.insert({ somedata: "ok" });
			await d.insert({
				somedata: "another",
				plus: "additional data",
			});
			await d.insert({ somedata: "again" });
			const n = await d.update({ somedata: "nope" }, { newDoc: "yes" }, { multi: true });
			n.docs.length.should.equal(0);

			const docs = await d.find({});
			const doc1 = _.find(docs, ({ somedata }) => somedata === "ok");
			const doc2 = _.find(docs, ({ somedata }) => somedata === "again");
			const doc3 = _.find(docs, ({ somedata }) => somedata === "another");
			docs.length.should.equal(3);
			assert.isUndefined(_.find(docs, ({ newDoc }) => newDoc === "yes"));
			assert.deepEqual(doc1, {
				_id: doc1._id,
				somedata: "ok",
			});
			assert.deepEqual(doc2, {
				_id: doc2._id,
				somedata: "again",
			});
			assert.deepEqual(doc3, {
				_id: doc3._id,
				somedata: "another",
				plus: "additional data",
			});
		});
		it("Update the updatedAt field", (done) => {
			const beginning = Date.now();
			d = new Datastore<any, any>({
				ref: testDb,
				timestampData: true,
			});
			d.loadDatabase()
				.then(() => d.insert({ hello: "world" }))
				.then((res) => {
					const insertedDoc = res.docs[0];
					assert.isBelow(insertedDoc.updatedAt!.getTime() - beginning, reloadTimeUpperBound);
					assert.isBelow(insertedDoc.createdAt!.getTime() - beginning, reloadTimeUpperBound);
					Object.keys(insertedDoc).length.should.equal(4);
					// Wait 100ms before performing the update
					setTimeout(() => {
						const step1 = Date.now();
						return d
							.update({ _id: insertedDoc._id }, { $set: { hello: "mars" } }, {})
							.then(() => d.find({ _id: insertedDoc._id }))
							.then((docs) => {
								docs.length.should.equal(1);
								Object.keys(docs[0] as any).length.should.equal(4);
								(docs[0] as any)._id.should.equal(insertedDoc._id);
								(docs[0] as any).createdAt.should.equal(insertedDoc.createdAt);
								(docs[0] as any).hello.should.equal("mars");
								assert.isAbove((docs[0] as any).updatedAt.getTime() - beginning, 99);
								// updatedAt modified
								assert.isBelow((docs[0] as any).updatedAt.getTime() - step1, reloadTimeUpperBound);
								// updatedAt modified
								done();
							});
					}, 100);
				});
		});
		it("Can update multiple documents matching the query", async () => {
			await d.remove({}, { multi: true });
			await d.loadDatabase();
			const length = (await d.find({})).length;
			length.should.equal(0);
			await d.insert({ a: 0, b: 2, c: "x" });
			await d.insert({ a: 0, b: 2, c: "y" });
			await d.insert({ a: 0, b: 2, c: "z" });
			(await d.count({ a: 0 })).should.equal(3);
			(await d.count({ c: "n" })).should.equal(0);
			(await d.count({ b: 2 })).should.equal(3);
			await d.update({ a: 0 }, { $set: { c: "n", b: 10 } }, { multi: true });
			(await d.count({ a: 0 })).should.equal(3);
			(await d.count({ c: "n" })).should.equal(3);
			(await d.count({ b: 2 })).should.equal(0);
		});
		describe("Upserts", () => {
			it("Can perform upserts if needed", async () => {
				{
					await d.remove({}, { multi: true });
					await d.loadDatabase();
					const docs = await d.find({});
					docs.length.should.equal(0);
				}
				{
					const u = await d.update({}, { a: "x" }, {});
					u.upsert.should.equal(false);
					u.number.should.equal(0);
					assert.isEmpty(u.docs);
				}
				{
					const update = await d.update({}, { a: "x", $setOnInsert: { a: "x" } }, { upsert: true });
					update.upsert.should.equal(true);
					update.number.should.equal(1);
					assert.isNotEmpty(update.docs);
					const find = await d.find({});
					find.length.should.equal(1);
					(find[0] as any).a.should.equal("x");
				}
				{
					const update = await d.update({ a: "x" }, { a: "y" }, {});
					update.upsert.should.equal(false);
					update.number.should.equal(1);
					assert.isNotEmpty(update.docs);
					const find = await d.find({});
					find.length.should.equal(1);
					(find[0] as any).a.should.equal("y");
				}
			});
			it("If the update query is a normal object with no modifiers, it is the doc that will be upserted", async () => {
				await d.update(
					{
						$or: [{ a: 4 }, { a: 5 }],
					},
					{
						hello: "world",
						bloup: "blap",
						$setOnInsert: {
							hello: "world",
							bloup: "blap",
						},
					},
					{ upsert: true }
				);
				const docs = await d.find({});
				docs.length.should.equal(1);
				const doc = docs[0];
				Object.keys(doc as any).length.should.equal(3);
				(doc as any).hello.should.equal("world");
				(doc as any).bloup.should.equal("blap");
			});
			it("If the update query contains modifiers, it is applied to the object resulting from removing all operators from the find query 1", async () => {
				await d.update(
					{
						$or: [{ a: 4 }, { a: 5 }],
					},
					{
						$set: { hello: "world" },
						$inc: { bloup: 3 },
						$setOnInsert: {
							hello: "world",
							bloup: 3,
						},
					},
					{ upsert: true }
				);

				const docs = await d.find({ hello: "world" });
				docs.length.should.equal(1);
				const doc = docs[0];
				Object.keys(doc as any).length.should.equal(3);
				(doc as any).hello.should.equal("world");
				(doc as any).bloup.should.equal(3);
			});
			it("Performing upsert without $setOnInsert yields a standard error not an exception", async () => {
				expect(await rejected(async () => await d.update({ _id: "1234" }, { $set: { $$badfield: 5 } }, { upsert: true }))).to.eq(true);
			});
		}); // ==== End of 'Upserts' ==== //

		it("Cannot perform update if the update query is not either registered-modifiers-only or copy-only, or contain badly formatted fields", async () => {
			await d.insert({ something: "yup" });

			expect(await rejected(async () => await d.update({}, { boom: { $badfield: 5 } }, { multi: false }))).to.eq(true);

			expect(await rejected(async () => await d.update({}, { boom: { "bad.field": 5 } }, { multi: false }))).to.eq(true);

			expect(
				await rejected(
					async () =>
						await d.update(
							{},
							{
								$inc: { test: 5 },
								mixed: "rrr",
							},
							{ multi: false }
						)
				)
			).to.eq(true);

			expect(await rejected(async () => await d.update({}, { $inexistent: { test: 5 } }, { multi: false }))).to.eq(true);
		});
		it("Can update documents using multiple modifiers", async () => {
			await d.insert({
				_id: "123456",
				something: "yup",
				other: 40,
			});
			const u = await d.update(
				{},
				{
					$set: { something: "changed" },
					$inc: { other: 10 },
				},
				{ multi: false }
			);
			u.number.should.equal(1);
			const doc = (await d.find({ _id: "123456" }))[0];
			Object.keys(doc as any).length.should.equal(3);
			(doc as any)._id.should.equal("123456");
			(doc as any).something.should.equal("changed");
			(doc as any).other.should.equal(50);
		});
		it("CUpserting using $setOnInsert", async () => {
			const n = (
				await d.update(
					{ bloup: "blap" },
					{
						$set: { hello: "world" },
						$setOnInsert: {
							bloup: "blap",
							hello: "world",
						},
					},
					{ upsert: true }
				)
			).number;
			n.should.equal(1);
			const docs = await d.find({});
			docs.length.should.equal(1);
			Object.keys(docs[0] as any).length.should.equal(3);
			(docs[0] as any).hello.should.equal("world");
			(docs[0] as any).bloup.should.equal("blap");
			assert.isDefined((docs[0] as any)._id);
		});
		it("When using modifiers, the only way to update subdocs is with the dot-notation", async () => {
			await d.insert({
				bloup: {
					blip: "blap",
					other: true,
				},
			});

			await d.update({}, { $set: { "bloup.blip": "hello" } }, {});
			((await d.find({}))[0] as any).bloup.blip.should.equal("hello");
			await d.update({}, { $set: { bloup: { blip: "ola" } } }, {});
			assert.isUndefined(((await d.find({}))[0] as any).bloup.other);
		});
		it("Returns an error if the query is not well formed", async () => {
			await d.insert({ hello: "world" });

			expect(await rejected(async () => await d.update({ $or: { hello: "world" } }, { a: 1 }, {}))).to.eq(true);
		});
		it("If an error is thrown by a modifier, the database state is not changed", async () => {
			const db = new Datastore<any, any>({
				ref: testDb,
				timestampData: true,
			});
			db.loadDatabase();
			await db.remove({}, { multi: true });
			const res = await db.insert({ hello: "world" });
			const updatedAt = res.docs[0].updatedAt;
			const _id = res.docs[0]._id;
			expect(await rejected(async () => await db.update({}, { $inc: { hello: 4 } }, {}))).to.eq(true);
			const doc2 = (await db.find({}))[0];
			assert.isDefined(doc2);
			doc2.updatedAt.should.equal(updatedAt);
			doc2._id.should.equal(_id);
			doc2.hello.should.equal("world");
		});
		it("Cant change the _id of a document", async () => {
			const _id = (await d.insert({ a: 2 })).docs[0]._id;

			expect(
				await rejected(
					async () =>
						await d.update(
							{ a: 2 },
							{
								a: 3,
								_id: "nope",
							},
							{}
						)
				)
			).to.eq(true);

			expect(await rejected(async () => await d.update({ a: 2 }, { $set: { _id: "nope" } }, {}))).to.eq(true);

			const doc: any = (await d.find({}))[0];
			doc._id.should.equal(_id);
			doc.a.should.equal(2);
		});
		it("Non-multi updates are persistent", async () => {
			await d.insert({
				a: 1,
				hello: "world",
			});
			await d.insert({
				a: 2,
				hello: "earth",
			});
			await d.update({ a: 2 }, { $set: { hello: "changed" } }, {});
			const docs: any[] = await d.find({});
			docs.sort((a, b) => a.a - b.a);
			docs.length.should.equal(2);
			docs[0].hello.should.equal("world");
			docs[1].hello.should.equal("changed");
			{
				await d.loadDatabase();
				const docs: any[] = await d.find({});
				docs.sort((a, b) => a.a - b.a);
				docs.length.should.equal(2);
				docs[0].hello.should.equal("world");
				docs[1].hello.should.equal("changed");
			}
		});
		it("Multi updates are persistent", async () => {
			await d.insert({
				a: 1,
				hello: "world",
			});
			await d.insert({
				a: 2,
				hello: "earth",
			});
			await d.insert({
				a: 3,
				hello: "earth",
			});
			await d.update({}, { $set: { hello: "changed" } }, { multi: true });
			const docs = await d.find({ hello: "changed" });
			docs.length.should.equal(3);
			{
				await d.loadDatabase();
				const docs = await d.find({ hello: "changed" });
				docs.length.should.equal(3);
			}
		});
		it("If a multi update fails on one document, previous updates should be rolled back", async () => {
			await d.ensureIndex({ fieldName: "a" });
			await d.insert({ a: 4 });
			await d.insert({ a: 5 });
			await d.insert({ a: "abc" });
			// With this query, candidates are always returned in the order 4, 5, 'abc'
			// so it's always the last one which fails

			expect(
				await rejected(
					async () =>
						await d.update(
							{
								a: {
									$in: [4, 5, "abc"],
								},
							},
							{ $inc: { a: 10 } },
							{ multi: true }
						)
				)
			).to.eq(true);
			(await d.find({ a: 4 })).length.should.equal(1);
			(await d.find({ a: 5 })).length.should.equal(1);
			(await d.find({ a: "abc" })).length.should.equal(1);
		});
		it("If an index constraint is violated by an update, all changes should be rolled back", async () => {
			await d.ensureIndex({ fieldName: "a", unique: true });
			await d.insert({ a: 4 });
			await d.insert({ a: 5 });
			await d.insert({ a: 6 });
			// With this query, candidates are always returned in the order 4, 5, 'abc'
			// so it's always the last one which fails
			expect(
				await rejected(
					async () =>
						await d.update(
							{
								a: {
									$set: 1,
								},
							},
							{ $inc: { a: 1 } },
							{ multi: true }
						)
				)
			).to.eq(true);
			(await d.find({ a: 4 })).length.should.equal(1);
			(await d.find({ a: 5 })).length.should.equal(1);
			(await d.find({ a: 6 })).length.should.equal(1);
		});
		it("return all updated docs", async () => {
			d.insert([
				{ b: 1, a: 4 },
				{ b: 1, a: 5 },
				{ b: 1, a: 6 },
			]);
			const b1 = await d.update(
				{ a: 7 },
				{ $set: { a: 1 } },
				{
					multi: true,
				}
			);
			b1.docs.length.should.equal(0);
			const b2 = await d.update(
				{ a: 4 },
				{ $inc: { a: 1 } },
				{
					multi: true,
				}
			);
			b2.docs[0].a.should.equal(5);
			const b3 = await d.update(
				{ b: 1 },
				{ $inc: { a: 1 } },
				{
					multi: true,
				}
			);
			b3.number.should.equal(3);
			b3.docs[0].b.should.equal(1);
		});
		it("createdAt property is unchanged and updatedAt correct after an update, even a complete document replacement", async () => {
			const d2 = new Datastore<any, any>({
				ref: testDb,
				timestampData: true,
			});
			await d2.loadDatabase();
			await d2.remove({}, { multi: true });
			const doc = (await d2.insert({ a: 1 })).docs[0];
			const createdAt = doc.createdAt;
			const updatedAt = doc.updatedAt;
			await d2.update({}, { $inc: { a: 1 } }, {});
			const doc2 = (await d2.find({}))[0];
			const createdAt2 = doc2.createdAt;
			const updatedAt2 = doc2.updatedAt;
			assert.isTrue(createdAt === createdAt2);
			assert.isFalse(updatedAt === updatedAt2);
			await d2.update({}, { a: 10 }, {});
			const doc3 = (await d2.find({}))[0];
			const createdAt3 = doc3.createdAt;
			const updatedAt3 = doc3.updatedAt;
			assert.isTrue(createdAt === createdAt3);
			assert.isFalse(updatedAt === updatedAt3);
		});
	}); // ==== End of 'Update' ==== //

	describe("Remove", () => {
		it("Can remove multiple documents", async () => {
			await d.insert({ a: 1 });
			await d.insert({ a: 2 });
			await d.insert({ a: 3 });
			await d.insert({ a: 4 });
			await d.insert({ a: 5 });
			await d.insert({ a: 6 });
			await d.insert({ a: 7 });
			await d.insert({ a: 8 });
			await d.insert({ a: 9 });
			await d.insert({ a: 10 });

			(await d.find({})).length.should.equal(10);
			(await d.remove({ a: { $lte: 5 } }, { multi: true })).number.should.equal(5);
			(await d.find({})).length.should.equal(5);
			(await d.find({ a: { $lte: 5 } })).length.should.equal(0);
			(await d.find({ a: 1 })).length.should.equal(0);
			(await d.find({ a: 2 })).length.should.equal(0);
			(await d.find({ a: 3 })).length.should.equal(0);
			(await d.find({ a: 4 })).length.should.equal(0);
			(await d.find({ a: 5 })).length.should.equal(0);
			(await d.find({ a: { $gt: 5 } })).length.should.equal(5);
			(await d.find({ a: 6 })).length.should.equal(1);
			(await d.find({ a: 7 })).length.should.equal(1);
			(await d.find({ a: 8 })).length.should.equal(1);
			(await d.find({ a: 9 })).length.should.equal(1);
			(await d.find({ a: 10 })).length.should.equal(1);
			(await d.remove({ a: { $gt: 5 } }, { multi: true })).number.should.equal(5);
			(await d.find({})).length.should.equal(0);
			(await d.find({ a: { $lte: 5 } })).length.should.equal(0);
			(await d.find({ a: 1 })).length.should.equal(0);
			(await d.find({ a: 2 })).length.should.equal(0);
			(await d.find({ a: 3 })).length.should.equal(0);
			(await d.find({ a: 4 })).length.should.equal(0);
			(await d.find({ a: 5 })).length.should.equal(0);
			(await d.find({ a: { $gt: 5 } })).length.should.equal(0);
			(await d.find({ a: 6 })).length.should.equal(0);
			(await d.find({ a: 7 })).length.should.equal(0);
			(await d.find({ a: 8 })).length.should.equal(0);
			(await d.find({ a: 9 })).length.should.equal(0);
			(await d.find({ a: 10 })).length.should.equal(0);
		});
		// This tests concurrency issues
		it("Remove can be called multiple times in parallel and everything that needs to be removed will be", async () => {
			await d.insert({ a: 1 });
			await d.insert({ a: 2 });
			await d.insert({ a: 3 });
			await d.insert({ a: 4 });
			await d.insert({ a: 5 });
			await d.insert({ a: 6 });
			await d.insert({ a: 7 });
			await d.insert({ a: 8 });
			await d.insert({ a: 9 });
			await d.insert({ a: 10 });
			(await d.find({})).length.should.equal(10);
			await Promise.all([d.remove({ a: { $lte: 5 } }, { multi: true }), d.remove({ a: { $gt: 5 } }, { multi: true })]);
			(await d.find({})).length.should.equal(0);
			(await d.find({ a: { $lte: 5 } })).length.should.equal(0);
			(await d.find({ a: 1 })).length.should.equal(0);
			(await d.find({ a: 2 })).length.should.equal(0);
			(await d.find({ a: 3 })).length.should.equal(0);
			(await d.find({ a: 4 })).length.should.equal(0);
			(await d.find({ a: 5 })).length.should.equal(0);
			(await d.find({ a: { $gt: 5 } })).length.should.equal(0);
			(await d.find({ a: 6 })).length.should.equal(0);
			(await d.find({ a: 7 })).length.should.equal(0);
			(await d.find({ a: 8 })).length.should.equal(0);
			(await d.find({ a: 9 })).length.should.equal(0);
			(await d.find({ a: 10 })).length.should.equal(0);
		});
		it("Returns an error if the query is not well formed", async () => {
			await d.insert({ hello: "world" });
			expect(await rejected(async () => await d.remove({ $or: { hello: "world" } }, { multi: true }))).to.eq(true);
		});
		it("Non-multi removes are persistent", async () => {
			await d.insert({ a: "x" });
			await d.insert({ a: "y" });
			await d.insert({ a: "z" });
			(await d.find({})).length.should.equal(3);
			await d.remove({ a: { $in: ["x", "y", "z"] } });
			(await d.find({})).length.should.equal(2);
			await d.loadDatabase();
			(await d.find({})).length.should.equal(2);
		});
		it("Multi removes are persistent", async () => {
			await d.insert({ a: "x" });
			await d.insert({ a: "y" });
			await d.insert({ a: "z" });
			(await d.find({})).length.should.equal(3);
			await d.remove({ a: { $in: ["x", "y", "z"] } }, { multi: true });
			(await d.find({})).length.should.equal(0);
			await d.loadDatabase();
			(await d.find({})).length.should.equal(0);
		});
	}); // ==== End of 'Remove' ==== //

	describe("Using indexes", () => {
		describe("ensureIndex and index initialization in database loading", () => {
			it("ensureIndex can be called right after a loadDatabase and be initialized and filled correctly", async () => {
				const now = new Date();

				d.getAllData().length.should.equal(0);

				await d.persistence.data.set("aaa", {
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
				});

				await d.persistence.data.set("bbb", {
					_id: "bbb",
					z: "2",
					hello: "world",
				});

				await d.persistence.data.set("ccc", {
					_id: "ccc",
					z: "3",
					nested: { today: now },
				});

				await d.loadDatabase();

				d.getAllData().length.should.equal(3);
				assert.deepEqual(Object.keys(d.indexes), ["_id"]);
				d.ensureIndex({ fieldName: "z" });
				d.indexes.z.fieldName.should.equal("z");
				d.indexes.z.unique.should.equal(false);
				d.indexes.z.sparse.should.equal(false);
				d.indexes.z.dict.numberOfKeys.should.equal(3);
				(d.indexes.z.dict.get("1")[0] as any).should.equal(d.getAllData()[0]);
				(d.indexes.z.dict.get("2")[0] as any).should.equal(d.getAllData()[1]);
				(d.indexes.z.dict.get("3")[0] as any).should.equal(d.getAllData()[2]);
			});
			it("ensureIndex can be called twice on the same field, the second call will ahve no effect", (done) => {
				Object.keys(d.indexes).length.should.equal(1);
				Object.keys(d.indexes)[0].should.equal("_id");
				d.insert({ planet: "Earth" }).then(() => {
					d.insert({ planet: "Mars" }).then(() => {
						d.find({}).then(({ length }) => {
							length.should.equal(2);
							d.ensureIndex({ fieldName: "planet" }).then(() => {
								Object.keys(d.indexes).length.should.equal(2);
								Object.keys(d.indexes)[0].should.equal("_id");
								Object.keys(d.indexes)[1].should.equal("planet");
								d.indexes.planet.dict.all.length.should.equal(2);
								// This second call has no effect, documents don't get inserted twice in the index
								d.ensureIndex({ fieldName: "planet" }).then(() => {
									Object.keys(d.indexes).length.should.equal(2);
									Object.keys(d.indexes)[0].should.equal("_id");
									Object.keys(d.indexes)[1].should.equal("planet");
									d.indexes.planet.dict.all.length.should.equal(2);
									done();
								});
							});
						});
					});
				});
			});
			it("ensureIndex can be called after the data set was modified and the index still be correct", async () => {
				d.getAllData().length.should.equal(0);
				await d.persistence.data.set("aaa", {
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
				});
				await d.persistence.data.set("bbb", {
					_id: "bbb",
					z: "2",
					hello: "world",
				});
				await d.loadDatabase();
				d.getAllData().length.should.equal(2);
				assert.deepEqual(Object.keys(d.indexes), ["_id"]);
				const res1 = await d.insert({
					z: "12",
					yes: "yes",
				});
				const newDoc1 = res1.docs[0];
				const res2 = await d.insert({
					z: "14",
					nope: "nope",
				});
				const newDoc2 = res2.docs[0];
				await d.remove({ z: "2" });
				await d.update({ z: "1" }, { $set: { yes: "yep" } }, {});
				assert.deepEqual(Object.keys(d.indexes), ["_id"]);
				d.ensureIndex({ fieldName: "z" });
				d.indexes.z.fieldName.should.equal("z");
				d.indexes.z.unique.should.equal(false);
				d.indexes.z.sparse.should.equal(false);
				d.indexes.z.dict.numberOfKeys.should.equal(3);
				// The pointers in the _id and z indexes are the same
				(d.indexes.z.dict.get("1")[0] as any).should.equal(d.indexes._id.dict.get("aaa")[0]);
				(d.indexes.z.dict.get("12")[0] as any).should.equal(d.indexes._id.dict.get(newDoc1._id!)[0]);
				(d.indexes.z.dict.get("14")[0] as any).should.equal(d.indexes._id.dict.get(newDoc2._id!)[0]);
				// The data in the z index is correct
				const docs = await d.find({});
				var doc0 = _.find(docs, function (doc) {
						return doc._id === "aaa";
					}),
					doc1 = _.find(docs, function (doc) {
						return doc._id === newDoc1._id;
					}),
					doc2 = _.find(docs, function (doc) {
						return doc._id === newDoc2._id;
					});
				docs.length.should.equal(3);
				assert.deepEqual(doc0, {
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
					yes: "yep",
				});
				assert.deepEqual(doc1, {
					_id: newDoc1._id,
					z: "12",
					yes: "yes",
				});
				assert.deepEqual(doc2, {
					_id: newDoc2._id,
					z: "14",
					nope: "nope",
				});
			});
			it("ensureIndex can be called before a loadDatabase and still be initialized and filled correctly", async () => {
				const now = new Date();

				d.getAllData().length.should.equal(0);
				await d.ensureIndex({ fieldName: "z" });
				d.indexes.z.fieldName.should.equal("z");
				d.indexes.z.unique.should.equal(false);
				d.indexes.z.sparse.should.equal(false);
				d.indexes.z.dict.numberOfKeys.should.equal(0);

				await d.persistence.data.set("aaa", {
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
				});

				await d.persistence.data.set("bbb", {
					_id: "bbb",
					z: "2",
					hello: "world",
				});

				await d.persistence.data.set("ccc", {
					_id: "ccc",
					z: "3",
					nested: { today: now },
				});
				await d.loadDatabase();
				const doc1 = _.find(d.getAllData(), ({ z }) => z === "1");
				const doc2 = _.find(d.getAllData(), ({ z }) => z === "2");
				const doc3 = _.find(d.getAllData(), ({ z }) => z === "3");
				d.getAllData().length.should.equal(3);
				d.indexes.z.dict.numberOfKeys.should.equal(3);
				(d.indexes.z.dict.get("1")[0] as any).should.equal(doc1);
				(d.indexes.z.dict.get("2")[0] as any).should.equal(doc2);
				(d.indexes.z.dict.get("3")[0] as any).should.equal(doc3);
			});
			it("Can initialize multiple indexes on a database load", async () => {
				const now = new Date();

				const rawData = `${model.serialize({
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
				})}\n${model.serialize({
					_id: "bbb",
					z: "2",
					a: "world",
				})}\n${model.serialize({
					_id: "ccc",
					z: "3",
					a: { today: now },
				})}`.split("\n");

				for (let index = 0; index < rawData.length; index++) {
					const element = rawData[index];
					await d.persistence.writeData([[model.deserialize(element)._id, model.deserialize(element)]]);
				}
				d.getAllData().length.should.equal(0);

				await d.ensureIndex({ fieldName: "z" });
				await d.ensureIndex({ fieldName: "a" });

				d.indexes.a.dict.numberOfKeys.should.equal(0);
				d.indexes.z.dict.numberOfKeys.should.equal(0);
				await d.loadDatabase();

				const doc1 = _.find(d.getAllData(), ({ z }) => z === "1");
				const doc2 = _.find(d.getAllData(), ({ z }) => z === "2");
				const doc3 = _.find(d.getAllData(), ({ z }) => z === "3");
				d.getAllData().length.should.equal(3);
				d.indexes.z.dict.numberOfKeys.should.equal(3);
				(d.indexes.z.dict.get("1")[0] as any).should.equal(doc1);
				(d.indexes.z.dict.get("2")[0] as any).should.equal(doc2);
				(d.indexes.z.dict.get("3")[0] as any).should.equal(doc3);
				d.indexes.a.dict.numberOfKeys.should.equal(3);
				(d.indexes.a.dict.get(2 as any)[0] as any).should.equal(doc1);
				(d.indexes.a.dict.get("world")[0] as any).should.equal(doc2);
				d.indexes.a.dict.get({ today: now })[0].should.equal(doc3);
			});
			it("If a unique constraint is not respected, database loading will throw but the valid data will be still be usable", async () => {
				const now = new Date();

				const rawData = `${model.serialize({
					_id: "aaa",
					z: "1",
					a: 2,
					ages: [1, 5, 12],
				})}\n${model.serialize({
					_id: "bbb",
					z: "2",
					a: "world",
				})}\n${model.serialize({
					_id: "ccc",
					z: "1",
					a: { today: now },
				})}`.split("\n");
				d.getAllData().length.should.equal(0);
				for (let index = 0; index < rawData.length; index++) {
					const element = rawData[index];
					await d.persistence.data.set(index.toString(), model.deserialize(element));
				}
				await d.ensureIndex({
					fieldName: "z",
					unique: true,
				});

				d.indexes.z.dict.numberOfKeys.should.equal(0);
				expect(await rejected(async () => await d.loadDatabase())).eq(true);
				d.getAllData().length.should.equal(2);
				d.indexes.z.dict.numberOfKeys.should.equal(2);
			});
			it("If a unique constraint is not respected, ensureIndex will return an error and not create an index", async () => {
				await d.insert({
					a: 1,
					b: 4,
				});
				await d.insert({
					a: 2,
					b: 45,
				});
				await d.insert({
					a: 1,
					b: 3,
				});
				await d.ensureIndex({ fieldName: "b" });
				expect(
					await rejected(
						async () =>
							await d.ensureIndex({
								fieldName: "a",
								unique: true,
							})
					)
				).eq(true);
				assert.deepEqual(Object.keys(d.indexes), ["_id", "b"]);
			});
			it("Can remove an index", (done) => {
				d.ensureIndex({ fieldName: "e" }).then(() => {
					Object.keys(d.indexes).length.should.equal(2);
					assert.isNotNull(d.indexes.e);
					d.removeIndex("e").then(() => {
						Object.keys(d.indexes).length.should.equal(1);
						assert.isUndefined(d.indexes.e);
						done();
					});
				});
			});
		}); // ==== End of 'ensureIndex and index initialization in database loading' ==== //

		describe("Indexing newly inserted documents", () => {
			it("Newly inserted documents are indexed", (done) => {
				d.ensureIndex({ fieldName: "z" });
				d.indexes.z.dict.numberOfKeys.should.equal(0);
				d.insert({
					a: 2,
					z: "yes",
				})
					.then((newDoc) => {
						d.indexes.z.dict.numberOfKeys.should.equal(1);
						assert.deepEqual(d.indexes.z.dict.get("yes"), newDoc.docs);
						return d.insert({
							a: 5,
							z: "nope",
						});
					})
					.then((newDoc) => {
						d.indexes.z.dict.numberOfKeys.should.equal(2);
						assert.deepEqual(d.indexes.z.dict.get("nope"), newDoc.docs);
						done();
					});
			});
			it("If multiple indexes are defined, the document is inserted in all of them", (done) => {
				d.ensureIndex({ fieldName: "z" });
				d.ensureIndex({ fieldName: "ya" });
				d.indexes.z.dict.numberOfKeys.should.equal(0);
				d.insert({
					a: 2,
					z: "yes",
					ya: "indeed",
				})
					.then((newDoc) => {
						d.indexes.z.dict.numberOfKeys.should.equal(1);
						d.indexes.ya.dict.numberOfKeys.should.equal(1);
						assert.deepEqual(d.indexes.z.dict.get("yes"), newDoc.docs);
						assert.deepEqual(d.indexes.ya.dict.get("indeed"), newDoc.docs);
						return d.insert({
							a: 5,
							z: "nope",
							ya: "sure",
						});
					})
					.then((newDoc2) => {
						d.indexes.z.dict.numberOfKeys.should.equal(2);
						d.indexes.ya.dict.numberOfKeys.should.equal(2);
						assert.deepEqual(d.indexes.z.dict.get("nope"), newDoc2.docs);
						assert.deepEqual(d.indexes.ya.dict.get("sure"), newDoc2.docs);
						done();
					});
			});
			it("Can insert two docs at the same key for a non unique index", (done) => {
				d.ensureIndex({ fieldName: "z" });
				d.indexes.z.dict.numberOfKeys.should.equal(0);
				d.insert({
					a: 2,
					z: "yes",
				}).then((newDoc) => {
					d.indexes.z.dict.numberOfKeys.should.equal(1);
					assert.deepEqual(d.indexes.z.dict.get("yes"), newDoc.docs);
					d.insert({
						a: 5,
						z: "yes",
					}).then((newDoc2) => {
						d.indexes.z.dict.numberOfKeys.should.equal(1);
						assert.deepEqual(d.indexes.z.dict.get("yes"), [newDoc.docs[0], newDoc2.docs[0]]);
						done();
					});
				});
			});
			it("If the index has a unique constraint, an error is thrown if it is violated and the data is not modified", (done) => {
				d.ensureIndex({
					fieldName: "z",
					unique: true,
				});
				d.indexes.z.dict.numberOfKeys.should.equal(0);
				d.insert({
					a: 2,
					z: "yes",
				}).then((newDoc) => {
					d.indexes.z.dict.numberOfKeys.should.equal(1);
					assert.deepEqual(d.indexes.z.dict.get("yes"), newDoc.docs);
					rejected(() =>
						d.insert({
							a: 5,
							z: "yes",
						})
					).then((res) => {
						expect(res).eq(true);
						// Index didn't change
						d.indexes.z.dict.numberOfKeys.should.equal(1);
						assert.deepEqual(d.indexes.z.dict.get("yes"), newDoc.docs);
						// Data didn't change
						assert.deepEqual(d.getAllData(), newDoc.docs);
						d.loadDatabase().then(() => {
							d.getAllData().length.should.equal(1);
							assert.deepEqual(d.getAllData()[0], newDoc.docs[0]);
							done();
						});
					});
				});
			});
			it("If an index has a unique constraint, other indexes cannot be modified when it raises an error", async () => {
				await d.ensureIndex({ fieldName: "nonu1" });
				await d.ensureIndex({
					fieldName: "uni",
					unique: true,
				});
				await d.ensureIndex({ fieldName: "nonu2" });
				const newDoc = await d.insert({
					nonu1: "yes",
					nonu2: "yes2",
					uni: "willfail",
				});
				d.indexes.nonu1.dict.numberOfKeys.should.equal(1);
				d.indexes.uni.dict.numberOfKeys.should.equal(1);
				d.indexes.nonu2.dict.numberOfKeys.should.equal(1);

				expect(
					await rejected(() =>
						d.insert({
							nonu1: "no",
							nonu2: "no2",
							uni: "willfail",
						})
					)
				).eq(true);
				// No index was modified
				d.indexes.nonu1.dict.numberOfKeys.should.equal(1);
				d.indexes.uni.dict.numberOfKeys.should.equal(1);
				d.indexes.nonu2.dict.numberOfKeys.should.equal(1);
				assert.deepEqual(d.indexes.nonu1.dict.get("yes"), newDoc.docs);
				assert.deepEqual(d.indexes.uni.dict.get("willfail"), newDoc.docs);
				assert.deepEqual(d.indexes.nonu2.dict.get("yes2"), newDoc.docs);
			});
			it("Unique indexes prevent you from inserting two docs where the field is undefined except if they're sparse", async () => {
				await d.ensureIndex({
					fieldName: "zzz",
					unique: true,
				});
				d.indexes.zzz.dict.numberOfKeys.should.equal(0);
				const newDoc = await d.insert({
					a: 2,
					z: "yes",
				});
				d.indexes.zzz.dict.numberOfKeys.should.equal(1);
				assert.deepEqual(d.indexes.zzz.dict.get(undefined as any), newDoc.docs);
				expect(
					await rejected(() =>
						d.insert({
							a: 5,
							z: "other",
						})
					)
				).eq(true);
				await d.ensureIndex({
					fieldName: "yyy",
					unique: true,
					sparse: true,
				});
				await d.insert({
					a: 5,
					z: "other",
					zzz: "set",
				});
				d.indexes.yyy.dict.all.length.should.equal(0);
				// Nothing indexed
				d.indexes.zzz.dict.all.length.should.equal(2);
			});
			it("Insertion still works as before with indexing", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.ensureIndex({ fieldName: "b" });
				d.insert({
					a: 1,
					b: "hello",
				}).then((res) => {
					const doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: "si",
					}).then((res) => {
						const doc2 = res.docs[0];
						d.find({}).then((docs) => {
							assert.deepEqual(
								doc1,
								_.find(docs, ({ _id }) => _id === doc1._id)
							);
							assert.deepEqual(
								doc2,
								_.find(docs, ({ _id }) => _id === doc2._id)
							);
							done();
						});
					});
				});
			});
			it("All indexes point to the same data as the main index on _id", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.insert({
					a: 1,
					b: "hello",
				}).then(function (res) {
					const doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: "si",
					}).then(function (res) {
						const doc2 = res.docs[0];
						d.find({}).then(function (docs) {
							docs.length.should.equal(2);
							d.getAllData().length.should.equal(2);
							d.indexes._id.dict.get(doc1._id!).length.should.equal(1);
							d.indexes.a.dict.get(1 as any).length.should.equal(1);
							(d.indexes._id.dict.get(doc1._id!)[0] as any).should.equal(d.indexes.a.dict.get(1 as any)[0]);
							d.indexes._id.dict.get(doc2._id!).length.should.equal(1);
							d.indexes.a.dict.get(2 as any).length.should.equal(1);
							(d.indexes._id.dict.get(doc2._id!)[0] as any).should.equal(d.indexes.a.dict.get(2 as any)[0]);
							done();
						});
					});
				});
			});
			it("If a unique constraint is violated, no index is changed, including the main one", async () => {
				await d.ensureIndex({
					fieldName: "a",
					unique: true,
				});
				const res = await d.insert({
					a: 1,
					b: "hello",
				});
				const _id = res.docs[0]._id!;
				expect(
					await rejected(() =>
						d.insert({
							a: 1,
							b: "si",
						})
					)
				).eq(true);
				const { length } = await d.find({});
				length.should.equal(1);
				d.getAllData().length.should.equal(1);
				d.indexes._id.dict.get(_id).length.should.equal(1);
				d.indexes.a.dict.get(1 as any).length.should.equal(1);
				(d.indexes._id.dict.get(_id)[0] as any).should.equal(d.indexes.a.dict.get(1 as any)[0]);
				d.indexes.a.dict.get(2 as any).length.should.equal(0);
			});
		});
		// ==== End of 'Indexing newly inserted documents' ==== //
		describe("Updating indexes upon document update", () => {
			it("Updating docs still works as before with indexing", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.insert({
					a: 1,
					b: "hello",
				}).then(function (res) {
					const _doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: "si",
					}).then(function (res) {
						const _doc2 = res.docs[0];
						d.update(
							{ a: 1 },
							{
								$set: {
									a: 456,
									b: "no",
								},
							},
							{}
						)
							.then(function (nr) {
								var data = d.getAllData(),
									doc1 = _.find(data, function (doc) {
										return doc._id === _doc1._id;
									}),
									doc2 = _.find(data, function (doc) {
										return doc._id === _doc2._id;
									});
								nr.number.should.equal(1);
								data.length.should.equal(2);
								assert.deepEqual(doc1, {
									a: 456,
									b: "no",
									_id: _doc1._id,
								});
								assert.deepEqual(doc2, {
									a: 2,
									b: "si",
									_id: _doc2._id,
								});
								return d.update(
									{},
									{
										$inc: { a: 10 },
										$set: { b: "same" },
									},
									{ multi: true }
								);
							})
							.then(function (nr) {
								var data = d.getAllData(),
									doc1 = _.find(data, function (doc) {
										return doc._id === _doc1._id;
									}),
									doc2 = _.find(data, function (doc) {
										return doc._id === _doc2._id;
									});
								nr.number.should.equal(2);
								data.length.should.equal(2);
								assert.deepEqual(doc1, {
									a: 466,
									b: "same",
									_id: _doc1._id,
								});
								assert.deepEqual(doc2, {
									a: 12,
									b: "same",
									_id: _doc2._id,
								});
								done();
							});
					});
				});
			});
			it("Indexes get updated when a document (or multiple documents) is updated", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.ensureIndex({ fieldName: "b" });
				d.insert({
					a: 1,
					b: "hello",
				}).then(function (res) {
					const doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: "si",
					}).then(function (res) {
						const doc2 = res.docs[0];
						// Simple update
						d.update(
							{ a: 1 },
							{
								$set: {
									a: 456,
									b: "no",
								},
							},
							{}
						)
							.then(function (nr) {
								nr.number.should.equal(1);
								d.indexes.a.dict.numberOfKeys.should.equal(2);
								(d.indexes.a.dict.get(456 as any)[0] as any)._id.should.equal(doc1._id);
								(d.indexes.a.dict.get(2 as any)[0] as any)._id.should.equal(doc2._id);
								d.indexes.b.dict.numberOfKeys.should.equal(2);
								(d.indexes.b.dict.get("no")[0] as any)._id.should.equal(doc1._id);
								(d.indexes.b.dict.get("si")[0] as any)._id.should.equal(doc2._id);
								// The same pointers are shared between all indexes
								d.indexes.a.dict.numberOfKeys.should.equal(2);
								d.indexes.b.dict.numberOfKeys.should.equal(2);
								d.indexes._id.dict.numberOfKeys.should.equal(2);
								(d.indexes.a.dict.get(456 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc1._id!)[0]);
								(d.indexes.b.dict.get("no")[0] as any).should.equal(d.indexes._id.dict.get(doc1._id!)[0]);
								(d.indexes.a.dict.get(2 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc2._id!)[0]);
								(d.indexes.b.dict.get("si")[0] as any).should.equal(d.indexes._id.dict.get(doc2._id!)[0]);
								return d.update(
									{},
									{
										$inc: { a: 10 },
										$set: { b: "same" },
									},
									{ multi: true }
								);
							})
							.then(function (nr) {
								nr.number.should.equal(2);
								d.indexes.a.dict.numberOfKeys.should.equal(2);
								(d.indexes.a.dict.get(466 as any)[0] as any)._id.should.equal(doc1._id);
								(d.indexes.a.dict.get(12 as any)[0] as any)._id.should.equal(doc2._id);
								d.indexes.b.dict.numberOfKeys.should.equal(1);
								d.indexes.b.dict.get("same").length.should.equal(2);
								_.pluck(d.indexes.b.dict.get("same"), "_id").should.contain(doc1._id);
								_.pluck(d.indexes.b.dict.get("same"), "_id").should.contain(doc2._id);
								// The same pointers are shared between all indexes
								d.indexes.a.dict.numberOfKeys.should.equal(2);
								d.indexes.b.dict.numberOfKeys.should.equal(1);
								d.indexes.b.dict.all.length.should.equal(2);
								d.indexes._id.dict.numberOfKeys.should.equal(2);
								(d.indexes.a.dict.get(466 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc1._id!)[0]);
								(d.indexes.a.dict.get(12 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc2._id!)[0]);
								// Can't test the pointers in b as their order is randomized, but it is the same as with a
								done();
							});
					});
				});
			});
			it("If a simple update violates a contraint, all changes are rolled back and an error is thrown", (done) => {
				d.ensureIndex({
					fieldName: "a",
					unique: true,
				});
				d.ensureIndex({
					fieldName: "b",
					unique: true,
				});
				d.ensureIndex({
					fieldName: "c",
					unique: true,
				});
				d.insert({
					a: 1,
					b: 10,
					c: 100,
				}).then(function (res) {
					const _doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: 20,
						c: 200,
					}).then(function (res) {
						const _doc2 = res.docs[0];
						d.insert({
							a: 3,
							b: 30,
							c: 300,
						}).then(function (res) {
							const _doc3 = res.docs[0];
							// Will conflict with doc3
							rejected(() =>
								d.update(
									{ a: 2 },
									{
										$inc: {
											a: 10,
											c: 1000,
										},
										$set: { b: 30 },
									},
									{}
								)
							).then(function (isRejected) {
								expect(isRejected).eq(true);
								var data = d.getAllData(),
									doc1 = _.find(data, function (doc) {
										return doc._id === _doc1._id;
									}),
									doc2 = _.find(data, function (doc) {
										return doc._id === _doc2._id;
									}),
									doc3 = _.find(data, function (doc) {
										return doc._id === _doc3._id;
									});
								// Data left unchanged
								data.length.should.equal(3);
								assert.deepEqual(doc1, {
									a: 1,
									b: 10,
									c: 100,
									_id: _doc1._id,
								});
								assert.deepEqual(doc2, {
									a: 2,
									b: 20,
									c: 200,
									_id: _doc2._id,
								});
								assert.deepEqual(doc3, {
									a: 3,
									b: 30,
									c: 300,
									_id: _doc3._id,
								});
								// All indexes left unchanged and pointing to the same docs
								d.indexes.a.dict.numberOfKeys.should.equal(3);
								(d.indexes.a.dict.get(1 as any)[0] as any).should.equal(doc1);
								(d.indexes.a.dict.get(2 as any)[0] as any).should.equal(doc2);
								(d.indexes.a.dict.get(3 as any)[0] as any).should.equal(doc3);
								d.indexes.b.dict.numberOfKeys.should.equal(3);
								(d.indexes.b.dict.get(10 as any)[0] as any).should.equal(doc1);
								(d.indexes.b.dict.get(20 as any)[0] as any).should.equal(doc2);
								(d.indexes.b.dict.get(30 as any)[0] as any).should.equal(doc3);
								d.indexes.c.dict.numberOfKeys.should.equal(3);
								(d.indexes.c.dict.get(100 as any)[0] as any).should.equal(doc1);
								(d.indexes.c.dict.get(200 as any)[0] as any).should.equal(doc2);
								(d.indexes.c.dict.get(300 as any)[0] as any).should.equal(doc3);
								done();
							});
						});
					});
				});
			});
			it("If a multi update violates a contraint, all changes are rolled back and an error is thrown", (done) => {
				d.ensureIndex({
					fieldName: "a",
					unique: true,
				});
				d.ensureIndex({
					fieldName: "b",
					unique: true,
				});
				d.ensureIndex({
					fieldName: "c",
					unique: true,
				});
				d.insert({
					a: 1,
					b: 10,
					c: 100,
				}).then(function (res) {
					const _doc1 = res.docs[0];
					d.insert({
						a: 2,
						b: 20,
						c: 200,
					}).then(function (res) {
						const _doc2 = res.docs[0];
						d.insert({
							a: 3,
							b: 30,
							c: 300,
						}).then(function (res) {
							const _doc3 = res.docs[0];
							// Will conflict with doc3
							rejected(() =>
								d.update(
									{
										a: {
											$in: [1, 2],
										},
									},
									{
										$inc: {
											a: 10,
											c: 1000,
										},
										$set: { b: 30 },
									},
									{ multi: true }
								)
							).then(function (isRejected) {
								expect(isRejected).eq(true);
								var data = d.getAllData(),
									doc1 = _.find(data, function (doc) {
										return doc._id === _doc1._id;
									}),
									doc2 = _.find(data, function (doc) {
										return doc._id === _doc2._id;
									}),
									doc3 = _.find(data, function (doc) {
										return doc._id === _doc3._id;
									});
								// Data left unchanged
								data.length.should.equal(3);
								assert.deepEqual(doc1, {
									a: 1,
									b: 10,
									c: 100,
									_id: _doc1._id,
								});
								assert.deepEqual(doc2, {
									a: 2,
									b: 20,
									c: 200,
									_id: _doc2._id,
								});
								assert.deepEqual(doc3, {
									a: 3,
									b: 30,
									c: 300,
									_id: _doc3._id,
								});
								// All indexes left unchanged and pointing to the same docs
								d.indexes.a.dict.numberOfKeys.should.equal(3);
								(d.indexes.a.dict.get(1 as any)[0] as any).should.equal(doc1);
								(d.indexes.a.dict.get(2 as any)[0] as any).should.equal(doc2);
								(d.indexes.a.dict.get(3 as any)[0] as any).should.equal(doc3);
								d.indexes.b.dict.numberOfKeys.should.equal(3);
								(d.indexes.b.dict.get(10 as any)[0] as any).should.equal(doc1);
								(d.indexes.b.dict.get(20 as any)[0] as any).should.equal(doc2);
								(d.indexes.b.dict.get(30 as any)[0] as any).should.equal(doc3);
								d.indexes.c.dict.numberOfKeys.should.equal(3);
								(d.indexes.c.dict.get(100 as any)[0] as any).should.equal(doc1);
								(d.indexes.c.dict.get(200 as any)[0] as any).should.equal(doc2);
								(d.indexes.c.dict.get(300 as any)[0] as any).should.equal(doc3);
								done();
							});
						});
					});
				});
			});
		});
		// ==== End of 'Updating indexes upon document update' ==== //
		describe("Updating indexes upon document remove", () => {
			it("Removing docs still works as before with indexing", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.insert({
					a: 1,
					b: "hello",
				})
					.then(function (res) {
						const _doc1 = res.docs[0];
						return d.insert({
							a: 2,
							b: "si",
						});
					})
					.then(function (res) {
						const _doc2 = res.docs[0];
						d.insert({
							a: 3,
							b: "coin",
						}).then(function (res) {
							const _doc3 = res.docs[0];
							d.remove({ a: 1 })
								.then(function (nr) {
									var data = d.getAllData(),
										doc2 = _.find(data, function (doc) {
											return doc._id === _doc2._id;
										}),
										doc3 = _.find(data, function (doc) {
											return doc._id === _doc3._id;
										});
									nr.number.should.equal(1);
									data.length.should.equal(2);
									assert.deepEqual(doc2, {
										a: 2,
										b: "si",
										_id: _doc2._id,
									});
									assert.deepEqual(doc3, {
										a: 3,
										b: "coin",
										_id: _doc3._id,
									});
									return d.remove(
										{
											a: {
												$in: [2, 3],
											},
										},
										{ multi: true }
									);
								})
								.then(function (nr) {
									var data = d.getAllData();
									nr.number.should.equal(2);
									data.length.should.equal(0);
									done();
								});
						});
					});
			});
			it("Indexes get updated when a document (or multiple documents) is removed", (done) => {
				d.ensureIndex({ fieldName: "a" });
				d.ensureIndex({ fieldName: "b" });
				d.insert({
					a: 1,
					b: "hello",
				})
					.then(function (res) {
						const doc1 = res.docs[0];
						return d.insert({
							a: 2,
							b: "si",
						});
					})
					.then(function (res) {
						const doc2 = res.docs[0];
						d.insert({
							a: 3,
							b: "coin",
						}).then(function (res) {
							const doc3 = res.docs[0];
							// Simple remove
							d.remove({ a: 1 })
								.then(function (nr) {
									nr.number.should.equal(1);
									d.indexes.a.dict.numberOfKeys.should.equal(2);
									(d.indexes.a.dict.get(2 as any)[0] as any)._id.should.equal(doc2._id);
									(d.indexes.a.dict.get(3 as any)[0] as any)._id.should.equal(doc3._id);
									d.indexes.b.dict.numberOfKeys.should.equal(2);
									(d.indexes.b.dict.get("si")[0] as any)._id.should.equal(doc2._id);
									(d.indexes.b.dict.get("coin")[0] as any)._id.should.equal(doc3._id);
									// The same pointers are shared between all indexes
									d.indexes.a.dict.numberOfKeys.should.equal(2);
									d.indexes.b.dict.numberOfKeys.should.equal(2);
									d.indexes._id.dict.numberOfKeys.should.equal(2);
									(d.indexes.a.dict.get(2 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc2._id!)[0]);
									(d.indexes.b.dict.get("si")[0] as any).should.equal(d.indexes._id.dict.get(doc2._id!)[0]);
									(d.indexes.a.dict.get(3 as any)[0] as any).should.equal(d.indexes._id.dict.get(doc3._id!)[0]);
									(d.indexes.b.dict.get("coin")[0] as any).should.equal(d.indexes._id.dict.get(doc3._id!)[0]);
									return d.remove({}, { multi: true });
								})
								.then(function (nr) {
									nr.number.should.equal(2);
									d.indexes.a.dict.numberOfKeys.should.equal(0);
									d.indexes.b.dict.numberOfKeys.should.equal(0);
									d.indexes._id.dict.numberOfKeys.should.equal(0);
									done();
								});
						});
					});
			});
		}); // ==== End of 'Updating indexes upon document remove' ==== //
		describe("Persisting indexes", function () {
			it("Indexes are persisted to a separate file and recreated upon reload", function (done) {
				var persDb = testDb;
				let db = new Datastore<any, any>({
					ref: persDb,
				});
				db.loadDatabase().then(() => {
					Object.keys(db.indexes).length.should.equal(1);
					Object.keys(db.indexes)[0].should.equal("_id");
					db.insert({ planet: "Earth" }).then(function () {
						db.insert({ planet: "Mars" }).then(function () {
							db.ensureIndex({ fieldName: "planet" }).then(function () {
								Object.keys(db.indexes).length.should.equal(2);
								Object.keys(db.indexes)[0].should.equal("_id");
								Object.keys(db.indexes)[1].should.equal("planet");
								db.indexes._id.dict.all.length.should.equal(2);
								db.indexes.planet.dict.all.length.should.equal(2);
								db.indexes.planet.fieldName.should.equal("planet");
								// After a reload the indexes are recreated
								db = new Datastore<any, any>({
									ref: persDb,
								});
								db.loadDatabase().then(function () {
									Object.keys(db.indexes).length.should.equal(2);
									Object.keys(db.indexes)[0].should.equal("_id");
									Object.keys(db.indexes)[1].should.equal("planet");
									db.indexes._id.dict.all.length.should.equal(2);
									db.indexes.planet.dict.all.length.should.equal(2);
									db.indexes.planet.fieldName.should.equal("planet");
									// After another reload the indexes are still there (i.e. they are preserved during autocompaction)
									db = new Datastore({
										ref: persDb,
									});
									db.loadDatabase().then(function () {
										Object.keys(db.indexes).length.should.equal(2);
										Object.keys(db.indexes)[0].should.equal("_id");
										Object.keys(db.indexes)[1].should.equal("planet");
										db.indexes._id.dict.all.length.should.equal(2);
										db.indexes.planet.dict.all.length.should.equal(2);
										db.indexes.planet.fieldName.should.equal("planet");
										done();
									});
								});
							});
						});
					});
				});
			});
			it("Indexes are persisted with their options and recreated even if some db operation happen between loads", function (done) {
				var persDb = testDb;
				let db = new Datastore({
					ref: persDb,
				});
				db.loadDatabase().then(() => {
					Object.keys(db.indexes).length.should.equal(1);
					Object.keys(db.indexes)[0].should.equal("_id");
					db.insert({ planet: "Earth" } as any).then(function () {
						db.insert({ planet: "Mars" } as any).then(function () {
							db.ensureIndex({
								fieldName: "planet",
								unique: true,
								sparse: false,
							}).then(function () {
								Object.keys(db.indexes).length.should.equal(2);
								Object.keys(db.indexes)[0].should.equal("_id");
								Object.keys(db.indexes)[1].should.equal("planet");
								db.indexes._id.dict.all.length.should.equal(2);
								db.indexes.planet.dict.all.length.should.equal(2);
								db.indexes.planet.unique.should.equal(true);
								db.indexes.planet.sparse.should.equal(false);
								db.insert({ planet: "Jupiter" } as any).then(function () {
									// After a reload the indexes are recreated
									db = new Datastore({
										ref: persDb,
									});
									db.loadDatabase().then(function () {
										Object.keys(db.indexes).length.should.equal(2);
										Object.keys(db.indexes)[0].should.equal("_id");
										Object.keys(db.indexes)[1].should.equal("planet");
										db.indexes._id.dict.all.length.should.equal(3);
										db.indexes.planet.dict.all.length.should.equal(3);
										db.indexes.planet.unique.should.equal(true);
										db.indexes.planet.sparse.should.equal(false);
										db.ensureIndex({
											fieldName: "bloup",
											unique: false,
											sparse: true,
										}).then(function (err) {
											Object.keys(db.indexes).length.should.equal(3);
											Object.keys(db.indexes)[0].should.equal("_id");
											Object.keys(db.indexes)[1].should.equal("planet");
											Object.keys(db.indexes)[2].should.equal("bloup");
											db.indexes._id.dict.all.length.should.equal(3);
											db.indexes.planet.dict.all.length.should.equal(3);
											db.indexes.bloup.dict.all.length.should.equal(0);
											db.indexes.planet.unique.should.equal(true);
											db.indexes.planet.sparse.should.equal(false);
											db.indexes.bloup.unique.should.equal(false);
											db.indexes.bloup.sparse.should.equal(true);
											// After another reload the indexes are still there (i.e. they are preserved during autocompaction)
											db = new Datastore({
												ref: persDb,
											});
											db.loadDatabase().then(function () {
												Object.keys(db.indexes).length.should.equal(3);
												Object.keys(db.indexes)[0].should.equal("_id");
												Object.keys(db.indexes)[1].should.equal("bloup");
												Object.keys(db.indexes)[2].should.equal("planet");
												db.indexes._id.dict.all.length.should.equal(3);
												db.indexes.planet.dict.all.length.should.equal(3);
												db.indexes.bloup.dict.all.length.should.equal(0);
												db.indexes.planet.unique.should.equal(true);
												db.indexes.planet.sparse.should.equal(false);
												db.indexes.bloup.unique.should.equal(false);
												db.indexes.bloup.sparse.should.equal(true);
												done();
											});
										});
									});
								});
							});
						});
					});
				});
			});
			it("Indexes can also be removed and the remove persisted", function (done) {
				var persDb = testDb;
				let db = new Datastore({
					ref: persDb,
				});
				db.loadDatabase().then(() => {
					Object.keys(db.indexes).length.should.equal(1);
					Object.keys(db.indexes)[0].should.equal("_id");
					db.insert({ planet: "Earth" } as any).then(function () {
						db.insert({ planet: "Mars" } as any).then(function () {
							db.ensureIndex({ fieldName: "planet" }).then(function () {
								db.ensureIndex({
									fieldName: "another",
								}).then(function () {
									Object.keys(db.indexes).length.should.equal(3);
									Object.keys(db.indexes)[0].should.equal("_id");
									Object.keys(db.indexes)[1].should.equal("planet");
									Object.keys(db.indexes)[2].should.equal("another");
									db.indexes._id.dict.all.length.should.equal(2);
									db.indexes.planet.dict.all.length.should.equal(2);
									db.indexes.planet.fieldName.should.equal("planet");
									// After a reload the indexes are recreated
									db = new Datastore({
										ref: persDb,
									});
									db.loadDatabase().then(function () {
										Object.keys(db.indexes).length.should.equal(3);
										Object.keys(db.indexes)[0].should.equal("_id");
										Object.keys(db.indexes)[1].should.equal("another");
										Object.keys(db.indexes)[2].should.equal("planet");
										db.indexes._id.dict.all.length.should.equal(2);
										db.indexes.planet.dict.all.length.should.equal(2);
										db.indexes.planet.fieldName.should.equal("planet");
										// Index is removed
										db.removeIndex("planet").then(function () {
											Object.keys(db.indexes).length.should.equal(2);
											Object.keys(db.indexes)[0].should.equal("_id");
											Object.keys(db.indexes)[1].should.equal("another");
											db.indexes._id.dict.all.length.should.equal(2);
											// After a reload indexes are preserved
											db = new Datastore({
												ref: persDb,
											});
											db.loadDatabase().then(function () {
												Object.keys(db.indexes).length.should.equal(2);
												Object.keys(db.indexes)[0].should.equal("_id");
												Object.keys(db.indexes)[1].should.equal("another");
												db.indexes._id.dict.all.length.should.equal(2);
												// After another reload the indexes are still there (i.e. they are preserved during autocompaction)
												db = new Datastore({
													ref: persDb,
												});
												db.loadDatabase().then(function () {
													Object.keys(db.indexes).length.should.equal(2);
													Object.keys(db.indexes)[0].should.equal("_id");
													Object.keys(db.indexes)[1].should.equal("another");
													db.indexes._id.dict.all.length.should.equal(2);
													done();
												});
											});
										});
									});
								});
							});
						});
					});
				});
			});
		});
		// ==== End of 'Persisting indexes' ====
		it("Results of dict.get should never contain duplicates", function (done) {
			d.ensureIndex({ fieldName: "bad" });
			d.insert({
				bad: ["a", "b"],
			}).then(function () {
				Promise.resolve(
					d.getCandidates({
						bad: {
							$in: ["a", "b"],
						},
					})
				).then(function (res) {
					res.length.should.equal(1);
					done();
				});
			});
		});
	}); // ==== End of 'Using indexes' ==== //
});
