#!/usr/bin/env node
import { exec } from "child_process";
import { readFile } from "fs-promise";
import { join as joinPaths } from "path";

import { parseTypeScriptVersionLine, TypeScriptVersion } from "./rules/definitelytyped-header-parser";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, install, installAll, tscPath } from "./installer";
import { checkTslintJson, lintWithVersion } from "./lint";

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	let noLint = false;
	let tsNext = false;
	let dirPath = process.cwd();

	for (const arg of args) {
		switch (arg) {
			case "--clean":
				console.log("Cleaning installs...");
				await cleanInstalls();
				return;

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

				dirPath = dirPath === undefined ? arg : joinPaths(dirPath, arg);
		}
	}

	await runTests(dirPath, noLint, tsNext);
}

function usage(): void {
	console.log("Usage: dtslint [--version] [--clean] [--noLint] [--tsNext] [--installAll]");
	console.log("Args:");
	console.log("  --version    Print version and exit.");
	console.log("  --clean      Clean TypeScript installs and install again.");
	console.log("  --noLint     Just run 'tsc'. (Not recommended.)");
	console.log("  --tsNext     Run with 'typescript@next' instead of the specified version.");
	console.log("  --installAll Cleans and installs all TypeScript versions.");
}

async function runTests(dirPath: string, noLint: boolean, tsNext: boolean): Promise<void> {
	const text = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	const dt = text.includes("// Type definitions for");
	const version = tsNext ? "next" : getTypeScriptVersion(text);

	await checkTslintJson(dirPath, dt);
	if (dt) {
		await checkPackageJson(dirPath);
	}
	await checkTsconfig(dirPath, dt);
	await test(dirPath, noLint, version);
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

async function test(dirPath: string, noLint: boolean, version: TypeScriptVersion | "next"): Promise<void> {
	const errorFromSpecifiedVersion = await testWithVersion(dirPath, noLint, version);
	if (!errorFromSpecifiedVersion) {
		return;
	}

	if (version !== TypeScriptVersion.Latest) {
		const errorFromLatest = await testWithVersion(dirPath, noLint, TypeScriptVersion.Latest);
		if (!errorFromLatest) {
			throw new Error(errorFromSpecifiedVersion +
				`Package compiles in TypeScript ${TypeScriptVersion.Latest} but not in ${version}.\n` +
				`You can add a line '// TypeScript Version: ${TypeScriptVersion.Latest}' to the end of the header ` +
				"to specify a newer compiler version.");
		}
	}
	throw new Error(errorFromSpecifiedVersion);
}

async function testWithVersion(
		dirPath: string, noLint: boolean, version: TypeScriptVersion | "next"): Promise<string | undefined> {
	await install(version);
	if (noLint) {
		// Special for old DefinitelyTyped packages that aren't linted yet.
		return execScript("node " + tscPath(version), dirPath);
	} else {
		return lintWithVersion(dirPath, version);
	}
}

function execScript(cmd: string, cwd?: string): Promise<string | undefined> {
	return new Promise<string>(resolve => {
		exec(cmd, { encoding: "utf8", cwd }, (err, stdout, stderr) => resolve(err ? stdout + stderr : undefined));
	});
}

if (!module.parent) {
	main().catch(err => {
		console.error(err.message);
		process.exit(1);
	});
}
