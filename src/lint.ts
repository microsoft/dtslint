import { TypeScriptVersion } from "definitelytyped-header-parser";
import { pathExists, readFile } from "fs-extra";
import { join as joinPaths } from "path";
import { Configuration, ILinterOptions, Linter } from "tslint";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { Options as ExpectOptions } from "./rules/expectRule";

import { typeScriptPath } from "./installer";
import { readJson } from "./util";

export async function lint(
	dirPath: string,
	minVersion: TypeScriptVersion,
	onlyTestTsNext: boolean,
): Promise<string | undefined> {
	const lintConfigPath = getConfigPath(dirPath);
	const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
	const program = Linter.createProgram(tsconfigPath);

	const lintOptions: ILinterOptions = {
		fix: false,
		formatter: "stylish",
	};
	const linter = new Linter(lintOptions, program);
	const config = await getLintConfig(lintConfigPath, tsconfigPath, minVersion, onlyTestTsNext);

	for (const filename of program.getRootFileNames()) {
		const contents = await readFile(filename, "utf-8");
		const err = testNoTsIgnore(contents) || testNoTslintDisables(contents);
		if (err) {
			const { pos, message } = err;
			const place = program.getSourceFile(filename)!.getLineAndCharacterOfPosition(pos);
			return `At ${filename}:${JSON.stringify(place)}: ${message}`;
		}
		linter.lint(filename, contents, config);
	}

	const result = linter.getResult();
	return result.failures.length ? result.output : undefined;
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
		if (text.charAt(end) !== "-") {
			const message = "'tslint:disable' is forbidden. ('tslint:disable-line' and 'tslint:disable-next-line' are allowed.)";
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
	minVersion: TypeScriptVersion,
	onlyTestTsNext: boolean,
): Promise<IConfigurationFile> {
	const configExists = await pathExists(expectedConfigPath);
	const configPath = configExists ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
	// Second param to `findConfiguration` doesn't matter, since config path is provided.
	const config = Configuration.findConfiguration(configPath, "").results;
	if (!config) {
		throw new Error(`Could not load config at ${configPath}`);
	}

	const expectRule = config.rules.get("expect");
	if (expectRule) {
		const expectOptions: ExpectOptions = {
			tsconfigPath,
			tsNextPath: typeScriptPath("next"),
			olderInstalls: TypeScriptVersion.range(minVersion).map(versionName =>
				({ versionName, path: typeScriptPath(versionName) })),
			onlyTestTsNext,
		};
		expectRule.ruleArguments = [expectOptions];
	}
	return config;
}
