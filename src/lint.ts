import assert = require("assert");
import { TypeScriptVersion } from "definitelytyped-header-parser";
import { pathExists } from "fs-extra";
import { join as joinPaths } from "path";
import { Configuration, ILinterOptions, Linter } from "tslint";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { Options as ExpectOptions } from "./rules/expectRule";

import { typeScriptPath } from "./installer";
import { readJson } from "./util";

export async function lint(dirPath: string, minVersion: TsVersion, maxVersion: TsVersion): Promise<string | undefined> {
	const lintConfigPath = getConfigPath(dirPath);
	const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
	const program = Linter.createProgram(tsconfigPath);

	const lintOptions: ILinterOptions = {
		fix: false,
		formatter: "stylish",
	};
	const linter = new Linter(lintOptions, program);
	const { config, expectOnlyConfig } = await getLintConfig(lintConfigPath, tsconfigPath, minVersion, maxVersion);

	for (const file of program.getSourceFiles()) {
		if (program.isSourceFileDefaultLibrary(file)) { continue; }

		const { fileName, text } = file;
		const err = testNoTsIgnore(text) || testNoTslintDisables(text);
		if (err) {
			const { pos, message } = err;
			const place = file.getLineAndCharacterOfPosition(pos);
			return `At ${fileName}:${JSON.stringify(place)}: ${message}`;
		}
		const isExternal = !startsWithDirectory(fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
		linter.lint(fileName, text, isExternal ? expectOnlyConfig : config);
	}

	const result = linter.getResult();
	return result.failures.length ? result.output : undefined;
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
	assert(!dirPath.endsWith("/"));
	return filePath.startsWith(dirPath + "/");
}

interface Err { pos: number; message: string; }
function testNoTsIgnore(text: string): Err | undefined {
	const tsIgnore = "ts-ignore";
	const pos = text.indexOf(tsIgnore);
	return pos === -1 ? undefined : { pos, message: "'ts-ignore' is forbidden." };
}
function testNoTslintDisables(text: string): Err | undefined {
	const tslintDisable = "tslint:disable";
	let lastIndex = 0;
	while (true) {
		const pos = text.indexOf(tslintDisable, lastIndex);
		if (pos === -1) {
			return undefined;
		}
		const end = pos + tslintDisable.length;
		const nextChar = text.charAt(end);
		if (nextChar !== "-" && nextChar !== ":") {
			const message = "'tslint:disable' is forbidden. " +
				"('tslint:disable:rulename', tslint:disable-line' and 'tslint:disable-next-line' are allowed.)";
			return { pos, message };
		}
		lastIndex = end;
	}
}

export async function checkTslintJson(dirPath: string, dt: boolean): Promise<void> {
	const configPath = getConfigPath(dirPath);
	const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
	if (!await pathExists(configPath)) {
		if (dt) {
			throw new Error(
				`On DefinitelyTyped, must include \`tslint.json\` containing \`{ "extends": "${shouldExtend}" }\`.\n` +
				"This was inferred as a DefinitelyTyped package because it contains a `// Type definitions for` header.");
		}
		return;
	}

	const tslintJson = await readJson(configPath);
	if (tslintJson.extends !== shouldExtend) {
		throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
	}
}

function getConfigPath(dirPath: string): string {
	return joinPaths(dirPath, "tslint.json");
}

async function getLintConfig(
	expectedConfigPath: string,
	tsconfigPath: string,
	minVersion: TsVersion,
	maxVersion: TsVersion,
): Promise<{ readonly config: IConfigurationFile, readonly expectOnlyConfig: IConfigurationFile }> {
	const configExists = await pathExists(expectedConfigPath);
	const configPath = configExists ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
	// Second param to `findConfiguration` doesn't matter, since config path is provided.
	const config = Configuration.findConfiguration(configPath, "").results;
	if (!config) {
		throw new Error(`Could not load config at ${configPath}`);
	}

	const expectRule = config.rules.get("expect");
	if (!expectRule || expectRule.ruleSeverity !== "error") {
		throw new Error("'expect' rule should be enabled, else compile errors are ignored");
	}
	if (expectRule) {
		const versionsToTest = range(minVersion, maxVersion).map(versionName =>
			({ versionName, path: typeScriptPath(versionName) }));
		const expectOptions: ExpectOptions = { tsconfigPath, versionsToTest };
		expectRule.ruleArguments = [expectOptions];
	}
	const expectOnlyConfig: IConfigurationFile = {
		extends: [],
		rulesDirectory: config.rulesDirectory,
		rules: new Map([["expect", expectRule]]),
		jsRules: new Map(),
	};
	return { config, expectOnlyConfig };
}

function range(minVersion: TsVersion, maxVersion: TsVersion): ReadonlyArray<TsVersion> {
	if (minVersion === "next") {
		assert(maxVersion === "next");
		return ["next"];
	}

	const minIdx = TypeScriptVersion.all.indexOf(minVersion);
	assert(minIdx >= 0);
	if (maxVersion === "next") {
		return [...TypeScriptVersion.all.slice(minIdx), "next"];
	}

	const maxIdx = TypeScriptVersion.all.indexOf(maxVersion);
	assert(maxIdx >= minIdx);
	return TypeScriptVersion.all.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "next";
