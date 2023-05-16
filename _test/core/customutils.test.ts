/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js"
const customUtils = xwebdb._internal.customUtils
describe("customUtils", () => {
	describe("uid", () => {
		// Very small probability of conflict
		it("Generated uids should not be the same", () => {
			customUtils.uid().should.not.equal(customUtils.uid());
		});
	});
	describe("xxhash", ()=>{
		it("hashing of strings returns a number", ()=>{
			let s1 = customUtils.uid();
			chai.expect(typeof customUtils.dHash(s1)).eq("number")
		});
		it("Given hashes are unique enough", ()=>{
			let i = 500;
			const arrOfHashes: string[] = [];
			while(i--) {
				arrOfHashes.push(customUtils.dHash(customUtils.uid()).toString());
			}
			chai.expect(arrOfHashes.length).to.eq(arrOfHashes.filter((x,i)=>arrOfHashes.indexOf(x) === i).length)
		});
	})
});
