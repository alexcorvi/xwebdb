/// <reference path="../../node_modules/@types/chai/index.d.ts" />
/// <reference path="../../dist/xwebdb.d.ts" />
import xwebdb from "../../dist/xwebdb.js";

const assert = chai.assert;
const o = xwebdb._internal.observable;
const Change = o.Change;

describe("Observable and reactive data", () => {
	describe("Observable flat arrays", () => {
		it("Creating observable arrays", () => {
			const oarr = o.observable([{ a: 1 }, { a: 2 }, { a: 3 }]);
			o.isObservable(oarr.observable).should.eq(true);
		});

		it("observation", (done) => {
			let changes = 0;
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => (changes = changes + c.length));
			changes.should.eq(0);
			oarr.observable.push(4); // C
			oarr.observable[1] = 17; // U
			oarr.observable.splice(0, 1); // D
			setTimeout(() => {
				changes.should.eq(3);
				done();
			});
		});

		it("Insertiong", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable.push(17);
			setTimeout(() => {
				changes.length.should.eq(1);
				changes[0].type.should.eq("insert");
				chai.expect(changes[0].oldValue).eq(undefined);
				changes[0].value.should.eq(17);
				changes[0].path.length.should.eq(1);
				Number(changes[0].path[0]).should.eq(oarr.observable.length - 1);
				JSON.stringify(changes[0].object).should.eq(JSON.stringify(oarr.observable));
				JSON.stringify(changes[0].object).should.eq(`[1,2,3,17]`);
				JSON.stringify(changes[0].snapshot).should.eq(`[1,2,3,17]`);
				done();
			});
		});

		it("Deletion", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable.splice(1, 1);
			setTimeout(() => {
				changes.length.should.eq(1);
				changes[0].type.should.eq("delete");
				chai.expect(changes[0].value).eq(undefined);
				chai.expect(changes[0].oldValue).eq(2);
				changes[0].path.length.should.eq(1);
				Number(changes[0].path[0]).should.eq(1);
				JSON.stringify(changes[0].object).should.eq(JSON.stringify(oarr.observable));
				JSON.stringify(changes[0].object).should.eq(`[1,3]`);
				JSON.stringify(changes[0].snapshot).should.eq(`[1,3]`);
				done();
			});
		});

		it("Update", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes.length.should.eq(1);
				changes[0].type.should.eq("update");
				chai.expect(changes[0].value).eq(33);
				chai.expect(changes[0].oldValue).eq(3);
				changes[0].path.length.should.eq(1);
				Number(changes[0].path[0]).should.eq(2);
				JSON.stringify(changes[0].object).should.eq(JSON.stringify(oarr.observable));
				JSON.stringify(changes[0].object).should.eq(`[1,2,33]`);
				JSON.stringify(changes[0].snapshot).should.eq(`[1,2,33]`);
				done();
			});
		});

		it("Multiple changes", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable.push(11);
			oarr.observable.splice(0, 1);
			oarr.observable[2] = 33;
			oarr.observable.reverse();
			oarr.observable.sort();
			setTimeout(() => {
				changes.length.should.eq(5);

				changes[0].type.should.eq("insert");
				chai.expect(changes[0].oldValue).eq(undefined);
				changes[0].value.should.eq(11);
				changes[0].path.length.should.eq(1);
				Number(changes[0].path[0]).should.eq(3);
				JSON.stringify(changes[0].object).should.eq(`[2,3,33]`);
				JSON.stringify(changes[0].snapshot).should.eq(`[1,2,3,11]`);

				changes[1].type.should.eq("delete");
				chai.expect(changes[1].value).eq(undefined);
				chai.expect(changes[1].oldValue).eq(1);
				changes[1].path.length.should.eq(1);
				Number(changes[1].path[0]).should.eq(0);
				JSON.stringify(changes[1].object).should.eq(`[2,3,33]`);
				JSON.stringify(changes[1].snapshot).should.eq(`[2,3,11]`);

				changes[2].type.should.eq("update");
				chai.expect(changes[2].value).eq(33);
				chai.expect(changes[2].oldValue).eq(11);
				changes[2].path.length.should.eq(1);
				Number(changes[2].path[0]).should.eq(2);
				JSON.stringify(changes[2].object).should.eq(`[2,3,33]`);
				JSON.stringify(changes[2].snapshot).should.eq(`[2,3,33]`);

				changes[3].type.should.eq("reverse");
				JSON.stringify(changes[3].object).should.eq(`[2,3,33]`);
				JSON.stringify(changes[3].snapshot).should.eq(`[33,3,2]`);

				changes[4].type.should.eq("shuffle");
				JSON.stringify(changes[4].object).should.eq(`[2,3,33]`);
				JSON.stringify(changes[4].snapshot).should.eq(`[2,3,33]`);

				done();
			});
		});

		it("Silent updates", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			JSON.stringify(oarr.observable).should.eq(`[1,2,3]`);
			oarr.silently((arr) => {
				arr.push(11);
				arr.splice(0, 1);
				arr[2] = 33;
				arr.reverse();
				arr.sort();
			});
			setTimeout(() => {
				changes.length.should.eq(0);
				JSON.stringify(oarr.observable).should.eq(`[2,3,33]`);
				done();
			});
		});

		it("Siltent then loud updates", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			JSON.stringify(oarr.observable).should.eq(`[1,2,3]`);
			oarr.silently((arr) => {
				arr.push(11);
				arr.splice(0, 1);
				arr[2] = 33;
				arr.reverse();
				arr.sort();
			});
			setTimeout(() => {
				changes.length.should.eq(0);
				JSON.stringify(oarr.observable).should.eq(`[2,3,33]`);
				oarr.observable.push(1);
				oarr.observable.splice(0, 1);
				setTimeout(() => {
					changes.length.should.eq(2);

					changes[0].type.should.eq("insert");
					chai.expect(changes[0].oldValue).eq(undefined);
					changes[0].value.should.eq(1);
					changes[0].path.length.should.eq(1);
					Number(changes[0].path[0]).should.eq(3);
					JSON.stringify(changes[0].object).should.eq(`[3,33,1]`);
					JSON.stringify(changes[0].snapshot).should.eq(`[2,3,33,1]`);

					changes[1].type.should.eq("delete");
					chai.expect(changes[1].oldValue).eq(2);
					chai.expect(changes[1].value).eq(undefined);
					changes[1].path.length.should.eq(1);
					Number(changes[1].path[0]).should.eq(0);
					JSON.stringify(changes[1].object).should.eq(`[3,33,1]`);
					JSON.stringify(changes[1].snapshot).should.eq(`[3,33,1]`);
				});
				done();
			});
		});

		it("unobserve (empty arg)", (done) => {
			let changes1: any[] = [];
			let changes2: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			const observer1 = (c: any) => c.forEach((x: any) => changes1.push(x));
			const observer2 = (c: any) => c.forEach((x: any) => changes2.push(x));
			oarr.observe(observer1);
			oarr.observe(observer2);
			changes1.length.should.eq(0);
			changes2.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes1.length.should.eq(1);
				changes2.length.should.eq(1);
				JSON.stringify(oarr.observable).should.eq(`[1,2,33]`);
				// observers works! now let's unobserve
				oarr.unobserve();
				oarr.observable[2] = 77;
				setTimeout(() => {
					changes1.length.should.eq(1);
					changes2.length.should.eq(1);
					JSON.stringify(oarr.observable).should.eq(`[1,2,77]`);
					done();
				});
			});
		});

		it("unobserve (empty array arg)", (done) => {
			let changes1: any[] = [];
			let changes2: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			const observer1 = (c: any) => c.forEach((x: any) => changes1.push(x));
			const observer2 = (c: any) => c.forEach((x: any) => changes2.push(x));
			oarr.observe(observer1);
			oarr.observe(observer2);
			changes1.length.should.eq(0);
			changes2.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes1.length.should.eq(1);
				changes2.length.should.eq(1);
				JSON.stringify(oarr.observable).should.eq(`[1,2,33]`);
				// observers works! now let's unobserve
				oarr.unobserve([]);
				oarr.observable[2] = 77;
				setTimeout(() => {
					changes1.length.should.eq(2);
					changes2.length.should.eq(2);
					JSON.stringify(oarr.observable).should.eq(`[1,2,77]`);
					done();
				});
			});
		});

		it("unobserve (one item array arg)", (done) => {
			let changes1: any[] = [];
			let changes2: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			const observer1 = (c: any) => c.forEach((x: any) => changes1.push(x));
			const observer2 = (c: any) => c.forEach((x: any) => changes2.push(x));
			oarr.observe(observer1);
			oarr.observe(observer2);
			changes1.length.should.eq(0);
			changes2.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes1.length.should.eq(1);
				changes2.length.should.eq(1);
				JSON.stringify(oarr.observable).should.eq(`[1,2,33]`);
				// observers works! now let's unobserve
				oarr.unobserve([observer1]);
				oarr.observable[2] = 77;
				setTimeout(() => {
					changes1.length.should.eq(1);
					changes2.length.should.eq(2);
					JSON.stringify(oarr.observable).should.eq(`[1,2,77]`);
					done();
				});
			});
		});

		it("unobserve (one item arg)", (done) => {
			let changes1: any[] = [];
			let changes2: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			const observer1 = (c: any) => c.forEach((x: any) => changes1.push(x));
			const observer2 = (c: any) => c.forEach((x: any) => changes2.push(x));
			oarr.observe(observer1);
			oarr.observe(observer2);
			changes1.length.should.eq(0);
			changes2.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes1.length.should.eq(1);
				changes2.length.should.eq(1);
				JSON.stringify(oarr.observable).should.eq(`[1,2,33]`);
				// observers works! now let's unobserve
				oarr.unobserve(observer1);
				oarr.observable[2] = 77;
				setTimeout(() => {
					changes1.length.should.eq(1);
					changes2.length.should.eq(2);
					JSON.stringify(oarr.observable).should.eq(`[1,2,77]`);
					done();
				});
			});
		});

		it("unobserve (multiple items array arg)", (done) => {
			let changes1: any[] = [];
			let changes2: any[] = [];
			const oarr = o.observable([1, 2, 3]);
			const observer1 = (c: any) => c.forEach((x: any) => changes1.push(x));
			const observer2 = (c: any) => c.forEach((x: any) => changes2.push(x));
			oarr.observe(observer1);
			oarr.observe(observer2);
			changes1.length.should.eq(0);
			changes2.length.should.eq(0);
			oarr.observable[2] = 33;
			setTimeout(() => {
				changes1.length.should.eq(1);
				changes2.length.should.eq(1);
				JSON.stringify(oarr.observable).should.eq(`[1,2,33]`);
				// observers works! now let's unobserve
				oarr.unobserve([observer1, observer2]);
				oarr.observable[2] = 77;
				setTimeout(() => {
					changes1.length.should.eq(1);
					changes2.length.should.eq(1);
					JSON.stringify(oarr.observable).should.eq(`[1,2,77]`);
					done();
				});
			});
		});
	});

	describe("Observable nested arrays", () => {
		it("Creating observable arrays", () => {
			const oarr = o.observable([{ a: 1 }, { a: 2 }, { a: 3 }]);
			o.isObservable(oarr.observable).should.eq(true);
		});

		it("observation", (done) => {
			let changes = 0;
			const oarr = o.observable([{ a: 1 }, { a: 2 }, { a: 3 }]);
			oarr.observe((c) => (changes = changes + c.length));
			changes.should.eq(0);
			oarr.observable.push({ a: 4 }); // C
			oarr.observable[1] = { a: 22 }; // U
			oarr.observable.splice(0, 1); // D
			setTimeout(() => {
				changes.should.eq(3);
				done();
			});
		});

		it("Update", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([{ a: 1 }, { a: 2 }, { a: 3 }]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable[2].a = 33;
			setTimeout(() => {
				changes.length.should.eq(1);
				changes[0].type.should.eq("update");
				chai.expect(changes[0].value).eq(33);
				chai.expect(changes[0].oldValue).eq(3);
				changes[0].path.length.should.eq(2);
				Number(changes[0].path[0]).should.eq(2);
				JSON.stringify(changes[0].object).should.eq(`{"a":33}`);
				JSON.stringify(changes[0].snapshot).should.eq(`[{"a":1},{"a":2},{"a":33}]`);
				done();
			});
		});

        it("Silent update", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([{ a: 1 }, { a: 2 }, { a: 3 }]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable[2].a = 33;
			setTimeout(() => {
				changes.length.should.eq(1);
				changes[0].type.should.eq("update");
				chai.expect(changes[0].value).eq(33);
				chai.expect(changes[0].oldValue).eq(3);
				changes[0].path.length.should.eq(2);
				Number(changes[0].path[0]).should.eq(2);
				JSON.stringify(changes[0].object).should.eq(`{"a":33}`);
				JSON.stringify(changes[0].snapshot).should.eq(`[{"a":1},{"a":2},{"a":33}]`);
                oarr.silently((arr)=>{
                    arr[0].a++;
                })
                setTimeout(()=>{
                    changes.length.should.eq(1);
                    JSON.stringify(oarr.observable).should.eq(`[{"a":2},{"a":2},{"a":33}]`);
                    done();
                });
			});
		});

		it("Multiple changes", (done) => {
			let changes: any[] = [];
			const oarr = o.observable([
				{ a: 999, b: [{ c: 999 }] },
				{ a: 888, b: [{ c: 888 }] },
				{ a: 111, b: [{ c: 111 }] },
				{ a: 222, b: [{ c: 222 }] },
				{ a: 333, b: [{ c: 333 }] },
			]);
			oarr.observe((c) => c.forEach((x) => changes.push(x)));
			changes.length.should.eq(0);
			oarr.observable.push({ a: 444, b: [{ c: 444 }] }, { a: 555, b: [{ c: 555 }] });
			oarr.observable.splice(0, 2);
			oarr.observable[0].a = 1111;
			oarr.observable[3].b[0].c = 4444;
			oarr.observable[4].b.push({ c: 555.5 },{ c: 555.6 });
			setTimeout(() => {
                changes.length.should.eq(8);

				changes[0].type.should.eq("insert");
				chai.expect(changes[0].value).deep.eq({ a: 444, b: [{ c: 444 }] });
				chai.expect(changes[0].oldValue).eq(undefined);
				changes[0].path.length.should.eq(1);
				Number(changes[0].path[0]).should.eq(5);
				JSON.stringify(changes[0].snapshot).should.eq(`[{"a":999,"b":[{"c":999}]},{"a":888,"b":[{"c":888}]},{"a":111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[1].type.should.eq("insert");
				chai.expect(changes[1].value).deep.eq({ a: 555, b: [{ c: 555 }] });
				chai.expect(changes[1].oldValue).eq(undefined);
				changes[1].path.length.should.eq(1);
				Number(changes[1].path[0]).should.eq(6);
				JSON.stringify(changes[1].snapshot).should.eq(`[{"a":999,"b":[{"c":999}]},{"a":888,"b":[{"c":888}]},{"a":111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[2].type.should.eq("delete");
				chai.expect(changes[2].value).deep.eq(undefined);
				chai.expect(changes[2].oldValue).deep.eq({ a: 999, b: [{ c: 999 }] });
				changes[2].path.length.should.eq(1);
				Number(changes[2].path[0]).should.eq(0);
				JSON.stringify(changes[2].snapshot).should.eq(`[{"a":111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[3].type.should.eq("delete");
				chai.expect(changes[3].value).deep.eq(undefined);
				chai.expect(changes[3].oldValue).deep.eq({ a: 888, b: [{ c: 888 }] });
				changes[3].path.length.should.eq(1);
				Number(changes[3].path[0]).should.eq(1);
				JSON.stringify(changes[3].snapshot).should.eq(`[{"a":111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[4].type.should.eq("update");
				chai.expect(changes[4].value).deep.eq(1111);
				chai.expect(changes[4].oldValue).deep.eq(111);
				changes[4].path.length.should.eq(2);
				changes[4].path.should.deep.eq([0,"a"]);
				JSON.stringify(changes[4].snapshot).should.eq(`[{"a":1111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[5].type.should.eq("update");
				chai.expect(changes[5].value).deep.eq(4444);
				chai.expect(changes[5].oldValue).deep.eq(444);
				changes[5].path.length.should.eq(4);
				changes[5].path.should.deep.eq([3,"b", 0, "c"]);
				JSON.stringify(changes[5].snapshot).should.eq(`[{"a":1111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":4444}]},{"a":555,"b":[{"c":555}]}]`);

                changes[6].type.should.eq("insert");
				chai.expect(changes[6].value).deep.eq({ c: 555.5 });
				chai.expect(changes[6].oldValue).deep.eq(undefined);
				changes[6].path.length.should.eq(3);
				changes[6].path.should.deep.eq([4,"b", 1]);
				JSON.stringify(changes[6].snapshot).should.eq(`[{"a":1111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":4444}]},{"a":555,"b":[{"c":555},{"c":555.5},{"c":555.6}]}]`);

                changes[7].type.should.eq("insert");
				chai.expect(changes[7].value).deep.eq({ c: 555.6 });
				chai.expect(changes[7].oldValue).deep.eq(undefined);
				changes[7].path.length.should.eq(3);
				changes[7].path.should.deep.eq([4,"b", 2]);
				JSON.stringify(changes[7].snapshot).should.eq(`[{"a":1111,"b":[{"c":111}]},{"a":222,"b":[{"c":222}]},{"a":333,"b":[{"c":333}]},{"a":444,"b":[{"c":4444}]},{"a":555,"b":[{"c":555},{"c":555.5},{"c":555.6}]}]`);
                done();
			});
		});
	});
});
