import { exists, readFile } from "fs-promise";
import { join as joinPaths } from "path";
import { Configuration, ILinterOptions } from "tslint";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { TypeScriptVersion } from "./rules/definitelytyped-header-parser";

import { getLinter, rulesDirectory } from "./installer";
import { readJson } from "./util";

export async function lintWithVersion(
		dirPath: string, version: TypeScriptVersion | "next"): Promise<string | undefined> {
	const configPath = getConfigPath(dirPath);
	const tslint = getLinter(version);
	console.log(configPath);
	const program = tslint.Linter.createProgram(joinPaths(dirPath, "tsconfig.json"));

	const lintOptions: ILinterOptions = {
		fix: false,
		formatter: "stylish",
		rulesDirectory: rulesDirectory(version),
	};
	const linter = new tslint.Linter(lintOptions, program);
	const config = await getLintConfig(tslint.Configuration, configPath);

	for (const filename of program.getRootFileNames()) {
		const contents = await readFile(filename, "utf-8");
		linter.lint(filename, contents, config);
	}

	const result = linter.getResult();
	return result.failures.length ? result.output : undefined;
}

export async function checkTslintJson(dirPath: string, dt: boolean): Promise<void> {
	const configPath = getConfigPath(dirPath);
	const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
	if (!await exists(configPath)) {
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

async function getLintConfig(configuration: Configuration, expectedConfigPath: string): Promise<IConfigurationFile> {
	const configPath = await exists(expectedConfigPath) ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
	// Second param to `findConfiguration` doesn't matter, since config path is provided.
	const config = configuration.findConfiguration(configPath, "").results;
	if (!config) {
		throw new Error(`Could not load config at ${configPath}`);
	}
	return config;
}
