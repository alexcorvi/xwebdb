/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/index.d.ts" />
import unify from "../../dist/unify.js"


const customUtils = unify._internal.customUtils
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
});