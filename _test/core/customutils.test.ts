/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/index.d.ts" />
import xwebdb from "../../dist/xwebdb.js"


const customUtils = xwebdb._internal.customUtils
describe("customUtils", () => {
	describe("uid", () => {
		// Very small probability of conflict
		it("Generated uids should not be the same", () => {
			customUtils.uid().should.not.equal(customUtils.uid());
		});
		it("Generated random strings should not be the same", () => {
			customUtils
				.randomString(56)
				.should.not.equal(customUtils.randomString(56));
		});
	});
	describe("random string", ()=>{
		it("Is actually random", ()=>{
			let s1 = customUtils.randomString();
			let s2 = customUtils.randomString();
			s1.should.not.eq(s2);
		});
		it("Is defined by length", ()=>{
			let s1 = customUtils.randomString(20);
			s1.length.should.eq(20);
		});
		it("can be given even without being supplied by length (length=8)", ()=>{
			let s1 = customUtils.randomString();
			s1.length.should.eq(8);
		});
	})
	describe("xxhash", ()=>{
		it("hashing of strings returns a number", ()=>{
			let s1 = customUtils.randomString();
			chai.expect(typeof customUtils.xxh(s1)).eq("number")
		});
		it("hashing of string always returns a number of either 9 or 10 digits", ()=>{
			let s1 = customUtils.randomString(2);
			let s2 = customUtils.randomString(10);
			let s3 = customUtils.randomString(100);
			chai.expect(customUtils.xxh(s1).toString().length).above(7).below(11);
			chai.expect(customUtils.xxh(s2).toString().length).above(7).below(11);
			chai.expect(customUtils.xxh(s2).toString().length).above(7).below(11);
		});
		it("Given hashes are unique enough", ()=>{
			let i = 500;
			const arrOfHashes: string[] = [];
			while(i--) {
				arrOfHashes.push(customUtils.xxh(customUtils.randomString(500)).toString());
			}
			chai.expect(arrOfHashes.length).to.eq(arrOfHashes.filter((x,i)=>arrOfHashes.indexOf(x) === i).length)
		});
	})
});
