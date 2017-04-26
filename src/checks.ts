import { exists } from "fs-promise";
import * as path from "path";
import { CompilerOptions } from "typescript";

import { readJson } from "./util";

export async function checkPackageJson(dirPath: string): Promise<void> {
	const pkgJsonPath = path.join(dirPath, "package.json");
	if (!await exists(pkgJsonPath)) {
		return;
	}
	const pkgJson = await readJson(pkgJsonPath);
	const ignoredField = Object.keys(pkgJson).find(field =>
		!["dependencies", "peerDependencies", "description"].includes(field));
	if (ignoredField) {
		throw new Error(`Ignored field in ${pkgJsonPath}: ${ignoredField}`);
	}
}

export async function checkTsconfig(dirPath: string, dt: boolean): Promise<void> {
	const tsconfigPath = path.join(dirPath, "tsconfig.json");
	if (!await exists(tsconfigPath)) {
		throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
	}
	const tsconfig = await readJson(tsconfigPath);

	const options: CompilerOptions = tsconfig.compilerOptions;

	if (dt) {
		const mustHave = {
			module: "commonjs",
			// target: "es6", // Some libraries use an ES5 target, such as es6-shim
			noEmit: true,
			forceConsistentCasingInFileNames: true,
		};

		for (const key of Object.getOwnPropertyNames(mustHave)) {
			const value = (mustHave as any)[key];
			if (options[key] !== value) {
				throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${value}`);
			}
		}
	}

	if (!("lib" in options)) {
		throw new Error('Must specify "lib", usually to `"lib": ["es6"]` or `"lib": ["es6", "dom"]`.');
	}

	for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks"]) {
		if (!(key in options)) {
			throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
		}
	}

	if (dt) {
		if (("typeRoots" in options) && !("types" in options)) {
			throw new Error(
				'If the "typeRoots" option is specified in your tsconfig, ' +
				'you must include `"types": []` to prevent very long compile times.');
		}
	}

	if (options.types && options.types.length) {
		throw new Error(
			'Use `/// <reference types="..." />` directives in source files and ensure ' +
			'that the "types" field in your tsconfig is an empty array.');
	}
}
