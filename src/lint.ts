import { exists, readFile } from "fs-promise";
import * as path from "path";
import { Configuration, ILinterOptions } from "tslint";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { TypeScriptVersion } from "./rules/definitelytyped-header-parser";

import { Options, TestError } from "./index";
import { getLinter, rulesDirectory } from "./installer";
import { readJson } from "./util";

export async function lintWithVersion(
	dirPath: string, options: Options, version: TypeScriptVersion | "next"): Promise<TestError | undefined> {
	const tslint = getLinter(version);
	const program = tslint.Linter.createProgram(path.join(dirPath, "tsconfig.json"));

	const lintOptions: ILinterOptions = {
		fix: false,
		formatter: "stylish",
		rulesDirectory: rulesDirectory(version),
	};
	const linter = new tslint.Linter(lintOptions, program);
	const config = await getLintConfig(tslint.Configuration, path.join(dirPath, "tslint.json"), options);

	for (const filename of program.getRootFileNames()) {
		const contents = await readFile(filename, "utf-8");
		linter.lint(filename, contents, config);
	}

	const result = linter.getResult();
	return result.failures.length ? { message: result.output } : undefined;
}

async function getLintConfig(
		configuration: Configuration,
		configPath: string,
		options: Options,
		): Promise<IConfigurationFile> {
	if (!await exists(configPath)) {
		if (options.dt) {
			throw new Error('On DefinitelyTyped, must include `tslint.json` containing `{ "extends": "../tslint.json" }`');
		}
		return defaultConfig(configuration);
	}

	const tslintJson = await readJson(configPath);
	if (!tslintJson.extends) {
		const shouldExtend = options.dt ? "../tslint.json" : "dtslint/dtslint.json";
		throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
	}

	return loadConfiguration(configuration, configPath);
}

function loadConfiguration(configuration: Configuration, configPath: string): IConfigurationFile {
	// Second param doesn't matter, since config path is provided.
	const config = configuration.findConfiguration(configPath, "").results;
	if (!config) {
		throw new Error(`Could not load config at ${configPath}`);
	}
	return config;
}

function defaultConfig(configuration: Configuration): IConfigurationFile {
	return loadConfiguration(configuration, path.join(__dirname, "..", "dtslint.json"));
}
