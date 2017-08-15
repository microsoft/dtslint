#!/usr/bin/env node
import { exec } from "child_process";
import { readFile } from "fs-promise";
import { join as joinPaths } from "path";

import { parseTypeScriptVersionLine, TypeScriptVersion } from "./rules/definitelytyped-header-parser";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, installAll, tscPath } from "./installer";
import { checkTslintJson, lint } from "./lint";

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	let noLint = false;
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

			default:
				if (arg.startsWith("--")) {
					console.error(`Unknown option '${arg}'`);
					usage();
					process.exit(1);
				}

				if (arg.indexOf('@') === 0 && arg.indexOf('/') !== -1) {
					// we have a scoped module, e.g. @bla/foo
					// which should be converted to   bla__foo
					arg = arg.substr(1).replace('/', '__');
				}
				dirPath = dirPath === undefined ? arg : joinPaths(dirPath, arg);
		}
	}

	await installAll();
	await runTests(dirPath, noLint);
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

async function runTests(dirPath: string, noLint: boolean): Promise<void> {
	const text = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	const dt = text.includes("// Type definitions for");
	const minVersion = getTypeScriptVersion(text);

	if (!noLint) {
		await checkTslintJson(dirPath, dt);
	}
	if (dt) {
		await checkPackageJson(dirPath);
	}
	await checkTsconfig(dirPath, dt);
	const err = await test(dirPath, noLint, minVersion);
	if (err) {
		console.error(err);
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

async function test(dirPath: string, noLint: boolean, minVersion: TypeScriptVersion): Promise<string | undefined> {
	if (noLint) {
		for (const tsVersion of ["next" as "next", minVersion]) {
			// Special for old DefinitelyTyped packages that aren't linted yet.
			const err = await execScript("node " + tscPath(tsVersion), dirPath);
			if (err !== undefined) {
				return `Error in TypeScript@${tsVersion}: ${err}`;
			}
		}
		return undefined;
	} else {
		return lint(dirPath, minVersion);
	}
}

function execScript(cmd: string, cwd?: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		exec(cmd, { encoding: "utf8", cwd }, (err, stdout, stderr) => {
			if (err) {
				reject(stdout + stderr);
			} else {
				resolve();
			}
		});
	});
}

if (!module.parent) {
	main().catch(err => {
		console.error(err.message);
		process.exit(1);
	});
}
