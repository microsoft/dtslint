#!/usr/bin/env node
import { isTypeScriptVersion, parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { readdir, readFile, stat } from "fs-extra";
import { basename, dirname, join as joinPaths } from "path";

import { checkPackageJson, checkTsconfig } from "./checks";
import { checkTslintJson, lint, TsVersion } from "./lint";
import { assertDefined, last, mapDefinedAsync, withoutPrefix } from "./util";

export { cleanInstalls, installAll, installNext } from "./installer";

export async function runTests(dirPath: string, onlyTestTsNext: boolean): Promise<void> {
	const isOlderVersion = /^v\d+$/.test(basename(dirPath));

	const indexText = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	// If this *is* on DefinitelyTyped, types-publisher will fail if it can't parse the header.
	const dt = indexText.includes("// Type definitions for");
	if (dt) {
		// Someone may have copied text from DefinitelyTyped to their type definition and included a header,
		// so assert that we're really on DefinitelyTyped.
		assertPathIsInDefinitelyTyped(dirPath);
	}

	const typesVersions = await mapDefinedAsync(await readdir(dirPath), async name => {
		if (name === "tsconfig.json" || name === "tslint.json" || name === "tsutils") { return undefined; }
		const version = withoutPrefix(name, "ts");
		if (version === undefined || !(await stat(joinPaths(dirPath, name))).isDirectory()) { return undefined; }

		if (!isTypeScriptVersion(version)) {
			throw new Error(`There is an entry named ${name}, but ${version} is not a valid TypeScript version.`);
		}
		if (!TypeScriptVersion.isRedirectable(version)) {
			throw new Error(`At ${dirPath}/${name}: TypeScript version directories only available starting with ts3.1.`);
		}
		return version;
	});

	if (dt) {
		await checkPackageJson(dirPath, typesVersions);
	}

	if (onlyTestTsNext) {
		if (typesVersions.length === 0) {
			await testTypesVersion(dirPath, "next", "next", isOlderVersion, dt, indexText);
		} else {
			const latestTypesVersion = last(typesVersions);
			const versionPath = joinPaths(dirPath, `ts${latestTypesVersion}`);
			const versionIndexText = await readFile(joinPaths(versionPath, "index.d.ts"), "utf-8");
			await testTypesVersion(versionPath, "next", "next", isOlderVersion, dt, versionIndexText);
		}
	} else {
		await testTypesVersion(dirPath, undefined, getTsVersion(0), isOlderVersion, dt, indexText);
		for (let i = 0; i < typesVersions.length; i++) {
			const version = typesVersions[i];
			const versionPath = joinPaths(dirPath, `ts${version}`);
			const versionIndexText = await readFile(joinPaths(versionPath, "index.d.ts"), "utf-8");
			await testTypesVersion(
				versionPath, version, getTsVersion(i + 1), isOlderVersion, dt, versionIndexText,
				/*inTypesVersionDirectory*/ true);
		}

		function getTsVersion(i: number): TsVersion {
			return i === typesVersions.length ? "next" : assertDefined(TypeScriptVersion.previous(typesVersions[i]));
		}
	}
}

async function testTypesVersion(
	dirPath: string,
	lowVersion: TsVersion | undefined,
	maxVersion: TsVersion,
	isOlderVersion: boolean,
	dt: boolean,
	indexText: string,
	inTypesVersionDirectory?: boolean,
): Promise<void> {
	const minVersionFromComment = getTypeScriptVersionFromComment(indexText);
	if (minVersionFromComment !== undefined && inTypesVersionDirectory) {
		throw new Error(`Already in the \`ts${lowVersion}\` directory, don't need \`// TypeScript Version\`.`);
	}
	if (minVersionFromComment !== undefined && TypeScriptVersion.isRedirectable(minVersionFromComment)) {
		throw new Error(`Don't use \`// TypeScript Version\` for newer TS versions, use typesVerisons instead.`);
	}
	const minVersion = lowVersion || minVersionFromComment || TypeScriptVersion.lowest;

	await checkTslintJson(dirPath, dt);
	await checkTsconfig(dirPath, dt
		? { relativeBaseUrl: ".." + (isOlderVersion ? "/.." : "") + (inTypesVersionDirectory ? "/.." : "") + "/" }
		: undefined);
	const err = await lint(dirPath, minVersion, maxVersion, !!inTypesVersionDirectory);
	if (err) {
		throw new Error(err);
	}
}

function assertPathIsInDefinitelyTyped(dirPath: string): void {
	const parent = dirname(dirPath);
	const types = /^v\d+$/.test(basename(dirPath)) ? dirname(parent) : parent;
	const dt = dirname(types);
	if (basename(dt) !== "DefinitelyTyped" || basename(types) !== "types") {
		throw new Error("Since this type definition includes a header (a comment starting with `// Type definitions for`), "
			+ "assumed this was a DefinitelyTyped package.\n"
			+ "But it is not in a `DefinitelyTyped/types/xxx` directory.");
	}
}

function getTypeScriptVersionFromComment(text: string): TypeScriptVersion | undefined {
	const searchString = "// TypeScript Version: ";
	const x = text.indexOf(searchString);
	if (x === -1) {
		return undefined;
	}

	let line = text.slice(x, text.indexOf("\n", x));
	if (line.endsWith("\r")) {
		line = line.slice(0, line.length - 1);
	}
	return parseTypeScriptVersionLine(line);
}
