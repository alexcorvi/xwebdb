/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
/// <reference path="../../dist/core/observable.d.ts"/>
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
const wait = (i: number) => new Promise((resolve) => setTimeout(resolve, i));
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

describe("Live Queries", () => {
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

		await d1.insert([
			Kid.new({ name: "a", age: 1 }),
			Kid.new({ name: "b", age: 2 }),
			Kid.new({ name: "c", age: 3 }),
			Kid.new({ name: "d", age: 4 }),
		]);
	});

	describe("Getting live queries", () => {
		it("Getting live data", (done) => {
			d1.reload()
				.then(() => d1.live({}, { toDB: false, fromDB: false }))
				.then((res) => {
					chai.expect(xwebdb._internal.observable.isObservable(res.observable)).eq(true);
					done();
				})
				.catch((e) => {
					throw new Error(e);
				});
		});
	});

	describe("Getting updates (fromDB)", () => {
		it("Insertion", async () => {
			const live = await d1.live({});
			const changes: any[] = [];
			live.observe((c) => changes.push(c));
			await d1.insert(Kid.new({ name: "e", age: 5 }));
			await wait(1);
			live.observable.length.should.eq(5);
			changes.length.should.eq(1); // one batch
			changes[0].length.should.eq(9); // 4 del + 5 add
			live.observable.findIndex((x) => x.age === 1).should.above(-1);
			live.observable.findIndex((x) => x.age === 2).should.above(-1);
			live.observable.findIndex((x) => x.age === 3).should.above(-1);
			live.observable.findIndex((x) => x.age === 4).should.above(-1);
			live.observable.findIndex((x) => x.age === 5).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Update", async () => {
			const live = await d1.live({});
			const changes: any[] = [];
			live.observe((c) => changes.push(c));
			await d1.update({ name: "a" }, { $set: { age: 111 } });
			await wait(1);
			live.observable.length.should.eq(4);
			changes.length.should.eq(1); // one batch
			changes[0].length.should.eq(8); // 4 del + 4 add
			live.observable.findIndex((x) => x.age === 111).should.above(-1);
			live.observable.findIndex((x) => x.age === 2).should.above(-1);
			live.observable.findIndex((x) => x.age === 3).should.above(-1);
			live.observable.findIndex((x) => x.age === 4).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Deletion", async () => {
			const live = await d1.live({});
			const changes: any[] = [];
			live.observe((c) => changes.push(c));
			await d1.delete({ name: "a" });
			await wait(1);
			live.observable.length.should.eq(3);
			changes.length.should.eq(1); // one batch
			changes[0].length.should.eq(7); // 4 del + 3 add
			live.observable.findIndex((x) => x.age === 1).should.eq(-1);
			live.observable.findIndex((x) => x.age === 2).should.above(-1);
			live.observable.findIndex((x) => x.age === 3).should.above(-1);
			live.observable.findIndex((x) => x.age === 4).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Multiple actions", async () => {
			const live = await d1.live({});
			const changes: any[] = [];
			live.observe((c) => changes.push(c));
			await d1.delete({ name: "a" });
			await d1.update({ name: "b" }, { $set: { age: 22 } });
			await d1.update({ name: "c" }, { $set: { age: 333 } });
			await d1.insert(Kid.new({ name: "abc", age: 1992 }));
			await wait(1);
			live.observable.length.should.eq(4);
			changes.length.should.eq(4); // four batches
			changes[0].length.should.eq(7); // 4 del + 3 add
			changes[1].length.should.eq(6); // 3 del + 3 add
			changes[2].length.should.eq(6); // 3 del + 3 add
			changes[3].length.should.eq(7); // 3 del + 4 add
			live.observable.findIndex((x) => x.age === 1).should.eq(-1);
			live.observable.findIndex((x) => x.age === 22).should.above(-1);
			live.observable.findIndex((x) => x.age === 333).should.above(-1);
			live.observable.findIndex((x) => x.age === 4).should.above(-1);
			live.observable.findIndex((x) => x.age === 1992).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Sync", async () => {
			const live = await d1.live({});
			const changes: any[] = [];
			live.observe((c) => changes.push(c));
			await d2.insert(Kid.new({ name: "from d2", age: 2222 }));
			await d2.sync();
			await d1.sync();
			await wait(1);
			live.observable.length.should.eq(5);
			changes.length.should.eq(1); // one batch
			changes[0].length.should.eq(9); // 4 del + 5 add
			live.observable.findIndex((x) => x.age === 1).should.above(-1);
			live.observable.findIndex((x) => x.age === 2).should.above(-1);
			live.observable.findIndex((x) => x.age === 3).should.above(-1);
			live.observable.findIndex((x) => x.age === 4).should.above(-1);
			live.observable.findIndex((x) => x.age === 2222).should.above(-1);
			live.unobserve();
			live.kill();
		});
	});
	describe("Propagating updates (toDB)", () => {
		it("Insertion", async () => {
			const live = await d1.live({});
			live.observable.push(Kid.new({ name: "f", age: 8 }));
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(5);
			res.findIndex((x) => x.name === "a").should.above(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			res.findIndex((x) => x.name === "f" && x.age === 8).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Update whole document (and ID, should not be possible)", async () => {
			const live = await d1.live({});
			live.observable[live.observable.findIndex((x) => x.age === 1)] = Kid.new({ name: "x", age: 99 });
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "a").should.above(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			res.findIndex((x) => x.name === "x").should.eq(-1);
			// resetting document ID should not be possible
			await wait(1);
			// live query should reverse the update
			live.observable.findIndex((x) => x.name === "x").should.eq(-1);
			res.findIndex((x) => x.name === "a").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Update whole document (without ID, should be possible)", async () => {
			const live = await d1.live({});
			const index = live.observable.findIndex((x) => x.age === 1);
			const _id = live.observable[index]._id;
			const newVal = Kid.new({ name: "x", age: 99 });
			newVal._id = _id;
			live.observable[index] = newVal;
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "a").should.eq(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			res.findIndex((x) => x.name === "x").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Insertion then update", async () => {
			const live = await d1.live({});
			live.observable.push(Kid.new({ name: "yaman", age: 4.5 }));
			live.observable[live.observable.length - 1].name = "Yaman";
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(5);
			res.findIndex((x) => x.name === "a").should.above(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			res.findIndex((x) => x.name === "Yaman" && x.age === 4.5).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Deletion", async () => {
			const live = await d1.live({});
			live.observable.splice(
				live.observable.findIndex((x) => x.age === 1),
				1
			);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(3);
			res.findIndex((x) => x.name === "a").should.eq(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Update then delete", async () => {
			const live = await d1.live({});
			const i = live.observable.findIndex((x) => x.name === "a");
			live.observable[i].age = 55;
			live.observable.splice(i, 1);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(3);
			res.findIndex((x) => x.name === "a").should.eq(-1);
			res.findIndex((x) => x.age === 55).should.eq(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Create, update then delete", async () => {
			const live = await d1.live({});
			live.observable.push(Kid.new({ name: "yaman", age: 4.5 }));
			const i = live.observable.findIndex((x) => x.name === "yaman");
			live.observable[i].age = 19;
			live.observable.splice(i, 1);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "a").should.above(-1);
			res.findIndex((x) => x.name === "b").should.above(-1);
			res.findIndex((x) => x.name === "c").should.above(-1);
			res.findIndex((x) => x.name === "d").should.above(-1);
			res.findIndex((x) => x.age === 19).should.eq(-1);
			live.unobserve();
			live.kill();
		});
		it("Multiple actions: consecutive on multiple documents", async () => {
			const live = await d1.live({});
			for (let i = 0; i < live.observable.length; i++) {
				live.observable[i].age = live.observable[i].age * 10;
				live.observable[i].name = live.observable[i].name + "OG";
			}
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "aOG").should.above(-1);
			res.findIndex((x) => x.name === "bOG").should.above(-1);
			res.findIndex((x) => x.name === "cOG").should.above(-1);
			res.findIndex((x) => x.name === "dOG").should.above(-1);
			res.findIndex((x) => x.age === 10).should.above(-1);
			res.findIndex((x) => x.age === 20).should.above(-1);
			res.findIndex((x) => x.age === 30).should.above(-1);
			res.findIndex((x) => x.age === 40).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Delete everything", async () => {
			const live = await d1.live({});
			live.observable.splice(0);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(0);
			live.unobserve();
			live.kill();
		});
		it("Shuffle", async () => {
			const live = await d1.live({});
			live.observable.sort();
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Reverse", async () => {
			const live = await d1.live({});
			live.observable.reverse();
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(4);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			live.unobserve();
			live.kill();
		});
	});

	describe("Unilaterally alive", () => {
		it("observing changes only from DB", async () => {
			const live = await d1.live({}, { fromDB: true, toDB: false });
			await d1.insert(Kid.new({ name: "added", age: 999 }));
			await wait(1);
			live.observable.length.should.eq(5);
			live.observable.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			live.observable.splice(0, 1);
			live.observable.length.should.eq(4);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(5);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			res.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("observing changes only to DB", async () => {
			const live = await d1.live({}, { fromDB: false, toDB: true });
			await d1.insert(Kid.new({ name: "added", age: 999 }));
			await wait(1);
			live.observable.length.should.eq(4);
			live.observable.findIndex((x) => x.age === 999 && x.name === "added").should.eq(-1);
			live.observable.push(Kid.new({ name: "x", age: 0 }));
			live.observable.length.should.eq(5);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(6);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			res.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			res.findIndex((x) => x.age === 0 && x.name === "x").should.above(-1);
			live.unobserve();
			live.kill();
		});
	});
	describe("Killing live data", () => {
		it("Killing toDB", async () => {
			const live = await d1.live({});
			live.observable.length.should.eq(4);
			await live.kill("toDB");
			await d1.insert(Kid.new({ name: "added", age: 999 }));
			await wait(1);
			live.observable.length.should.eq(5);
			live.observable.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			live.observable.splice(0, 1);
			live.observable.length.should.eq(4);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(5);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			res.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Killing fromDB", async () => {
			const live = await d1.live({});
			live.kill("fromDB");
			await d1.insert(Kid.new({ name: "added", age: 999 }));
			await wait(1);
			live.observable.length.should.eq(4);
			live.observable.findIndex((x) => x.age === 999 && x.name === "added").should.eq(-1);
			live.observable.push(Kid.new({ name: "x", age: 0 }));
			live.observable.length.should.eq(5);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(6);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			res.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			res.findIndex((x) => x.age === 0 && x.name === "x").should.above(-1);
			live.unobserve();
			live.kill();
		});
		it("Killing Both", async () => {
			const live = await d1.live({});
			live.kill("fromDB");
			live.kill("toDB")
			await d1.insert(Kid.new({ name: "added", age: 999 }));
			await wait(1);
			live.observable.length.should.eq(4);
			live.observable.findIndex((x) => x.age === 999 && x.name === "added").should.eq(-1);
			live.observable.push(Kid.new({ name: "x", age: 0 }));
			live.observable.length.should.eq(5);
			await wait(1);
			const res = await d1.find({});
			res.length.should.eq(5);
			res.findIndex((x) => x.name === "a" && x.age === 1).should.above(-1);
			res.findIndex((x) => x.name === "b" && x.age === 2).should.above(-1);
			res.findIndex((x) => x.name === "c" && x.age === 3).should.above(-1);
			res.findIndex((x) => x.name === "d" && x.age === 4).should.above(-1);
			res.findIndex((x) => x.age === 999 && x.name === "added").should.above(-1);
			res.findIndex((x) => x.age === 0 && x.name === "x").should.eq(-1);
			live.unobserve();
			live.kill();
		});
	});
});
