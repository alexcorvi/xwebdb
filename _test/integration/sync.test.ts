/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js";
const { Database, BaseModel } = xwebdb;
class Kid extends BaseModel {
	name: string;
	age: number;
}

export const memoryStores: {
	[key: string]: {
		[key: string]: string;
	};
} = {};

export const memoryAdapter = () => (name: string) => {
	name = name.replace(/_\d+$/, ""); // replacer is to make the sync demo work
	if (!memoryStores[name]) memoryStores[name] = {};
	return new MemoryStore(name);
};

class MemoryStore {
	name: string;
	constructor(name: string) {
		this.name = name;
	}
	async removeStore() {
		memoryStores[this.name] = {};
		return true;
	}
	async removeItem(itemID: string) {
		delete memoryStores[this.name][itemID];
		return true;
	}
	async removeItems(ids: string[]) {
		const results: boolean[] = [];
		for (let index = 0; index < ids.length; index++) {
			const element = ids[index];
			results.push(await this.removeItem(element));
		}
		return results;
	}
	async setItems(data: { key: string; value: string }[]) {
		const results: boolean[] = [];
		for (let index = 0; index < data.length; index++) {
			const element = data[index];
			results.push(await this.setItem(element.key, element.value));
		}
		return results;
	}
	async getItems(keys: string[]) {
		const results: { key: string; value: string }[] = [];
		for (let index = 0; index < keys.length; index++) {
			const key = keys[index];
			results.push({ key, value: await this.getItem(key) });
		}
		return results;
	}
	async setItem(itemID: string, itemData: string) {
		memoryStores[this.name][itemID] = itemData;
		return true;
	}
	async getItem(itemID: string): Promise<string> {
		return memoryStores[this.name][itemID];
	}
	async keys(): Promise<string[]> {
		return Object.keys(memoryStores[this.name]);
	}
}

