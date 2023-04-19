import pkg from "./package.json";
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
export default [
	{
		input: "./src/index.ts",
		output: {
			name: pkg.name,
			file: pkg.main,
			format: "umd",
		},
		plugins: [resolve(), typescript()]
	}
];