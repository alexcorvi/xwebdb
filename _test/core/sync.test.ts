/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/index.d.ts" />
import unifydb from "../../dist/unifydb.js";
const { Database, BaseModel } = unifydb;
class Kid extends BaseModel<Kid> {
	name: string;
	age: number;
}

describe("Database Syncing", () => {
	let d1 = new Database<{ _id: string; name: string; age: number }>({
		ref: "db_1",
		syncToRemote: unifydb.adapters.memoryAdapter("", ""),
		syncInterval: 9999999999999,
	});
	let d2 = new Database<{ _id: string; name: string; age: number }>({
		ref: "db_2",
		syncToRemote: unifydb.adapters.memoryAdapter("", ""),
		syncInterval: 9999999999999,
	});
	beforeEach(async () => {
		Object.keys(unifydb.adapters.memoryStores).forEach((dbName) => {
			unifydb.adapters.memoryStores[dbName] = {};
		});
		await d1._datastore.persistence.deleteEverything();
		await d2._datastore.persistence.deleteEverything();
		await d1._datastore.loadDatabase();
		d1._datastore.getAllData().length.should.equal(0);
		await d2._datastore.loadDatabase();
		d2._datastore.getAllData().length.should.equal(0);
	});

	describe("Unilateral Syncing (From A to B, i.e. there's no sending when receiving)", () => {
		it("Addition", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			await d1.insert([doc]);

			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.received.should.eq(0);
			s1.sent.should.eq(1);
			s2.sent.should.eq(0);
			s2.received.should.eq(1);

			const resOnD2 = await d2.find({ filter: { age: 12 } });
			resOnD2.length.should.eq(1);
			resOnD2[0].name.should.eq("alex");
			resOnD2[0]._id.should.eq(doc._id);

			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Update", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			await d1.insert([doc]);

			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.received.should.eq(0);
			s1.sent.should.eq(1);
			s2.sent.should.eq(0);
			s2.received.should.eq(1);

			const resOnD2 = await d2.find({ filter: { age: 12 } });
			resOnD2.length.should.eq(1);
			resOnD2[0].name.should.eq("alex");
			resOnD2[0]._id.should.eq(doc._id);

			{
				await d1.update({
					filter: { age: 12 },
					update: { $set: { age: 13 } },
				});
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				s1.received.should.eq(0);
				s1.sent.should.eq(1);
				s2.sent.should.eq(0);
				s2.received.should.eq(1);
				const resOnD2 = await d2.find({ filter: { age: 13 } });
				resOnD2.length.should.eq(1);
				resOnD2[0].name.should.eq("alex");
				resOnD2[0]._id.should.eq(doc._id);
			}
			{
				await d2.update({
					filter: { age: 13 },
					update: { $set: { age: 14 } },
				});
				const s2 = await d2.sync();
				const s1 = await d1.sync();
				s1.received.should.eq(1);
				s1.sent.should.eq(0);
				s2.sent.should.eq(1);
				s2.received.should.eq(0);
				const resOnD1 = await d2.find({ filter: { age: 14 } });
				resOnD1.length.should.eq(1);
				resOnD1[0].name.should.eq("alex");
				resOnD1[0]._id.should.eq(doc._id);
			}
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Removal", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			await d1.insert([doc]);

			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.received.should.eq(0);
			s1.sent.should.eq(1);
			s2.sent.should.eq(0);
			s2.received.should.eq(1);

			const resOnD2 = await d2.find({ filter: { age: 12 } });
			resOnD2.length.should.eq(1);
			resOnD2[0].name.should.eq("alex");
			resOnD2[0]._id.should.eq(doc._id);

			{
				await d1.remove({ filter: { age: 12 } });
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				s1.received.should.eq(0);
				s1.sent.should.eq(1);
				s2.sent.should.eq(0);
				s2.received.should.eq(1);
				const resOnD2 = await d2.find({ filter: { age: 12 } });
				resOnD2.length.should.eq(0);
			}
			{
				const resOnD2 = await d2.find({});
				resOnD2.length.should.eq(0);
			}
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Multiple removals", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			const doc2 = Kid.new({
				name: "marc",
				age: 13,
			});
			await d1.insert([doc, doc2]);

			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.received.should.eq(0);
			s1.sent.should.eq(2);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const resOnD2 = await d2.find({});
			resOnD2.length.should.eq(2);
			{
				await d2.remove({ filter: {}, multi: true });
				const s2 = await d2.sync();
				const s1 = await d1.sync();
				s1.received.should.eq(2);
				s1.sent.should.eq(0);
				s2.sent.should.eq(2);
				s2.received.should.eq(0);
				(await d1.find({})).length.should.eq(0);
			}
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Addition + Update", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			const doc2 = Kid.new({
				name: "marc",
				age: 13,
			});
			await d1.insert([doc, doc2]);
			await d1.update({
				filter: { name: "marc" },
				update: { $inc: { age: 5 } },
			});
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ filter: { name: "alex" } }))[0];
			const marc = (await d2.find({ filter: { name: "marc" } }))[0];
			const all = await d2.find({});

			all.length.should.eq(2);
			alex.age.should.eq(12);
			marc.age.should.eq(18);
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Addition + Removal", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			const doc2 = Kid.new({
				name: "marc",
				age: 13,
			});
			await d1.insert([doc, doc2]);
			await d1.remove({ filter: { name: "marc" } });
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ filter: { name: "alex" } }))[0];
			const marc = await d2.find({ filter: { name: "marc" } });
			const all = await d2.find({});

			all.length.should.eq(1);
			alex.age.should.eq(12);
			marc.length.should.eq(0);
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Addition + Update + Removal", async () => {
			const doc = Kid.new({
				name: "alex",
				age: 12,
			});
			const doc2 = Kid.new({
				name: "marc",
				age: 13,
			});
			await d1.insert([doc, doc2]);
			await d1.update({
				filter: { name: "alex" },
				update: { $set: { age: 5 } },
			});
			await d1.update({
				filter: { name: "marc" },
				update: { $set: { age: 2 } },
			});
			await d1.remove({ filter: { name: "marc" } });
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ filter: { name: "alex" } }))[0];
			const marc = await d2.find({ filter: { name: "marc" } });
			const all = await d2.find({});

			all.length.should.eq(1);
			alex.age.should.eq(5);
			marc.length.should.eq(0);
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Addition + Update + Removal (many docs)", async function () {
			this.timeout(1000 * 60 * 2);
			const names = ["Alex", "David", "Bill", "William", "Ron", "Sam", "Jim", "Tim", "Charles", "Will", "Bob"];
			const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
			let docs: Kid[] = [];
			let i = 100;
			while (i--) {
				docs.push(
					Kid.new({
						name: names[Math.floor(Math.random() * names.length)],
						age: ages[Math.floor(Math.random() * ages.length)],
					})
				);
			}
			await d1.insert(docs);
			const update = await d1.update({
				filter: { name: "Alex" },
				update: { $set: { age: 10 } },
				multi: true,
			});
			const removal = await d1.remove({
				filter: { name: "Ron" },
				multi: true,
			});
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(docs.length);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(docs.length);

			const all = await d2.find({});
			const alex = await d2.find({ filter: { name: "alex" } });
			const ron = await d2.find({ filter: { name: "Ron" } });

			all.length.should.eq(docs.length - removal.number);
			alex.filter((x) => x.age === 10).length.should.eq(alex.length);
			ron.length.should.eq(0);
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
		it("Adding a third clean database afer many events and syncs between the first two", async function () {
			this.timeout(1000 * 60 * 2);
			const doc = Kid.new({
				age: 5,
				name: "may",
			});
			const doc2 = Kid.new({
				age: 12,
				name: "jim",
			});
			await d1.insert([doc, doc2]);

			await d1.update({
				filter: { name: "may" },
				update: { $set: { age: 3 } },
			});
			await d1.update({
				filter: { name: "jim" },
				update: { $set: { age: 4 } },
			});
			await d1.sync();
			await d2.sync();

			await d2.update({
				filter: { name: "may" },
				update: { $set: { age: 2 } },
			});
			await d2.update({
				filter: { name: "jim" },
				update: { $set: { age: 3 } },
			});
			await d2.sync();
			await d1.sync();

			await d1.update({
				filter: { name: "may" },
				update: { $set: { age: 11 } },
			});
			await d1.update({
				filter: { name: "jim" },
				update: { $set: { age: 12 } },
			});
			await d1.sync();
			await d2.sync();
			await d1.sync();

			let d3 = new Database<{ _id: string; name: string; age: number }>({
				ref: "db_3",
				syncToRemote: unifydb.adapters.memoryAdapter("", ""),
				syncInterval: 9999999999999,
			});
			// start by cleaning it
			await d3._datastore.persistence.deleteEverything();

			await d3.sync();

			const onD1 = await d1.find({
				filter: { $or: [{ name: "may" }, { name: "jim" }] },
			});
			const onD2 = await d2.find({
				filter: { $or: [{ name: "may" }, { name: "jim" }] },
			});
			const onD3 = await d3.find({
				filter: { $or: [{ name: "may" }, { name: "jim" }] },
			});

			console.log(onD1, onD2, onD3);

			onD1.length.should.eq(2);
			onD2.length.should.eq(2);
			onD3.length.should.eq(2);

			onD1.find((x) => x.name === "jim")!.age.should.eq(12);
			onD2.find((x) => x.name === "jim")!.age.should.eq(12);
			onD3.find((x) => x.name === "jim")!.age.should.eq(12);

			onD1.find((x) => x.name === "may")!.age.should.eq(11);
			onD2.find((x) => x.name === "may")!.age.should.eq(11);
			onD3.find((x) => x.name === "may")!.age.should.eq(11);

			// clean d3
			await d3._datastore.persistence.deleteEverything();
			{
				// hashes are equal
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();
				const s4 = await d2.sync();
				(s1.diff === -1 || s1.diff === 0).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
				s4.diff.should.eq(-1);
			}
		});
	});

	describe("Bilateral Syncing (On both A and B)", async () => {
		describe("Different documents", async () => {
			it("Addition: Both databases added documents", async () => {
				const doc = Kid.new({
					age: 5,
					name: "may",
				});
				const doc2 = Kid.new({
					age: 12,
					name: "jim",
				});
				await d1.insert([doc]);
				await d2.insert([doc2]);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(1);
				s2.sent.should.eq(1);
				s2.received.should.eq(1);
				s3.received.should.eq(1);
				s3.sent.should.eq(0);

				const onD1 = await d1.find({
					filter: { $or: [{ name: "may" }, { name: "jim" }] },
				});
				const onD2 = await d2.find({
					filter: { $or: [{ name: "may" }, { name: "jim" }] },
				});

				onD1.length.should.eq(2);
				onD2.length.should.eq(2);

				onD1.find((x) => x.name === "jim")!.age.should.eq(12);
				onD1.find((x) => x.name === "may")!.age.should.eq(5);

				onD2.find((x) => x.name === "jim")!.age.should.eq(12);
				onD2.find((x) => x.name === "may")!.age.should.eq(5);

				{
					// same as above with more documents
					const docs1 = [
						Kid.new({
							age: 10,
							name: "ten",
						}),
						Kid.new({
							age: 1,
							name: "one",
						}),
					];
					const docs2 = [
						Kid.new({
							age: 6,
							name: "six",
						}),
						Kid.new({
							age: 2,
							name: "two",
						}),
					];
					await d1.insert(docs1);
					await d2.insert(docs2);

					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();

					s1.received.should.eq(0);
					s1.sent.should.eq(2);
					s2.sent.should.eq(2);
					s2.received.should.eq(2);
					s3.received.should.eq(2);
					s3.sent.should.eq(0);

					// all documents
					const onD1All = await d1.find({});
					const onD2All = await d2.find({});

					onD1All.length.should.eq(6);
					onD2All.length.should.eq(6);

					{
						// old documents
						const onD1 = await d1.find({
							filter: { $or: [{ name: "may" }, { name: "jim" }] },
						});
						const onD2 = await d2.find({
							filter: { $or: [{ name: "may" }, { name: "jim" }] },
						});

						onD1.length.should.eq(2);
						onD2.length.should.eq(2);

						onD1.find((x) => x.name === "jim")!.age.should.eq(12);
						onD2.find((x) => x.name === "may")!.age.should.eq(5);

						onD1.find((x) => x.name === "jim")!.age.should.eq(12);
						onD2.find((x) => x.name === "may")!.age.should.eq(5);
					}

					// new documents
					const onD1 = await d1.find({
						filter: { name: { $in: ["one", "two", "six", "ten"] } },
					});
					const onD2 = await d2.find({
						filter: { name: { $in: ["one", "two", "six", "ten"] } },
					});

					onD1.length.should.eq(4);
					onD2.length.should.eq(4);

					onD1.find((x) => x.name === "one")!.age.should.eq(1);
					onD1.find((x) => x.name === "two")!.age.should.eq(2);
					onD1.find((x) => x.name === "six")!.age.should.eq(6);
					onD1.find((x) => x.name === "ten")!.age.should.eq(10);

					onD2.find((x) => x.name === "one")!.age.should.eq(1);
					onD2.find((x) => x.name === "two")!.age.should.eq(2);
					onD2.find((x) => x.name === "six")!.age.should.eq(6);
					onD2.find((x) => x.name === "ten")!.age.should.eq(10);
				}
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Update", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.update({
					filter: { name: "one" },
					update: { $mul: { age: 2 } },
				});
				await d2.update({
					filter: { name: "two" },
					update: { $mul: { age: 2 } },
				});

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(1);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "one" } }))[0].age.should.eq(2);
				(await d1.find({ filter: { name: "two" } }))[0].age.should.eq(4);
				(await d1.find({ filter: { name: "six" } }))[0].age.should.eq(6); // not updated
				(await d1.find({ filter: { name: "ten" } }))[0].age.should.eq(10); // not updated

				(await d2.find({ filter: { name: "one" } }))[0].age.should.eq(2);
				(await d2.find({ filter: { name: "two" } }))[0].age.should.eq(4);
				(await d2.find({ filter: { name: "six" } }))[0].age.should.eq(6); // not updated
				(await d2.find({ filter: { name: "ten" } }))[0].age.should.eq(10); // not updated
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Removal", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.remove({ filter: { name: "one" } });
				await d2.remove({ filter: { name: "two" } });

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(1);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "six" } })).length.should.eq(1); // not removed
				(await d1.find({ filter: { name: "ten" } })).length.should.eq(1); // not removed

				(await d2.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(1); // not removed
				(await d2.find({ filter: { name: "ten" } })).length.should.eq(1); // not removed
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Removal of many docs", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.remove({
					filter: { name: { $in: ["one", "two"] } },
					multi: true,
				});
				await d2.remove({
					filter: { name: { $in: ["six", "ten"] } },
					multi: true,
				});
				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(2);
					s2.sent.should.eq(2);
					s2.received.should.eq(2);
					s3.sent.should.eq(0);
					s3.received.should.eq(2);
				}

				(await d1.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "ten" } })).length.should.eq(0);

				(await d2.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "ten" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Addition + Update", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);
				await d1.update({
					filter: { name: "one" },
					update: { $set: { age: 1111 } },
				});
				await d1.update({
					filter: { name: "ten" },
					update: { $set: { age: 1010 } },
				});
				await d2.update({
					filter: { name: "six" },
					update: { $set: { age: 6666 } },
				});
				await d2.update({
					filter: { name: "two" },
					update: { $set: { age: 2222 } },
				});

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ filter: { name: "one" } }))[0].age.should.eq(1111);
				(await d1.find({ filter: { name: "two" } }))[0].age.should.eq(2222);
				(await d1.find({ filter: { name: "six" } }))[0].age.should.eq(6666);
				(await d1.find({ filter: { name: "ten" } }))[0].age.should.eq(1010);

				(await d2.find({ filter: { name: "one" } }))[0].age.should.eq(1111);
				(await d2.find({ filter: { name: "two" } }))[0].age.should.eq(2222);
				(await d2.find({ filter: { name: "six" } }))[0].age.should.eq(6666);
				(await d2.find({ filter: { name: "ten" } }))[0].age.should.eq(1010);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Addition + Removal", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);
				await d1.remove({ filter: { name: "one" } });
				await d1.remove({ filter: { name: "ten" } });
				await d2.remove({ filter: { name: "six" } });
				await d2.remove({ filter: { name: "two" } });

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "ten" } })).length.should.eq(0);

				(await d2.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "ten" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Addition + Update + Removal", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);
				await d1.update({
					filter: { name: "one" },
					update: { $set: { age: 1111 } },
				});
				await d1.update({
					filter: { name: "ten" },
					update: { $set: { age: 1010 } },
				});
				await d2.update({
					filter: { name: "six" },
					update: { $set: { age: 6666 } },
				});
				await d2.update({
					filter: { name: "two" },
					update: { $set: { age: 2222 } },
				});
				await d1.remove({ filter: { name: "one" } });
				await d1.remove({ filter: { name: "ten" } });
				await d2.remove({ filter: { name: "six" } });
				await d2.remove({ filter: { name: "two" } });

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d1.find({ filter: { name: "ten" } })).length.should.eq(0);

				(await d2.find({ filter: { name: "one" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "two" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "ten" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
		});
		describe("Same document (Conflict resolution)", async () => {
			it("Removal from both databases", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.remove({ filter: { name: "six" } });
				await d2.remove({ filter: { name: "six" } });
				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(0);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}
				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Update on both", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.update({
					filter: { name: "six" },
					update: { $set: { age: 61 } },
				});
				await d2.update({
					filter: { name: "six" },
					update: { $set: { age: 62 } },
				});

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(0);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				(await d2.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Remove vs. Update (remove should win)", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.update({
					filter: { name: "six" },
					update: { $set: { age: 61 } },
				});
				await d2.remove({
					filter: { name: "six" }
				});

				{
					const s1 = await d2.sync();
					const s2 = await d1.sync();
					const s3 = await d2.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(0);
					s2.received.should.eq(1);
					s3.received.should.eq(0);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Remove vs. Update (update should win)", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d2.remove({
					filter: { name: "six" },
				});
				await d1.update({
					filter: { name: "six" },
					update: { $set: { age: 62 } },
				});

				{
					const s1 = await d2.sync();
					const s2 = await d1.sync();
					const s3 = await d2.sync();

					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(0);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				(await d2.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Remove vs. Update (remove should win) (no matter the order of sync)", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d2.sync();
				const s2 = await d1.sync();
				const s3 = await d2.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.update({
					filter: { name: "six" },
					update: { $set: { age: 61 } },
				});
				await d2.remove({
					filter: { name: "six" }
				});

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(1);
					s2.received.should.eq(0);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "six" } })).length.should.eq(0);
				(await d2.find({ filter: { name: "six" } })).length.should.eq(0);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Remove vs. Update (update should win) (no matter the order of sync)", async () => {
				const docs1 = [
					Kid.new({
						age: 10,
						name: "ten",
					}),
					Kid.new({
						age: 1,
						name: "one",
					}),
				];
				const docs2 = [
					Kid.new({
						age: 6,
						name: "six",
					}),
					Kid.new({
						age: 2,
						name: "two",
					}),
				];
				await d1.insert(docs1);
				await d2.insert(docs2);

				const s1 = await d2.sync();
				const s2 = await d1.sync();
				const s3 = await d2.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d2.remove({
					filter: { name: "six" },
				});
				await d1.update({
					filter: { name: "six" },
					update: { $set: { age: 62 } },
				});

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();

					s1.received.should.eq(0);
					s1.sent.should.eq(1);
					s2.sent.should.eq(0);
					s2.received.should.eq(1);
					s3.received.should.eq(0);
					s3.sent.should.eq(0);
				}

				(await d1.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				(await d2.find({ filter: { name: "six" } }))[0].age.should.eq(62);
				{
					// hashes are equal
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					const s4 = await d2.sync();
					(s1.diff === -1 || s1.diff === 0).should.eq(true);
					(s2.diff === -1 || s2.diff === 0).should.eq(true);
					s3.diff.should.eq(-1);
					s4.diff.should.eq(-1);
				}
			});
			it("Update + Remove vs. Update", async () => {});
			it("Multiple updates on both sides", async () => {});
			it("Multiple updates + remove vs. remove", async () => {});
			it("Multiple updates + remove vs. multiple updates + remove", async () => {});
			it("Custom conflict resolution", async () => {});
		});
		describe("Unique key conflict resolution", async () => {
			it("Creation of document with same unique Key on both DBs", async () => {});
			it("update of document with same unique Key, same key created on other DB", async () => {});
			it("Ensuring unique index on A, creating document violating constraint on B", async () => {});
			it("Ensuring unique index on A, updating document violating constraint on B", async () => {});
		});
		describe("indexes", () => {
			it("ensuring indexes", async () => {});
			it("removing indexes", async () => {});
		});
	});
});
