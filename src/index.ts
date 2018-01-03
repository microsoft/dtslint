#!/usr/bin/env node
import { parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { readFile } from "fs-promise";
import { basename, dirname, join as joinPaths } from "path";

import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, installAll } from "./installer";
import { checkTslintJson, lint } from "./lint";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	let dirPath = process.cwd();
	let onlyTestTsNext = false;
	let shouldListen = false;

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

			case "--onlyTestTsNext":
				onlyTestTsNext = true;
				break;

			// Only for use by types-publisher.
			// Listens for { path, onlyTestTsNext } messages and ouputs { path, status }.
			case "--listen":
				shouldListen = true;
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
				dirPath = joinPaths(dirPath, path);
		}
	}

	await installAll();

	if (shouldListen) {
		listen(dirPath);
	} else {
		await runTests(dirPath, onlyTestTsNext);
	}
}

function usage(): void {
	console.error("Usage: dtslint [--version] [--installAll]");
	console.error("Args:");
	console.error("  --version        Print version and exit.");
	console.error("  --installAll     Cleans and installs all TypeScript versions.");
	console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
}

function listen(dirPath: string): void {
	process.on("message", (message: {}) => {
		const { path, onlyTestTsNext } = message as { path: string, onlyTestTsNext: boolean };
		runTests(joinPaths(dirPath, path), onlyTestTsNext)
			.catch(e => e.stack)
			.then(maybeError => {
				process.send!({ path, status: maybeError === undefined ? "OK" : maybeError });
			})
			.catch(e => console.error(e.stack));
	});
}

async function runTests(dirPath: string, onlyTestTsNext: boolean): Promise<void> {
	const text = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
	// If this *is* on DefinitelyTyped, types-publisher will fail if it can't parse the header.
	const dt = text.includes("// Type definitions for");
	if (dt) {
		// Someone may have copied text from DefinitelyTyped to their type definition and included a header,
		// so assert that we're really on DefinitelyTyped.
		assertPathIsInDefinitelyTyped(dirPath);
	}
	const minVersion = getTypeScriptVersion(text);

	await checkTslintJson(dirPath, dt);
	if (dt) {
		await checkPackageJson(dirPath);
	}
	await checkTsconfig(dirPath, dt);
	const err = await lint(dirPath, minVersion, onlyTestTsNext);
	if (err) {
		throw new Error(err);
	}
}

function assertPathIsInDefinitelyTyped(dirPath: string): void {
	const parent = dirname(dirPath);
	const types = /v\d+/.test(basename(dirPath)) ? dirname(parent) : parent;
	const dt = dirname(types);
	if (basename(dt) !== "DefinitelyTyped" || basename(types) !== "types") {
		throw new Error("Since this type definition includes a header (a comment starting with `// Type definitions for`), "
			+ "assumed this was a DefinitelyTyped package.\n"
			+ "But it is not in a `DefinitelyTyped/types/xxx` directory.");
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

if (!module.parent) {
	main().catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
}
