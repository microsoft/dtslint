#!/usr/bin/env node
import { join as joinPaths } from "path";

import { cleanInstalls, installAll, installNext, runTests } from "../";

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

	if (shouldListen) {
		listen(dirPath);
		// Do this *after* to ensure messages sent during installation aren't dropped.
		await installAll();
	} else {
		if (onlyTestTsNext) {
			await installNext();
		} else {
			await installAll();
		}
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

if (!module.parent) {
	main().catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
}
