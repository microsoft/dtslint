#!/usr/bin/env node
import { exec } from "child_process";
import { readFile } from "fs-promise";
import { join as joinPaths } from "path";

import { parseTypeScriptVersionLine, TypeScriptVersion } from "./rules/definitelytyped-header-parser";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, install, installAll, tscPath } from "./installer";
import { lintWithVersion } from "./lint";

export interface Options {
	dt: boolean;
	noLint: boolean;
	tsNext: boolean;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	let clean = false;
	let dt = false;
	let noLint = false;
	let tsNext = false;
	let cwdSubDir: string | undefined;

	for (const arg of args) {
		switch (arg) {
			case "--clean":
				clean = true;
				break;

			case "--dt":
				dt = true;
				break;

			case "--installAll":
				console.log("Installing for all TypeScript versions...");
				await cleanInstalls();
				await installAll();
				return;

			case "--version":
				console.log(require("../package.json").version);
				return;

			case "--noLint":
				noLint = true;
				break;

			case "--tsNext":
				tsNext = true;
				break;

			default:
				if (arg.startsWith("--")) {
					console.error(`Unknown option '${arg}'`);
					usage();
					process.exit(1);
				}

				cwdSubDir = cwdSubDir === undefined ? arg : joinPaths(cwdSubDir, arg);
		}
	}

	if (clean) {
		await cleanInstalls();
	}

	const cwd = process.cwd();
	const dirPath = cwdSubDir ? joinPaths(cwd, cwdSubDir) : cwd;
	await runTests(dirPath, { dt, noLint, tsNext });
}

function usage(): void {
	console.log("Usage: dtslint [--dt] [--clean]");
	console.log("Args:");
	console.log("  --version    Print version and exit.");
	console.log("  --dt         Run extra checks for DefinitelyTyped packages.");
	console.log("  --clean      Clean TypeScript installs and install again.");
	console.log("  --noLint     Just run 'tsc'.");
	console.log("  --tsNext     Run with 'typescript@next' instead of the specified version.");
	console.log("  --installAll Cleans and installs all TypeScript versions.");
}

async function runTests(dirPath: string, options: Options): Promise<void> {
	const text = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	if (text.includes("// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped") && !options.dt) {
		console.warn("Warning: Text includes DefinitelyTyped link, but '--dt' is not set.");
	}
	const version = options.tsNext ? "next" : getTypeScriptVersion(text);

	if (options.dt) {
		await checkPackageJson(dirPath);
	}
	await checkTsconfig(dirPath, options);
	await test(dirPath, options, version);
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

async function testWithVersion(
		dirPath: string,
		options: Options,
		version: TypeScriptVersion | "next",
		): Promise<TestError | undefined> {
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
	main().catch(err => {
		console.error(err.message);
		process.exit(1);
	});
}
