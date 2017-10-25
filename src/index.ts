#!/usr/bin/env node
import { parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { readFile } from "fs-promise";
import { join as joinPaths } from "path";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, installAll } from "./installer";
import { checkTslintJson, lint } from "./lint";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
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
	await runTests(dirPath);
}

function usage(): void {
	console.error("Usage: dtslint [--version] [--noLint] [--installAll]");
	console.error("Args:");
	console.error("  --version    Print version and exit.");
	console.error("  --noLint     Just run 'tsc'. (Not recommended.)");
	console.error("  --installAll Cleans and installs all TypeScript versions.");
}

async function runTests(dirPath: string): Promise<void> {
	const text = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	const dt = text.includes("// Type definitions for");
	const minVersion = getTypeScriptVersion(text);

	await checkTslintJson(dirPath, dt);
	if (dt) {
		await checkPackageJson(dirPath);
	}
	await checkTsconfig(dirPath, dt);
	const err = await test(dirPath, minVersion);
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

async function test(dirPath: string, minVersion: TypeScriptVersion): Promise<string | undefined> {
	return lint(dirPath, minVersion);
}

if (!module.parent) {
	main().catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
}
