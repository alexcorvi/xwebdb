import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json";
import ts from "@wessberg/rollup-plugin-ts";

export default [
	{
		input: "./src/index.ts",
		output: {
			name: pkg.name,
			file: pkg.main,
			format: "umd",
		},
		plugins: [
			ts(),
			resolve(),
			commonjs(),
		]
	}
];