describe("Database Syncing", () => {
	let d1 = new Database<{ _id: string; name: string; age: number }>({
		ref: "db_1",
		sync: {
			syncToRemote: memoryAdapter(),
			syncInterval: 9999999999999,
		},
	});
	let d2 = new Database<{ _id: string; name: string; age: number }>({
		ref: "db_2",
		sync: {
			syncToRemote: memoryAdapter(),
			syncInterval: 9999999999999,
		},
	});
	beforeEach(async () => {
		Object.keys(memoryStores).forEach((dbName) => {
			memoryStores[dbName] = {};
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

			const resOnD2 = await d2.find({ age: 12 });
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

			const resOnD2 = await d2.find({ age: 12 });
			resOnD2.length.should.eq(1);
			resOnD2[0].name.should.eq("alex");
			resOnD2[0]._id.should.eq(doc._id);

			{
				await d1.update({ age: 12 }, { $set: { age: 13 } });
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				s1.received.should.eq(0);
				s1.sent.should.eq(1);
				s2.sent.should.eq(0);
				s2.received.should.eq(1);
				const resOnD2 = await d2.find({ age: 13 });
				resOnD2.length.should.eq(1);
				resOnD2[0].name.should.eq("alex");
				resOnD2[0]._id.should.eq(doc._id);
			}
			{
				await d2.update({ age: 13 }, { $set: { age: 14 } });
				const s2 = await d2.sync();
				const s1 = await d1.sync();
				s1.received.should.eq(1);
				s1.sent.should.eq(0);
				s2.sent.should.eq(1);
				s2.received.should.eq(0);
				const resOnD1 = await d2.find({ age: 14 });
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

			const resOnD2 = await d2.find({ age: 12 });
			resOnD2.length.should.eq(1);
			resOnD2[0].name.should.eq("alex");
			resOnD2[0]._id.should.eq(doc._id);

			{
				await d1.remove({ age: 12 });
				const s1 = await d1.sync();
				const s2 = await d2.sync();
				s1.received.should.eq(0);
				s1.sent.should.eq(1);
				s2.sent.should.eq(0);
				s2.received.should.eq(1);
				const resOnD2 = await d2.find({ age: 12 });
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
				await d2.remove({}, true);
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
			await d1.update({ name: "marc" }, { $inc: { age: 5 } });
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ name: "alex" }))[0];
			const marc = (await d2.find({ name: "marc" }))[0];
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
			await d1.remove({ name: "marc" });
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ name: "alex" }))[0];
			const marc = await d2.find({ name: "marc" });
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
			await d1.update({ name: "alex" }, { $set: { age: 5 } });
			await d1.update({ name: "marc" }, { $set: { age: 2 } });
			await d1.remove({ name: "marc" });
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(2);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(2);

			const alex = (await d2.find({ name: "alex" }))[0];
			const marc = await d2.find({ name: "marc" });
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
			const update = await d1.update({ name: "Alex" }, { $set: { age: 10 } }, true);
			const removal = await d1.remove({ name: "Ron" }, true);
			const s1 = await d1.sync();
			const s2 = await d2.sync();
			s1.sent.should.eq(docs.length);
			s1.received.should.eq(0);
			s2.sent.should.eq(0);
			s2.received.should.eq(docs.length);

			const all = await d2.find({});
			const alex = await d2.find({ name: "alex" });
			const ron = await d2.find({ name: "Ron" });

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

			await d1.update({ name: "may" }, { $set: { age: 3 } });
			await d1.update({ name: "jim" }, { $set: { age: 4 } });
			await d1.sync();
			await d2.sync();

			await d2.update({ name: "may" }, { $set: { age: 2 } });
			await d2.update({ name: "jim" }, { $set: { age: 3 } });
			await d2.sync();
			await d1.sync();

			await d1.update({ name: "may" }, { $set: { age: 11 } });
			await d1.update({ name: "jim" }, { $set: { age: 12 } });
			await d1.sync();
			await d2.sync();
			await d1.sync();

			let d3 = new Database<{ _id: string; name: string; age: number }>({
				ref: "db_3",
				sync: {
					syncToRemote: memoryAdapter(),
					syncInterval: 9999999999999,
				},
			});
			// start by cleaning it
			await d3._datastore.persistence.deleteEverything();

			await d3.sync();

			const onD1 = await d1.find({
				$or: [{ name: "may" }, { name: "jim" }],
			});
			const onD2 = await d2.find({
				$or: [{ name: "may" }, { name: "jim" }],
			});
			const onD3 = await d3.find({
				$or: [{ name: "may" }, { name: "jim" }],
			});

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

				const onD1 = await d1.find({ $or: [{ name: "may" }, { name: "jim" }] });
				const onD2 = await d2.find({ $or: [{ name: "may" }, { name: "jim" }] });

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
						const onD1 = await d1.find({ $or: [{ name: "may" }, { name: "jim" }] });
						const onD2 = await d2.find({ $or: [{ name: "may" }, { name: "jim" }] });

						onD1.length.should.eq(2);
						onD2.length.should.eq(2);

						onD1.find((x) => x.name === "jim")!.age.should.eq(12);
						onD2.find((x) => x.name === "may")!.age.should.eq(5);

						onD1.find((x) => x.name === "jim")!.age.should.eq(12);
						onD2.find((x) => x.name === "may")!.age.should.eq(5);
					}

					// new documents
					const onD1 = await d1.find({
						name: { $in: ["one", "two", "six", "ten"] },
					});
					const onD2 = await d2.find({
						name: { $in: ["one", "two", "six", "ten"] },
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

				await d1.update({ name: "one" }, { $mul: { age: 2 } });
				await d2.update({ name: "two" }, { $mul: { age: 2 } });

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

				(await d1.find({ name: "one" }))[0].age.should.eq(2);
				(await d1.find({ name: "two" }))[0].age.should.eq(4);
				(await d1.find({ name: "six" }))[0].age.should.eq(6); // not updated
				(await d1.find({ name: "ten" }))[0].age.should.eq(10); // not updated

				(await d2.find({ name: "one" }))[0].age.should.eq(2);
				(await d2.find({ name: "two" }))[0].age.should.eq(4);
				(await d2.find({ name: "six" }))[0].age.should.eq(6); // not updated
				(await d2.find({ name: "ten" }))[0].age.should.eq(10); // not updated
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

				await d1.remove({ name: "one" });
				await d2.remove({ name: "two" });

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

				(await d1.find({ name: "one" })).length.should.eq(0);
				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d1.find({ name: "six" })).length.should.eq(1); // not removed
				(await d1.find({ name: "ten" })).length.should.eq(1); // not removed

				(await d2.find({ name: "one" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(1); // not removed
				(await d2.find({ name: "ten" })).length.should.eq(1); // not removed
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

				await d1.remove({ name: { $in: ["one", "two"] } }, true);
				await d2.remove({ name: { $in: ["six", "ten"] } }, true);
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

				(await d1.find({ name: "one" })).length.should.eq(0);
				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d1.find({ name: "ten" })).length.should.eq(0);

				(await d2.find({ name: "one" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "ten" })).length.should.eq(0);
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
				await d1.update({ name: "one" }, { $set: { age: 1111 } });
				await d1.update({ name: "ten" }, { $set: { age: 1010 } });
				await d2.update({ name: "six" }, { $set: { age: 6666 } });
				await d2.update({ name: "two" }, { $set: { age: 2222 } });

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ name: "one" }))[0].age.should.eq(1111);
				(await d1.find({ name: "two" }))[0].age.should.eq(2222);
				(await d1.find({ name: "six" }))[0].age.should.eq(6666);
				(await d1.find({ name: "ten" }))[0].age.should.eq(1010);

				(await d2.find({ name: "one" }))[0].age.should.eq(1111);
				(await d2.find({ name: "two" }))[0].age.should.eq(2222);
				(await d2.find({ name: "six" }))[0].age.should.eq(6666);
				(await d2.find({ name: "ten" }))[0].age.should.eq(1010);
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
				await d1.remove({ name: "one" });
				await d1.remove({ name: "ten" });
				await d2.remove({ name: "six" });
				await d2.remove({ name: "two" });

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ name: "one" })).length.should.eq(0);
				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d1.find({ name: "ten" })).length.should.eq(0);

				(await d2.find({ name: "one" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "ten" })).length.should.eq(0);
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
				await d1.update({ name: "one" }, { $set: { age: 1111 } });
				await d1.update({ name: "ten" }, { $set: { age: 1010 } });
				await d2.update({ name: "six" }, { $set: { age: 6666 } });
				await d2.update({ name: "two" }, { $set: { age: 2222 } });
				await d1.remove({ name: "one" });
				await d1.remove({ name: "ten" });
				await d2.remove({ name: "six" });
				await d2.remove({ name: "two" });

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(2);
				s2.sent.should.eq(2);
				s2.received.should.eq(2);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);
				(await d1.find({ name: "one" })).length.should.eq(0);
				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d1.find({ name: "ten" })).length.should.eq(0);

				(await d2.find({ name: "one" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "ten" })).length.should.eq(0);
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

				await d1.remove({ name: "six" });
				await d2.remove({ name: "six" });
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
				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
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

				await d1.update({ name: "six" }, { $set: { age: 61 } });
				await d2.update({ name: "six" }, { $set: { age: 62 } });

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

				(await d1.find({ name: "six" }))[0].age.should.eq(62);
				(await d2.find({ name: "six" }))[0].age.should.eq(62);
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

				await d1.update({ name: "six" }, { $set: { age: 61 } });
				await d2.remove({ name: "six" });

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

				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
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

				await d2.remove({ name: "six" });
				await d1.update({ name: "six" }, { $set: { age: 62 } });

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

				(await d1.find({ name: "six" }))[0].age.should.eq(62);
				(await d2.find({ name: "six" }))[0].age.should.eq(62);
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

				await d1.update({ name: "six" }, { $set: { age: 61 } });
				await d2.remove({ name: "six" });

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

				(await d1.find({ name: "six" })).length.should.eq(0);
				(await d2.find({ name: "six" })).length.should.eq(0);
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

				await d2.remove({ name: "six" });
				await d1.update({ name: "six" }, { $set: { age: 62 } });

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

				(await d1.find({ name: "six" }))[0].age.should.eq(62);
				(await d2.find({ name: "six" }))[0].age.should.eq(62);
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
			it("Update + Remove vs. Update", async () => {
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

				await d2.update({ name: "two" }, { $set: { age: 222 } });
				await d1.update({ name: "two" }, { $set: { age: 22 } });
				await d1.remove({ name: "two" });

				await d1.update({ name: "six" }, { $set: { age: 62 } });
				await d1.remove({ name: "six" });
				await d2.update({ name: "six" }, { $set: { age: 666 } });

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();

					s1.received.should.eq(0);
					s1.sent.should.eq(2);
					s2.sent.should.eq(1);
					s2.received.should.eq(1);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ name: "six" }))[0].age.should.eq(666);
				(await d2.find({ name: "six" }))[0].age.should.eq(666);
				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);

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
			it("Multiple updates on both sides", async () => {
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

				await d1.update({ name: "two" }, { $set: { age: 22 } });
				await d1.update({ name: "two" }, { $set: { age: 222 } });
				await d1.update({ name: "two" }, { $set: { age: 2222 } });
				await d2.update({ name: "two" }, { $set: { age: 922 } });
				await d2.update({ name: "two" }, { $set: { age: 9222 } });
				await d2.update({ name: "two" }, { $set: { age: 92222 } });
				await d2.update({ name: "six" }, { $set: { age: 96 } });
				await d2.update({ name: "six" }, { $set: { age: 966 } });
				await d2.update({ name: "six" }, { $set: { age: 9666 } });
				await d1.update({ name: "six" }, { $set: { age: 6 } });
				await d1.update({ name: "six" }, { $set: { age: 66 } });
				await d1.update({ name: "six" }, { $set: { age: 666 } });

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();

					s1.received.should.eq(0);
					s1.sent.should.eq(2);
					s2.sent.should.eq(1);
					s2.received.should.eq(1);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}

				(await d1.find({ name: "six" }))[0].age.should.eq(666);
				(await d2.find({ name: "six" }))[0].age.should.eq(666);
				(await d1.find({ name: "two" }))[0].age.should.eq(92222);
				(await d2.find({ name: "two" }))[0].age.should.eq(92222);

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
			it("Multiple updates + remove vs. remove", async () => {
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

				await d1.update({ name: "two" }, { $set: { age: 22 } });
				await d1.update({ name: "two" }, { $set: { age: 222 } });
				await d1.update({ name: "two" }, { $set: { age: 2222 } });
				await d1.remove({ name: "two" });
				await d2.remove({ name: "two" });

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

				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);

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
			it("Multiple updates + remove vs. multiple updates + remove", async () => {
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

				await d1.update({ name: "two" }, { $set: { age: 22 } });
				await d1.update({ name: "two" }, { $set: { age: 222 } });
				await d1.update({ name: "two" }, { $set: { age: 2222 } });
				await d1.remove({ name: "two" });
				await d2.update({ name: "two" }, { $set: { age: 22 } });
				await d2.update({ name: "two" }, { $set: { age: 222 } });
				await d2.update({ name: "two" }, { $set: { age: 2222 } });
				await d2.remove({ name: "two" });

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

				(await d1.find({ name: "two" })).length.should.eq(0);
				(await d2.find({ name: "two" })).length.should.eq(0);

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
		describe("Indexes", () => {
			it("ensuring indexes", async () => {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});
				await d2.ensureIndex({
					unique: false,
					sparse: true,
					fieldName: "name",
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

				d1._datastore.indexes.name.fieldName.should.eq("name");
				d1._datastore.indexes.name.unique.should.eq(false);
				d1._datastore.indexes.name.sparse.should.eq(true);
				d2._datastore.indexes.name.fieldName.should.eq("name");
				d2._datastore.indexes.name.unique.should.eq(false);
				d2._datastore.indexes.name.sparse.should.eq(true);

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
			it("removing indexes", async () => {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});
				await d2.ensureIndex({
					unique: false,
					sparse: true,
					fieldName: "name",
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

				d1._datastore.indexes.name.fieldName.should.eq("name");
				d1._datastore.indexes.name.unique.should.eq(false);
				d1._datastore.indexes.name.sparse.should.eq(true);
				d2._datastore.indexes.name.fieldName.should.eq("name");
				d2._datastore.indexes.name.unique.should.eq(false);
				d2._datastore.indexes.name.sparse.should.eq(true);

				await d2.ensureIndex({ fieldName: "name", unique: true, sparse: false });
				await d2.removeIndex("name");

				{
					const s1 = await d1.sync();
					const s2 = await d2.sync();
					const s3 = await d1.sync();
					s1.received.should.eq(0);
					s1.sent.should.eq(0);
					s2.sent.should.eq(1);
					s2.received.should.eq(0);
					s3.received.should.eq(1);
					s3.sent.should.eq(0);
				}
				chai.expect(d1._datastore.indexes.name).eq(undefined);
				chai.expect(d2._datastore.indexes.name).eq(undefined);

				await d1.ensureIndex({ fieldName: "name", unique: true, sparse: false });
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

				d1._datastore.indexes.name.fieldName.should.eq("name");
				d1._datastore.indexes.name.unique.should.eq(true);
				d1._datastore.indexes.name.sparse.should.eq(false);

				d2._datastore.indexes.name.fieldName.should.eq("name");
				d2._datastore.indexes.name.unique.should.eq(true);
				d2._datastore.indexes.name.sparse.should.eq(false);

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
		describe("Unique key conflict resolution", async () => {
			it("Creation of document with same unique Key on both DBs", async function () {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				d1._datastore.indexes["name"].unique.should.eq(true);
				d2._datastore.indexes["name"].unique.should.eq(true);

				s1.received.should.eq(0);
				s1.sent.should.eq(3);
				s2.sent.should.eq(2);
				s2.received.should.eq(3);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.insert([Kid.new({ name: "samename", age: 1 })]);
				await d2.insert([Kid.new({ name: "samename", age: 2 })]);

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

				(await d1.find({ name: "samename" })).length.should.eq(2);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 2).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "samename" })).length.should.eq(2);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 2).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
			it("Creation of document with same unique Key on both DBs (reverse order)", async function () {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(3);
				s2.sent.should.eq(2);
				s2.received.should.eq(3);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				d1._datastore.indexes["name"].unique.should.eq(true);
				d2._datastore.indexes["name"].unique.should.eq(true);

				await d2.insert([Kid.new({ name: "samename", age: 2 })]);
				await d1.insert([Kid.new({ name: "samename", age: 1 })]);

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

				(await d1.find({ name: "samename" })).length.should.eq(2);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 2).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "samename" })).length.should.eq(2);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 2).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
			it("update of document with same unique Key, same key created on other DB", async () => {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				d1._datastore.indexes["name"].unique.should.eq(true);
				d2._datastore.indexes["name"].unique.should.eq(true);

				s1.received.should.eq(0);
				s1.sent.should.eq(3);
				s2.sent.should.eq(2);
				s2.received.should.eq(3);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				await d1.insert([Kid.new({ name: "samename", age: 9999 })]);
				await d2.update({ name: "ten" }, { $set: { name: "samename" } });

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

				(await d1.find({ name: "samename" })).length.should.eq(2);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 10).should.above(-1);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 9999).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "samename" })).length.should.eq(2);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 10).should.above(-1);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 9999).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
			it("update of document with same unique Key, same key created on other DB (reverse order)", async () => {
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

				await d1.ensureIndex({
					unique: true,
					sparse: true,
					fieldName: "name",
				});

				const s1 = await d1.sync();
				const s2 = await d2.sync();
				const s3 = await d1.sync();

				s1.received.should.eq(0);
				s1.sent.should.eq(3);
				s2.sent.should.eq(2);
				s2.received.should.eq(3);
				s3.received.should.eq(2);
				s3.sent.should.eq(0);

				d1._datastore.indexes["name"].unique.should.eq(true);
				d2._datastore.indexes["name"].unique.should.eq(true);

				await d2.update({ name: "ten" }, { $set: { name: "samename" } });
				await d1.insert([Kid.new({ name: "samename", age: 9999 })]);

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

				(await d1.find({ name: "samename" })).length.should.eq(2);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 10).should.above(-1);
				(await d1.find({ name: "samename" })).findIndex((x) => x.age === 9999).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "samename" })).length.should.eq(2);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 10).should.above(-1);
				(await d2.find({ name: "samename" })).findIndex((x) => x.age === 9999).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
			it("Ensuring unique index on A, creating document violating constraint on B", async () => {
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

				await d1.create([Kid.new({ name: "ten", age: 1010 })]);
				await d2.ensureIndex({ fieldName: "name", unique: true });
				d2._datastore.indexes["name"].unique.should.eq(true);

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

				(await d1.find({ name: "ten" })).length.should.eq(2);
				(await d1.find({ name: "ten" })).findIndex((x) => x.age === 1010).should.above(-1);
				(await d1.find({ name: "ten" })).findIndex((x) => x.age === 10).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "ten" })).length.should.eq(2);
				(await d2.find({ name: "ten" })).findIndex((x) => x.age === 1010).should.above(-1);
				(await d2.find({ name: "ten" })).findIndex((x) => x.age === 10).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
			it("Ensuring unique index on A, updating document violating constraint on B", async () => {
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

				await d1.update({ name: "ten" }, { $set: { name: "one" } });
				await d2.ensureIndex({ fieldName: "name", unique: true });
				d2._datastore.indexes["name"].unique.should.eq(true);

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

				(await d1.find({ name: "one" })).length.should.eq(2);
				(await d1.find({ name: "one" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d1.find({ name: "one" })).findIndex((x) => x.age === 10).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

				(await d2.find({ name: "one" })).length.should.eq(2);
				(await d2.find({ name: "one" })).findIndex((x) => x.age === 1).should.above(-1);
				(await d2.find({ name: "one" })).findIndex((x) => x.age === 10).should.above(-1);
				d1._datastore.indexes["name"].unique.should.eq(false);

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
	});

	describe("Devalidation of hashes", () => {
		it("hashes devalidated in specific amount of time", async () => {
			let d1 = new Database<{ _id: string; name: string; age: number }>({
				ref: "db_A",
				sync: {
					syncToRemote: memoryAdapter(),
					syncInterval: 9999999999999,
					devalidateHash: 500,
				},
			});
			let d2 = new Database<{ _id: string; name: string; age: number }>({
				ref: "db_B",
				sync: {
					syncToRemote: memoryAdapter(),
					syncInterval: 9999999999999,
				},
			});

			const wait = (i: number) => new Promise((resolve) => setTimeout(resolve, i));

			await d1.insert(Kid.new({}));
			await d2.insert(Kid.new({}));

			{
				const s1 = await d1.sync();
				const s2 = await d1.sync();
				const s3 = await d1.sync();
				(s1.diff === 1).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
			}
			{
				const s1 = await d2.sync();
				const s2 = await d2.sync();
				const s3 = await d2.sync();
				(s1.diff === 1).should.eq(true);
				(s2.diff === -1 || s2.diff === 0).should.eq(true);
				s3.diff.should.eq(-1);
			}

			await wait(100);
			{
				// not devalidated .. still needs more time
				const s1 = await d1.sync();
				const s2 = await d1.sync();
				s1.diff.should.eq(-1);
				s2.diff.should.eq(-1);
			}
			{
				// not devalidated
				const s1 = await d2.sync();
				const s2 = await d2.sync();
				s1.diff.should.eq(-1);
				s2.diff.should.eq(-1);
			}

			await wait(400);
			{
				// devalidated
				const s1 = await d1.sync();
				const s2 = await d1.sync();
				s1.diff.should.eq(0);
				s2.diff.should.eq(-1);
			}
			{
				// not devalidated
				const s1 = await d2.sync();
				const s2 = await d2.sync();
				s1.diff.should.eq(-1);
				s2.diff.should.eq(-1);
			}

			await d1._datastore.persistence.deleteEverything();
			await d2._datastore.persistence.deleteEverything();
		});
	});
});
