#!/usr/bin/env node
import { exec } from "child_process";
import { parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { readFile } from "fs-promise";
import { join as joinPaths } from "path";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, installAll, tscPath } from "./installer";
import { checkTslintJson, lint } from "./lint";

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	let noLint = false;
	let dirPath = process.cwd();

	for (const arg of args) {
		switch (arg) {
			case "--installAll":
				console.log("Cleaning old installs and installing for all TypeScript versions...");
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

				const path = arg.indexOf("@") === 0 && arg.indexOf("/") !== -1
					// we have a scoped module, e.g. @bla/foo
					// which should be converted to   bla__foo
					? arg.substr(1).replace("/", "__")
					: arg;
				dirPath = dirPath === undefined ? path : joinPaths(dirPath, path);
		}
	}

	await installAll();
	await runTests(dirPath, noLint);
}

function usage(): void {
	console.error("Usage: dtslint [--version] [--noLint] [--installAll]");
	console.error("Args:");
	console.error("  --version    Print version and exit.");
	console.error("  --noLint     Just run 'tsc'. (Not recommended.)");
	console.error("  --installAll Cleans and installs all TypeScript versions.");
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
		throw new Error(err);
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

function execScript(cmd: string, cwd?: string): Promise<string | undefined> {
	return new Promise<string | undefined>(resolve => {
		exec(cmd, { encoding: "utf8", cwd }, (err, stdout, stderr) => {
			if (err) {
				resolve(stdout + stderr);
			} else {
				resolve(undefined);
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
