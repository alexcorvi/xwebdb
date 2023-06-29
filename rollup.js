const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const rollup = require("rollup");
const { rmSync, writeFileSync, renameSync, copyFileSync } = require("fs");
const { execSync } = require("child_process");
const { minify } = require("terser");

async function buildMain() {
	const pkg = require("./package.json");
	let bundle;
	try {
		rmSync("./dist", { recursive: true, force: true });
		execSync("tsc --emitDeclarationOnly");
		renameSync("./dist/index.d.ts", pkg.types);
		bundle = await rollup.rollup({
			input: "./src/index.ts",
			plugins: [resolve(), typescript()],
		});

		// UMD
		const code = (await bundle.generate({ name: pkg.name, format: "umd" })).output[0].code;
		writeFileSync(pkg.main, code);

		// UMD Minified
		writeFileSync(
			pkg.main.replace(/\.js$/, ".min.js"),
			(await minify(code, { compress: true })).code
		);

		// ES Module
		const codeModule = (await bundle.generate({ format: "module" })).output[0].code;
		writeFileSync(pkg.module, codeModule);
	} catch (error) {
		buildFailed = true;
		console.error(error);
	}
	if (bundle) {
		await bundle.close();
	}
}

async function buildKVAdapter() {
	const pkg = require("./src/adapters/kv/package.json");
	let bundle;
	try {
		bundle = await rollup.rollup({
			input: "./src/adapters/kv/kv.ts",
			plugins: [resolve(), typescript()],
		});

		// UMD
		const code = (await bundle.generate({ name: pkg.name, format: "umd" })).output[0].code;
		writeFileSync("./dist/adapters/kv/" + pkg.main, code);

		// UMD Minified
		writeFileSync(
			"./dist/adapters/kv/" + pkg.main.replace(/\.js$/, ".min.js"),
			(await minify(code, { compress: true })).code
		);

		// ES Module
		const codeModule = (await bundle.generate({ format: "module" })).output[0].code;
		writeFileSync("./dist/adapters/kv/" + pkg.module, codeModule);

		// copying pkg and .d.ts
		copyFileSync("./src/adapters/kv/kv.d.ts", "./dist/adapters/kv/kv.d.ts");
		copyFileSync("./src/adapters/kv/package.json", "./dist/adapters/kv/package.json");
		copyFileSync("./src/adapters/kv/README.md", "./dist/adapters/kv/README.md");
	} catch (error) {
		buildFailed = true;
		console.error(error);
	}
	if (bundle) {
		await bundle.close();
	}
}

buildMain();
buildKVAdapter();
