/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../node_modules/@types/underscore/index.d.ts" />

import xwebdb from "../../dist/xwebdb.js";
import underscore from "../../node_modules/underscore/underscore.js";

const customUtils = xwebdb._internal.customUtils;
const _: any = underscore;
const { Datastore, modelling: model } = xwebdb._internal;

const assert = chai.assert;

const testDb = "testdatabase";

describe("Persistence", () => {
	let d = new Datastore({
		ref: testDb,
		defer: 0,
		stripDefaults: false,
	});
	beforeEach(async () => {
		d = new Datastore({
			ref: testDb,
			defer: 0,
			stripDefaults: false,
		});
		d.ref.should.equal(testDb);
		await d.loadDatabase();
		d.getAllData().length.should.equal(0);
	});
	afterEach(async function () {
		this.timeout(6000 * 1000);
		await d.persistence.deleteEverything();
	});

	it("Every line represents a document", async () => {
		const now = new Date();

		await d.persistence.data.set(
			"1",
			model.serialize({
				_id: "1",
				a: 2,
				ages: [1, 5, 12],
			})
		);
		await d.persistence.data.set(
			"2",
			model.serialize({
				_id: "2",
				hello: "world",
			})
		);
		await d.persistence.data.set("3", model.serialize({ _id: "3", nested: { today: now } }));
		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();

		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => (_id1 as any) - (_id2 as any));
		treatedData.length.should.equal(3);
		_.isEqual(treatedData[0], {
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		}).should.equal(true);
		_.isEqual(treatedData[1], { _id: "2", hello: "world" }).should.equal(true);
		_.isEqual(treatedData[2], {
			_id: "3",
			nested: { today: now },
		}).should.equal(true);
	});

	it("Badly formatted lines have no impact on the treated data", async () => {
		const now = new Date();
		const obj1 = {
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		};
		const obj2 = {
			_id: "3",
			nested: { today: now },
		};
		d.persistence.corruptAlertThreshold = 0.34;
		await d.persistence.data.set("1", model.serialize(obj1));
		await d.persistence.data.set("#", "garbage");
		await d.persistence.data.set("2", model.serialize(obj2));
		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();
		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => _id1 - _id2);
		treatedData.length.should.equal(2);
		_.isEqual(treatedData[0], obj1).should.equal(true);
		_.isEqual(treatedData[1], obj2).should.equal(true);
	});

	it("Well formatted lines that have no _id are not included in the data", async () => {
		const now = new Date();

		await d.persistence.data.set(
			"1",
			model.serialize({
				_id: "1",
				a: 2,
				ages: [1, 5, 12],
			})
		);
		await d.persistence.data.set(
			"1",
			model.serialize({
				_id: "1",
				a: 2,
				ages: [1, 5, 12],
			})
		);
		await d.persistence.data.set(
			"2",
			model.serialize({
				_id: "2",
				hello: "world",
			})
		);
		await d.persistence.data.set("#", model.serialize({ nested: { today: now } }));
		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();
		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => _id1 - _id2);
		treatedData.length.should.equal(2);
		_.isEqual(treatedData[0], {
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		}).should.equal(true);
		_.isEqual(treatedData[1], { _id: "2", hello: "world" }).should.equal(true);
	});

	it("If a doc contains $$deleted: true, that means we need to remove it from the data", async () => {
		const now = new Date();

		const rawData = `${model.serialize({
			_id: "2",
			hello: "world",
		})}\n${model.serialize({
			_id: "1",
			$$deleted: true,
		})}\n${model.serialize({ _id: "3", today: now })}`;

		await Promise.all(
			rawData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);

		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();
		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => _id1 - _id2);
		treatedData.length.should.equal(2);
		_.isEqual(treatedData[0], { _id: "2", hello: "world" }).should.equal(true);
		_.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
	});

	it("If a doc contains $$deleted: true, no error is thrown if the doc wasnt in the list before", async () => {
		const now = new Date();

		const rawData = `${model.serialize({
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		})}\n${model.serialize({
			_id: "2",
			$$deleted: true,
		})}\n${model.serialize({ _id: "3", today: now })}`;

		await Promise.all(
			rawData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);

		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();
		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => _id1 - _id2);
		treatedData.length.should.equal(2);
		_.isEqual(treatedData[0], {
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		}).should.equal(true);
		_.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
	});

	it("If a doc contains $$indexCreated, no error is thrown during treatRawData and we can get the index options", async () => {
		const now = new Date();
		const rawData = `${model.serialize({
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		})}\n${model.serialize({ _id: "3", today: now })}`;
		const rawIndexes = `${model.serialize({
			$$indexCreated: { fieldName: "test", unique: true, sparse: true },
		})}`;
		await Promise.all(
			rawData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);
		await Promise.all(
			rawIndexes.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);
		await d.loadDatabase();
		const treatedData: any[] = d.getAllData();
		const indexes = d.indexes;
		Object.keys(indexes).length.should.equal(2);

		assert.deepEqual(
			{
				fieldName: indexes.test.fieldName,
				unique: indexes.test.unique,
				sparse: true,
			},
			{ fieldName: "test", unique: true, sparse: true }
		);

		treatedData.sort(({ _id: _id1 }, { _id: _id2 }) => _id1 - _id2);
		treatedData.length.should.equal(2);
		_.isEqual(treatedData[0], {
			_id: "1",
			a: 2,
			ages: [1, 5, 12],
		}).should.equal(true);
		_.isEqual(treatedData[1], { _id: "3", today: now }).should.equal(true);
	});

	it("Calling loadDatabase after the data was modified doesnt change its contents", async () => {
		await d.loadDatabase();
		await d.insert({ a: 1 } as any);
		await d.insert({ a: 2 } as any);
		{
			const data = d.getAllData();
			const doc1 = _.find(data, ({ a }) => a === 1);
			const doc2 = _.find(data, ({ a }) => a === 2);
			data.length.should.equal(2);
			doc1!.a.should.equal(1);
			doc2!.a.should.equal(2);
		}
		{
			await d.loadDatabase();
			const data = d.getAllData();
			const doc1 = _.find(data, ({ a }) => a === 1);
			const doc2 = _.find(data, ({ a }) => a === 2);
			data.length.should.equal(2);
			doc1!.a.should.equal(1);
			doc2!.a.should.equal(2);
		}
	});

	it("Calling loadDatabase after the datafile was removed will reset the database", async () => {
		await d.loadDatabase();
		await d.insert({ a: 1 } as any);
		await d.insert({ a: 2 } as any);
		const data = d.getAllData();
		const doc1 = _.find(data, ({ a }) => a === 1);
		const doc2 = _.find(data, ({ a }) => a === 2);
		data.length.should.equal(2);
		doc1!.a.should.equal(1);
		doc2!.a.should.equal(2);
		await d.persistence.deleteEverything();
		await d.loadDatabase();
		d.getAllData().length.should.equal(0);
	});

	it("Calling loadDatabase after the datafile was modified loads the new data", async () => {
		{
			await d.loadDatabase();
			await d.insert({ a: 1 } as any);
			await d.insert({ a: 2 } as any);
			const data = d.getAllData();
			const doc1 = _.find(data, ({ a }) => a === 1);
			const doc2 = _.find(data, ({ a }) => a === 2);
			data.length.should.equal(2);
			doc1!.a.should.equal(1);
			doc2!.a.should.equal(2);
		}
		{
			await d.persistence.deleteEverything();
			await d.persistence.data.set("aaa", model.serialize({ a: 3, _id: "aaa" }));
			await d.loadDatabase();
			const data = d.getAllData();
			const doc1 = _.find(data, ({ a }) => a === 1);
			const doc2 = _.find(data, ({ a }) => a === 2);
			const doc3 = _.find(data, ({ a }) => a === 3);
			data.length.should.equal(1);
			doc3!.a.should.equal(3);
			assert.isUndefined(doc1);
			assert.isUndefined(doc2);
		}
	});

	const fakeData =
		'{"_id":"one","hello":"world"}\n' +
		"Some corrupt data\n" +
		'{"_id":"two","hello":"earth"}\n' +
		'{"_id":"three","hello":"you"}\n';

	it("When treating raw data, refuse to proceed if too much data is corrupt, to avoid data loss", async () => {
		await Promise.all(
			fakeData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);

		// Default corruptAlertThreshold
		d = new Datastore({
			ref: testDb,
			defer: 0,
			stripDefaults: false,
		});

		let loaded = 0;
		try {
			await d.loadDatabase();
			loaded = 1;
		} catch (e) {
			loaded = -1;
		}

		loaded.should.be.eq(-1);
	});

	it("accepts corrupted data on a certain threshold", async () => {
		await Promise.all(
			fakeData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);
		d = new Datastore({
			ref: testDb,
			corruptAlertThreshold: 1,
			defer: 0,
			stripDefaults: false,
		});

		let loaded = 0;
		try {
			await d.loadDatabase();
			loaded = 1;
		} catch (e) {
			loaded = -1;
		}

		loaded.should.be.eq(1);
	});

	it("rejects corrupted data on a certain threshold", async () => {
		await Promise.all(
			fakeData.split("\n").map((data) => {
				return d.persistence.data.set(data, data);
			})
		);
		d = new Datastore({
			ref: testDb,
			corruptAlertThreshold: 0,
			defer: 0,
			stripDefaults: false,
		});

		let loaded = 0;
		try {
			await d.loadDatabase();
			loaded = 1;
		} catch (e) {
			loaded = -1;
		}

		loaded.should.be.eq(-1);
	});

	describe("Serialization hooks", () => {
		const as = (s: string) => `before_${s}_after`;
		const bd = (s: string) => s.substring(7, s.length - 6);

		it("Declaring only one hook will throw an exception to prevent data loss", async () => {
			await d.persistence.data.set("#", "some content");
			(() => {
				new Datastore({
					ref: testDb,
					encode: as,
					defer: 0,
					stripDefaults: false,
				});
			}).should.throw();

			// Data file left untouched
			chai.expect(await d.persistence.data.get("#")).to.eq("some content");

			(() => {
				new Datastore({
					ref: testDb,
					decode: bd,
					defer: 0,
					stripDefaults: false,
				});
			}).should.throw();

			// Data file left untouched
			chai.expect(await d.persistence.data.get("#")).to.eq("some content");
		});

		it("Declaring two hooks that are not reverse of one another will cause an exception to prevent data loss", async () => {
			await d.persistence.data.set("#", "some content");
			(() => {
				new Datastore({
					ref: testDb,
					encode: as,
					decode(s) {
						return s;
					},
					defer: 0,
					stripDefaults: false,
				});
			}).should.throw();

			// Data file left untouched
			chai.expect(await d.persistence.data.get("#")).to.eq("some content");
		});

		it("A serialization hook can be used to transform data before writing new state to disk: test subject A", async () => {
			const d = new Datastore({
				ref: testDb,
				encode: as,
				decode: bd,
				defer: 0,
				stripDefaults: false,
			});
			await d.loadDatabase();
			await d.insert({ _id: "id1", hello: "world" });
			await d.insert({ _id: "id2", hello: "world again" });
			const doc0 = (await d.persistence.data.values()).find((x) => x.indexOf('"id1"') > -1) as string;
			let docBD0 = bd(doc0);

			doc0.substring(0, 7).should.equal("before_");
			doc0.substring(doc0.length - 6).should.equal("_after");

			docBD0 = model.deserialize(docBD0);
			chai.expect(Object.keys(docBD0).length).eq(2);
			chai.expect((docBD0 as any).hello).eq("world");
		});

		it("A serialization hook can be used to transform data before writing new state to disk: test subject B", async () => {
			const d = new Datastore({
				ref: testDb,
				encode: as,
				decode: bd,
				defer: 0,
				stripDefaults: false,
			});
			await d.loadDatabase();
			await d.insert({ _id: "id1", p: "Mars" });
			await d.insert({ _id: "id2", p: "Jupiter" });

			const doc0 = (await d.persistence.data.values()).find((x) => x.indexOf('"id1"') > -1) as string;
			let docBD0 = bd(doc0);

			const doc1 = (await d.persistence.data.values()).find((x) => x.indexOf('"id2"') > -1) as string;
			let docBD1 = bd(doc1);

			doc0.substring(0, 7).should.equal("before_");
			doc0.substring(doc0.length - 6).should.equal("_after");
			doc1.substring(0, 7).should.equal("before_");
			doc1.substring(doc1.length - 6).should.equal("_after");

			docBD0 = model.deserialize(docBD0);
			Object.keys(docBD0).length.should.equal(2);
			(docBD0 as any).p.should.equal("Mars");

			docBD1 = model.deserialize(docBD1);
			Object.keys(docBD1).length.should.equal(2);
			(docBD1 as any).p.should.equal("Jupiter");
		});

		it("A serialization hook can be used to transform data before writing new state to disk: testing indexes", async () => {
			const d = new Datastore({
				ref: testDb,
				encode: as,
				decode: bd,
				defer: 0,
				stripDefaults: false,
			});
			await d.loadDatabase();
			await d.ensureIndex({ fieldName: "idefix" });

			await d.insert({ _id: "id1", p: "Mars" });

			const doc0 = (await d.persistence.data.values()).find((x) => x.indexOf('"id1"') > -1) as string;
			let docBD0 = bd(doc0);

			const index0 = (await d.persistence.data.values()).find((x) => x.indexOf('"idefix"') > -1) as string;
			let indexBD0 = bd(index0);

			doc0.substring(0, 7).should.equal("before_");
			doc0.substring(doc0.length - 6).should.equal("_after");
			index0.substring(0, 7).should.equal("before_");
			index0.substring(index0.length - 6).should.equal("_after");

			docBD0 = model.deserialize(docBD0);
			Object.keys(docBD0).length.should.equal(2);
			(docBD0 as any).p.should.equal("Mars");

			indexBD0 = model.deserialize(indexBD0);
			assert.deepEqual(indexBD0 as any, {
				$$indexCreated: { fieldName: "idefix" },
			});
		});

		it("Deserialization hook is correctly used when loading data", async () => {
			const d = new Datastore({
				ref: testDb,
				encode: as,
				decode: bd,
				defer: 0,
				stripDefaults: false,
			});
			await d.loadDatabase();

			const doc = (await d.insert({ hello: "world" } as any)).docs[0];
			const _id = (doc as any)._id;

			await d.insert({ yo: "ya" } as any);
			await d.update({ hello: "world" }, { $set: { hello: "earth" } }, {});
			await d.remove({ yo: "ya" });
			await d.ensureIndex({ fieldName: "idefix" });

			chai.expect(await d.persistence.data.length()).eq(2);
			{
				// Everything is deserialized correctly, including deletes and indexes
				const d = new Datastore({
					ref: testDb,
					encode: as,
					decode: bd,
					defer: 0,
					stripDefaults: false,
				});
				await d.loadDatabase();
				const docs = await d.find({});
				docs.length.should.equal(1);
				(docs[0] as any).hello.should.equal("earth");
				(docs[0] as any)._id.should.equal(_id);
				Object.keys(d.indexes).length.should.equal(2);
				Object.keys(d.indexes).indexOf("idefix").should.not.equal(-1);
			}
		});
	}); // ==== End of 'Serialization hooks' ==== //

	describe.skip("Dealing with large databases", function () {
		this.timeout(6000 * 1000);
		// preparation

		async function prepare() {
			const limit = 4000; // means 1 GB of data
			for (let i = 0; i < limit; i++) {
				let doc = {
					_id: "_id",
					text: "Malesuada proin libero nunc consequat interdum varius sit. Sed arcu non odio euismod lacinia at quis risus sed. Nunc mattis enim ut tellus elementum. Nec tincidunt praesent semper feugiat nibh sed pulvinar proin. Sodales neque sodales ut etiam sit. Ultrices in iaculis nunc sed augue lacus viverra vitae. Nulla facilisi etiam dignissim diam quis enim. Suspendisse interdum consectetur libero id faucibus nisl tincidunt eget. Viverra nam libero justo laoreet sit amet cursus sit. Convallis aenean et tortor at risus viverra adipiscing at in. Velit ut tortor pretium viverra suspendisse. Semper viverra nam libero justo. Non enim praesent elementum facilisis leo vel fringilla est.",
					arr: ["a"],
					name: "",
				};
				doc._id = customUtils.randomString(100);
				if (i === 987) {
					doc._id = "known";
					doc.name = "alex";
				}
				for (let i = 0; i < 10; i++) {
					doc.arr.push(customUtils.randomString(10));
				}
				d.persistence.data.set(doc._id, model.serialize(doc));
			}
		}

		const big = new Datastore({
			ref: testDb,
			defer: 0,
			stripDefaults: false,
		});

		it("Loading the database", async function () {
			await prepare();
			await big.loadDatabase();
			const found: any[] = await big.find({ _id: "known" });
			assert.isDefined(found[0]);
			chai.expect(found[0].name).eq("alex");
		});
		it("Writing the database", async function () {
			await big.insert({ _id: "known2", name: "william" });
			const found: any[] = await big.find({ _id: "known2" });
			assert.isDefined(found[0]);
			chai.expect(found[0].name).eq("william");
		});
	}); // ==== End of 'ensureFileDoesntExist' ====
});
