import { exists } from "fs-promise";
import * as path from "path";
import { CompilerOptions } from "typescript";

import { readJson } from "./util";

export async function checkPackageJson(dirPath: string): Promise<void> {
	const pkgJsonPath = path.join(dirPath, "package.json");
	if (!await exists(pkgJsonPath)) {
		return;
	}
	const pkgJson = await readJson(pkgJsonPath) as {};

	if ((pkgJson as any).private !== true) {
		throw new Error(`${pkgJsonPath} should set \`"private": true\``);
	}
	for (const key in pkgJson) { // tslint:disable-line forin
		switch (key) {
			case "private":
			case "dependencies":
			case "license":
				// "private" checked above, "dependencies" / "license" checked by types-publisher
				break;
			default:
				throw new Error(`${pkgJsonPath} should not include field ${key}`);
		}
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
		const isOlderVersion = /^v\d+$/.test(path.basename(dirPath));
		const baseUrl = isOlderVersion ? "../../" : "../";

		const mustHave = {
			module: "commonjs",
			noEmit: true,
			forceConsistentCasingInFileNames: true,
			esModuleInterop: true,
			baseUrl,
			typeRoots: [baseUrl],
			types: [],
		};

		for (const key of Object.getOwnPropertyNames(mustHave) as Array<keyof typeof mustHave>) {
			const expected = mustHave[key];
			const actual = options[key];
			if (!deepEquals(expected, actual)) {
				throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${JSON.stringify(expected)}`);
			}
		}

		for (const key in options) { // tslint:disable-line forin
			switch (key) {
				case "lib":
				case "noImplicitAny":
				case "noImplicitThis":
				case "strictNullChecks":
				case "strictFunctionTypes":
					break;
				case "target":
				case "paths":
				case "jsx":
				case "experimentalDecorators":
				case "noUnusedLocals":
				case "noUnusedParameters":
					// OK. "paths" checked further by types-publisher
					break;
				default:
					if (!(key in mustHave)) {
						throw new Error(`Unexpected compiler option ${key}`);
					}
			}
		}
	}

	if (!("lib" in options)) {
		throw new Error('Must specify "lib", usually to `"lib": ["es6"]` or `"lib": ["es6", "dom"]`.');
	}

	for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
		if (!(key in options)) {
			throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
		}
	}

	if (options.types && options.types.length) {
		throw new Error(
			'Use `/// <reference types="..." />` directives in source files and ensure ' +
			'that the "types" field in your tsconfig is an empty array.');
	}
}

function deepEquals(expected: {} | null | undefined, actual: {} | null | undefined): boolean {
	if (expected instanceof Array) {
		return actual instanceof Array
			&& actual.length === expected.length
			&& expected.every((e, i) => deepEquals(e, actual[i]));
	} else {
		return expected === actual;
	}
}
