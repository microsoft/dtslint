#!/usr/bin/env node
import { exec } from "child_process";
import { parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { readFile } from "fs-promise";
import * as path from "path";
import { Program } from "typescript";
import * as yargs from "yargs";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, install, tscPath } from "./installer";
import { lintWithVersion } from "./lint";

export interface Options {
	dt: boolean;
	noLint: boolean;
	tsNext: boolean;
}

async function main(): Promise<void> {
	const argv = yargs.argv;

	for (const key in argv) {
		if (!(["_", "clean", "dt", "version", "noLint", "tsNext"].includes(key) || /^\$\d$/.test(key))) {
			console.error(`Unexpected argument '${key}'\n`);
			usage();
			return;
		}
	}

	if (argv.version) {
		console.log(require("../package.json").version);
		return;
	}

	if (argv.clean) {
		console.log("Cleaning typescript installs...");
		await cleanInstalls();
		console.log("Cleaned.");
	}

	const cwd = process.cwd();
	const name = argv._[0];
	const dirPath = name ? path.join(cwd, name) : cwd;
	await runTests(dirPath, { dt: !!argv.dt, noLint: !!argv.noLint, tsNext: !!argv.tsNext });
}

function usage() {
	console.log("Usage: dtslint [--dt] [--clean]");
	console.log("Args:");
	console.log("  --version Print version and exit.");
	console.log("  --dt     Run extra checks for DefinitelyTyped packages.");
	console.log("  --clean  Clean typescript installs and install again.");
	console.log("  --noLint Just run 'tsc'.");
	console.log("  --tsNext Run with 'typescript@next' instead of the specified version.");
}

// KLUDGE -- tslint creates a duplicate program, so must set this to the original program.
// See https://github.com/palantir/tslint/issues/1969 and https://github.com/palantir/tslint/pull/2235
declare global {
	namespace NodeJS {
		interface Global { program: Program; }
	}
}

async function runTests(dirPath: string, options: Options): Promise<void> {
	try {
		const text = await readFile(path.join(dirPath, "index.d.ts"), "utf-8");
		if (text.includes("// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped") && !options.dt) {
			console.warn("Warning: Text includes DefinitelyTyped link, but '--dt' is not set.");
		}
		const version = options.tsNext ? "next" : getTypeScriptVersion(text);

		if (options.dt) {
			await checkPackageJson(dirPath);
		}
		await checkTsconfig(dirPath, options);
		await test(dirPath, options, version);
	} catch (e) {
		console.error(e.message);
		process.exit(1);
	}
}

function getTypeScriptVersion(text: string): TypeScriptVersion {
	const searchString = "// TypeScript Version: ";
	const x = text.indexOf(searchString);
	if (x === -1) {
		return "2.0";
	}

	let line = text.slice(x, text.indexOf("\n", x));
	if (line.endsWith("\r")) {
		line = line.slice(0, line.length - 1);
	}
	return parseTypeScriptVersionLine(line);
}

async function test(dirPath: string, options: Options, version: TypeScriptVersion | "next"): Promise<void> {
	const a = await testWithVersion(dirPath, options, version);
	if (a) {
		if (version !== TypeScriptVersion.Latest) {
			const b = await testWithVersion(dirPath, options, TypeScriptVersion.Latest);
			if (!b) {
				throw new Error(a.message +
					`Package compiles in TypeScript ${TypeScriptVersion.Latest} but not in ${version}.\n` +
					`You can add a line '// TypeScript Version: ${TypeScriptVersion.Latest}' to the end of the header ` +
					"to specify a newer compiler version.");
			}
		}
		throw new Error(a.message);
	}
}

export interface TestError { message: string; }

async function testWithVersion(dirPath: string, options: Options, version: TypeScriptVersion | "next"): Promise<TestError | undefined> {
	await install(version);
	if (options.noLint) {
		// Special for old DefinitelyTyped packages that aren't linted yet.
		return execScript("node " + tscPath(version), dirPath);
	} else {
		return lintWithVersion(dirPath, options, version);
	}
}

function execScript(cmd: string, cwd?: string): Promise<TestError | undefined> {
	return new Promise<TestError>(resolve => {
		// Resolves with 'err' if it's present.
		exec(cmd, { encoding: "utf8", cwd }, resolve);
	});
}

if (!module.parent) {
	main().catch(console.error);
}
