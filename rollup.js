const pkg = require("./package.json");
const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const rollup = require("rollup");
const { rmSync, writeFileSync, renameSync } = require("fs");
const { execSync } = require("child_process");
const {minify} = require("terser");
async function build() {
	let bundle;
	let buildFailed = false;
	try {
		rmSync("./dist", { recursive: true });
		execSync("tsc --emitDeclarationOnly");
		renameSync("./dist/index.d.ts", pkg.types);
		bundle = await rollup.rollup({
			input: "./src/index.ts",
			plugins: [resolve(), typescript()],
		});
		const code = (await bundle.generate({ name: pkg.name, format: "umd" }))
			.output[0].code;
		writeFileSync(pkg.main, code);
		writeFileSync(pkg.main.replace(/\.js$/, ".min.js"), (await minify(code, { compress: true })).code)
	} catch (error) {
		buildFailed = true;
		console.error(error);
	}
	if (bundle) {
		await bundle.close();
	}
	process.exit(buildFailed ? 1 : 0);
}

build();
