#!/usr/bin/env node

import { join as joinPaths, resolve } from "path";

import { cleanTypeScriptInstalls, installAllTypeScriptVersions, installTypeScriptNext } from "@definitelytyped/utils";
import { lint } from "./lint";

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    let dirPath = process.cwd();
    let onlyTestTsNext = false;
    let lookingForTsLocal = false;
    let tsLocal: string | undefined;

    for (const arg of args) {
        if (lookingForTsLocal) {
            if (arg.startsWith("--")) {
                throw new Error("Looking for local path for TS, but got " + arg);
            }
            tsLocal = resolve(arg);
            lookingForTsLocal = false;
            continue;
        }
        switch (arg) {
            case "--installAll":
                console.log("Cleaning old installs and installing for all TypeScript versions...");
                console.log("Working...");
                await cleanTypeScriptInstalls();
                await installAllTypeScriptVersions();
                return;
            case "--localTs":
                lookingForTsLocal = true;
                break;
            case "--version":
                console.log(require("../package.json").version);
                return;
            case "--onlyTestTsNext":
                onlyTestTsNext = true;
                break;
            default: {
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
    }
    if (lookingForTsLocal) {
        throw new Error("Path for --localTs was not provided.");
    }

    await installTypeScriptAsNeeded(tsLocal, onlyTestTsNext);
    await runTests(dirPath);
}

async function installTypeScriptAsNeeded(tsLocal: string | undefined, onlyTestTsNext: boolean): Promise<void> {
    if (tsLocal) return;
    if (onlyTestTsNext) {
        return installTypeScriptNext();
    }
    return installAllTypeScriptVersions();
}

function usage(): void {
    console.error("Usage: dtslint [--version] [--installAll] [--onlyTestTsNext] [--localTs path]");
    console.error("Args:");
    console.error("  --version        Print version and exit.");
    console.error("  --installAll     Cleans and installs all TypeScript versions.");
    console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
    console.error("  --localTs path   Run with *path* as the latest version of TS.");
    console.error("");
    console.error("onlyTestTsNext and localTs are (1) mutually exclusive and (2) test a single version of TS");
}

async function runTests(dirPath: string): Promise<void> {
    const err = await lint(dirPath);
    if (err) {
        throw new Error(err);
    }
}

if (!module.parent) {
    main().catch(err => {
        console.error(err.stack);
        process.exit(1);
    });
}
