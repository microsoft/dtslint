import { TypeScriptVersion } from "definitelytyped-header-parser";
import { exists, readFile } from "fs-promise";
import * as path from "path";
import { Configuration, ILinterOptions } from "tslint";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { Options, TestError } from "./index";
import { getLinter, rulesDirectory } from "./installer";
import { readJson } from "./util";

export async function lintWithVersion(dirPath: string, options: Options, version: TypeScriptVersion): Promise<TestError | undefined> {
	const tslint = await getLinter(version);
	const program = tslint.Linter.createProgram(path.join(dirPath, "tsconfig.json"));
	global.program = program;

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
	return result.failureCount ? { message: result.output } : undefined;
}

async function getLintConfig(configuration: Configuration, configPath: string, options: Options): Promise<IConfigurationFile> {
	if (!await exists(configPath)) {
		return defaultConfig(configuration, options);
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

function defaultConfig(configuration: Configuration, { dt }: Options): IConfigurationFile {
	const name = dt ? "dtslint-definitelytyped.json" : "dtslint.json";
	return loadConfiguration(configuration, path.join(__dirname, "..", name));
}
