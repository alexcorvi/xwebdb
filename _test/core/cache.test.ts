/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js";
const Cache = xwebdb._internal.Cache;
const expect = chai.expect;

describe("Cache", () => {
	describe("toKey", () => {
		it("should generate a unique key for a given query", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value" };
			const key1 = cache.toKey(query1);

			const query2 = { field: "value" };
			const key2 = cache.toKey(query2);

			const query3 = { field: "otherValue" };
			const key3 = cache.toKey(query3);

			expect(key1).to.be.a("number");
			expect(key2).to.be.a("number");
			expect(key3).to.be.a("number");

			// The keys should be unique for different queries
			expect(key1).to.not.equal(key3);

			// The keys should be the same for identical queries
			expect(key1).to.equal(key2);
		});
	});

	describe("storeOrProspect", () => {
        it("Should add to prospected on first call then to cached on second call", ()=>{

            const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [
				{ id: 1, name: "Item 1" },
				{ id: 2, name: "Item 2" },
			];
			cache.storeOrProspect(query1, res1);

            Object.keys(cache.prospected).length.should.eq(1);
            cache.cached.size.should.eq(0);
            expect(cache.get(query1)).to.eq(undefined);

            cache.storeOrProspect(query1, res1);
            Object.keys(cache.prospected).length.should.eq(1);
            cache.cached.size.should.eq(1);
            expect(cache.get(query1)).to.deep.eq(res1);
        });


		it("should store a query and its results in the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [
				{ id: 1, name: "Item 1" },
				{ id: 2, name: "Item 2" },
			];
			cache.storeOrProspect(query1, res1);

			const query2 = { field: "value2" };
			const res2 = [{ id: 3, name: "Item 3" }];
			cache.storeOrProspect(query2, res2);

			const query3 = { field: "otherValue" };
			const res3 = [
				{ id: 4, name: "Item 4" },
				{ id: 5, name: "Item 5" },
			];
			cache.storeOrProspect(query3, res3);

			Object.keys(cache.prospected).length.should.eq(3);
			cache.cached.size.should.eq(0);
			expect(cache.get(query1)).to.equal(undefined); // all are prospects
			expect(cache.get(query2)).to.equal(undefined); // all are prospects
			expect(cache.get(query3)).to.equal(undefined); // all are prospects

			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query2, res2);
			cache.storeOrProspect(query3, res3);

			Object.keys(cache.prospected).length.should.eq(3);
			cache.cached.size.should.eq(3);

			// Retrieving the cached results should return the stored values
			expect(cache.get(query1)).to.deep.equal(res1);
			expect(cache.get(query2)).to.deep.equal(res2);
			expect(cache.get(query3)).to.deep.equal(res3);
		});

		it("should not store duplicate queries in the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1); // prospect
			cache.storeOrProspect(query1, res1); // store

			// Storing the same query again multiple times should not add duplicate entries
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);

			// The cache should still contain only one entry for the query
			expect(cache.cached.size).to.equal(1);
		});

        it("should not add duplicates even if they're of a different value", () => {
			const cache = new Cache<any>();

			const query = { field: "value" };
			const res1 = [{ id: 1, name: "Item 1" }];

			// Store the query and results in the cache
			cache.storeOrProspect(query, res1);
			cache.storeOrProspect(query, res1);


			const res2 = [{ id: 2, name: "Item 2" }];

			// Attempt to store the same query again, it should not be added to the cache
			cache.storeOrProspect(query, res2);
            cache.storeOrProspect(query, res2);

			// Verify that the cache still contains the initial entry and not the duplicate
			const cachedEntry = cache.cached.get(cache.toKey(query));
			expect(cachedEntry).to.exist;
            expect(cache.cached.size).to.eq(1);
			expect(cachedEntry).to.deep.equal(res1);
			expect(cache.prospected[cache.toKey(query)]).to.equal(2);
		});

		it("should limit the number of cached entries based on the specified limit (remove once used)", () => {
			const cache = new Cache<any>(3);
			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);
			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
			cache.storeOrProspect(query2, res2);
			const query3 = { field: "value3" };
			const res3 = [{ id: 3, name: "Item 3" }];
			cache.storeOrProspect(query3, res3);
			cache.storeOrProspect(query3, res3);
			cache.get(query1);
			cache.get(query1);
			// will not call query2
			cache.get(query3);
			cache.get(query3);

            const query4 = { field: "value4" };
			const res4 = [{ id: 4, name: "Item 4" }];
			cache.storeOrProspect(query4, res4);
			cache.storeOrProspect(query4, res4);
			// The cache should only contain the most accessed added entries
			expect(cache.get(query1)).to.deep.equal(res1);
			expect(cache.get(query2)).to.be.undefined;
			expect(cache.get(query3)).to.deep.equal(res3);
            expect(cache.get(query4)).to.deep.equal(res4);
		});

        it("should limit the number of cached entries based on the specified limit (remove multiple used)", () => {
			const cache = new Cache<any>(3);
			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);
			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2); // query2 usage 1
			cache.storeOrProspect(query2, res2); // query2 usage 2
			const query3 = { field: "value3" };
			const res3 = [{ id: 3, name: "Item 3" }];
			cache.storeOrProspect(query3, res3);
			cache.storeOrProspect(query3, res3);
			cache.get(query1);
			cache.get(query1);
			cache.get(query2); // query2 usage 3
			cache.get(query3);
			cache.get(query3);
            const query4 = { field: "value4" };
			const res4 = [{ id: 4, name: "Item 4" }];
			cache.storeOrProspect(query4, res4); // query4 usage 1
            cache.storeOrProspect(query4, res4); // query4 usage 2
			expect(cache.get(query1)).to.deep.equal(res1);
			expect(cache.get(query2)).to.deep.equal(res2); // query2 usage 4
			expect(cache.get(query3)).to.deep.equal(res3);
            expect(cache.get(query4)).to.be.undefined;
            cache.storeOrProspect(query4, res4); // query4 usage 3
            cache.storeOrProspect(query4, res4); // query4 usage 4
            cache.storeOrProspect(query4, res4); // query4 usage 5
            expect(cache.get(query1)).to.deep.equal(res1);
			expect(cache.get(query2)).to.be.undefined;
			expect(cache.get(query3)).to.deep.equal(res3);
            expect(cache.get(query4)).to.deep.equal(res4);
        });

		it("should store a query and results in the cache", () => {
			const cache = new Cache<any>();

			const query = { field: "value" };
			const res = [
				{ id: 1, name: "Item 1" },
				{ id: 2, name: "Item 2" },
			];

			// Store the query and results in the cache
			cache.storeOrProspect(query, res);
			cache.storeOrProspect(query, res);


			// Verify that the cache contains the stored entry
			const cachedEntry = cache.cached.get(cache.toKey(query)); // will get it without counting usage
			expect(cachedEntry).to.exist;
			expect(cachedEntry).to.deep.equal(res);
			expect(cache.prospected[cache.toKey(query)]).to.equal(2);
		});



		it("should evict least used entry when the cache is full", () => {
			const cache = new Cache<any>(2);

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
			cache.storeOrProspect(query2, res2);

			const query3 = { field: "value3" };
			const res3 = [{ id: 3, name: "Item 3" }];

			// Adding a third entry to the cache should evict the least used entry (query1)
			cache.storeOrProspect(query3, res3);
            cache.storeOrProspect(query3, res3);

			// Verify that query1 is no longer in the cache
			expect(cache.cached.has(cache.toKey(query1))).to.be.false;
		});

	});

	describe("get", () => {
		it("should return the cached results for a stored query", () => {
			const cache = new Cache<any>();

			const query = { field: "value" };
			const res = [
				{ id: 1, name: "Item 1" },
				{ id: 2, name: "Item 2" },
			];
			cache.storeOrProspect(query, res);
			cache.storeOrProspect(query, res);

			// Retrieving the cached results should return the stored values
			expect(cache.get(query)).to.deep.equal(res);
		});

		it("should return undefined for a query that is not in the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];

            expect(cache.get(query1)).to.deep.eq(res1);
			// The cache does not contain the second query
			expect(cache.get(query2)).to.be.undefined;
		});

        
		it("should return undefined for a query that is still in prospected", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
            cache.storeOrProspect(query2, res2);

            expect(cache.get(query1)).to.deep.eq(res1);
            expect(Object.keys(cache.prospected).length).eq(2);
			// The cache does not contain the second query
			expect(cache.get(query2)).to.be.undefined;
		});

		it("should update the usage count for a cached query on retrieval", () => {
			const cache = new Cache<any>();

			const query = { field: "value" };
			const res = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query, res);
			cache.storeOrProspect(query, res);

			// Retrieving the cached results multiple times should update the usage count
			cache.get(query);
			cache.get(query);
			cache.get(query);

			expect(cache.prospected[cache.toKey(query)]).to.equal(5); // Usage count should be incremented each time
		});
	});

	describe("evict", () => {
		it("should remove the specified query from the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
			cache.storeOrProspect(query2, res2);

			// Evict query1 from the cache
			cache.evict(query1);

			// Verify that query1 is no longer in the cache
			expect(cache.cached.has(cache.toKey(query1))).to.be.false;
            expect(cache.cached.has(cache.toKey(query2))).to.be.true;
		});

        it("should clear the entire cache when no query is specified", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


			const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
            cache.storeOrProspect(query2, res2);

			// Clear the entire cache
			cache.evict();

			// Verify that the cache is empty
			expect(cache.cached.size).to.equal(0);
		});

		it("should not throw an error when evicting a query that is not in the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);

            const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
            cache.storeOrProspect(query2, res2);

			const query3 = { field: "value3" };

			// Evict query3 which is not in the cache, it should not throw an error
			expect(() => cache.evict(query3)).to.not.throw(Error);
		});

		it("should clear cache but not prospect maps when clearing the cache", () => {
			const cache = new Cache<any>();

			const query1 = { field: "value1" };
			const res1 = [{ id: 1, name: "Item 1" }];
			cache.storeOrProspect(query1, res1);
			cache.storeOrProspect(query1, res1);


            const query2 = { field: "value2" };
			const res2 = [{ id: 2, name: "Item 2" }];
			cache.storeOrProspect(query2, res2);
            cache.storeOrProspect(query2, res2);

			// Clear the entire cache
			cache.evict();

			// Verify that both the cache and prospect maps are empty
			expect(cache.cached.size).to.equal(0);
			expect(Object.keys(cache.prospected).length).to.equal(2);
		});
	});
});
