#!/usr/bin/env node

import { parseTypeScriptVersionLine } from "@definitelytyped/header-parser";
import { AllTypeScriptVersion, TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import { readdir, readFile, stat } from "fs-extra";
import { basename, dirname, join as joinPaths, resolve } from "path";

import { cleanTypeScriptInstalls, installAllTypeScriptVersions, installTypeScriptNext } from "@definitelytyped/utils";
import { checkPackageJson, checkTsconfig } from "./checks";
import { checkTslintJson, lint, TsVersion } from "./lint";
import { mapDefinedAsync, withoutPrefix } from "./util";

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    let dirPath = process.cwd();
    let onlyTestTsNext = false;
    let expectOnly = false;
    let shouldListen = false;
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
            case "--expectOnly":
                expectOnly = true;
                break;
            case "--onlyTestTsNext":
                onlyTestTsNext = true;
                break;
            // Only for use by types-publisher.
            // Listens for { path, onlyTestTsNext } messages and ouputs { path, status }.
            case "--listen":
                shouldListen = true;
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

    if (shouldListen) {
        listen(dirPath, tsLocal, onlyTestTsNext);
    } else {
        await installTypeScriptAsNeeded(tsLocal, onlyTestTsNext);
        await runTests(dirPath, onlyTestTsNext, expectOnly, tsLocal);
    }
}

async function installTypeScriptAsNeeded(tsLocal: string | undefined, onlyTestTsNext: boolean): Promise<void> {
    if (tsLocal) return;
    if (onlyTestTsNext) {
        return installTypeScriptNext();
    }
    return installAllTypeScriptVersions();
}

function usage(): void {
    console.error("Usage: dtslint [--version] [--installAll] [--onlyTestTsNext] [--expectOnly] [--localTs path]");
    console.error("Args:");
    console.error("  --version        Print version and exit.");
    console.error("  --installAll     Cleans and installs all TypeScript versions.");
    console.error("  --expectOnly     Run only the ExpectType lint rule.");
    console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
    console.error("  --localTs path   Run with *path* as the latest version of TS.");
    console.error("");
    console.error("onlyTestTsNext and localTs are (1) mutually exclusive and (2) test a single version of TS");
}

function listen(dirPath: string, tsLocal: string | undefined, alwaysOnlyTestTsNext: boolean): void {
    // Don't await this here to ensure that messages sent during installation aren't dropped.
    const installationPromise = installTypeScriptAsNeeded(tsLocal, alwaysOnlyTestTsNext);
    process.on("message", async (message: unknown) => {
        const { path, onlyTestTsNext, expectOnly } = message as { path: string, onlyTestTsNext: boolean, expectOnly?: boolean };

        await installationPromise;
        runTests(joinPaths(dirPath, path), onlyTestTsNext, !!expectOnly, tsLocal)
            .catch(e => e.stack)
            .then(maybeError => {
                process.send!({ path, status: maybeError === undefined ? "OK" : maybeError });
            })
            .catch(e => console.error(e.stack));
    });
}

async function runTests(
    dirPath: string,
    onlyTestTsNext: boolean,
    expectOnly: boolean,
    tsLocal: string | undefined,
): Promise<void> {
    const isOlderVersion = /^v(\d+)(\.(\d+))?$/.test(basename(dirPath));

    const indexText = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
    // If this *is* on DefinitelyTyped, types-publisher will fail if it can't parse the header.
    const dt = indexText.includes("// Type definitions for");
    if (dt) {
        // Someone may have copied text from DefinitelyTyped to their type definition and included a header,
        // so assert that we're really on DefinitelyTyped.
        assertPathIsInDefinitelyTyped(dirPath);
        assertPathIsNotBanned(dirPath);
    }

    const typesVersions = await mapDefinedAsync(await readdir(dirPath), async name => {
        if (name === "tsconfig.json" || name === "tslint.json" || name === "tsutils") { return undefined; }
        const version = withoutPrefix(name, "ts");
        if (version === undefined || !(await stat(joinPaths(dirPath, name))).isDirectory()) { return undefined; }

        if (!TypeScriptVersion.isTypeScriptVersion(version)) {
            throw new Error(`There is an entry named ${name}, but ${version} is not a valid TypeScript version.`);
        }
        if (!TypeScriptVersion.isRedirectable(version)) {
            throw new Error(`At ${dirPath}/${name}: TypeScript version directories only available starting with ts3.1.`);
        }
        return version;
    });

    if (dt) {
        await checkPackageJson(dirPath, typesVersions);
    }

    const minVersion = maxVersion(
        getMinimumTypeScriptVersionFromComment(indexText),
        TypeScriptVersion.lowest) as TypeScriptVersion;
    if (onlyTestTsNext || tsLocal) {
        const tsVersion = tsLocal ? "local" : TypeScriptVersion.latest;
        await testTypesVersion(dirPath, tsVersion, tsVersion, isOlderVersion, dt, expectOnly, tsLocal, /*isLatest*/ true);
    } else {
        // For example, typesVersions of [3.2, 3.5, 3.6] will have
        // associated ts3.2, ts3.5, ts3.6 directories, for
        // <=3.2, <=3.5, <=3.6 respectively; the root level is for 3.7 and above.
        // so this code needs to generate ranges [lowest-3.2, 3.3-3.5, 3.6-3.6, 3.7-latest]
        const lows = [TypeScriptVersion.lowest, ...typesVersions.map(next)];
        const his = [...typesVersions, TypeScriptVersion.latest];
        assert.strictEqual(lows.length, his.length);
        for (let i = 0; i < lows.length; i++) {
            const low = maxVersion(minVersion, lows[i]);
            const hi = his[i];
            assert(
                parseFloat(hi) >= parseFloat(low),
                `'// Minimum TypeScript Version: ${minVersion}' in header skips ts${hi} folder.`);
            const isLatest = hi === TypeScriptVersion.latest;
            const versionPath = isLatest ? dirPath : joinPaths(dirPath, `ts${hi}`);
            if (lows.length > 1) {
                console.log("testing from", low, "to", hi, "in", versionPath);
            }
            await testTypesVersion(versionPath, low, hi, isOlderVersion, dt, expectOnly, undefined, isLatest);
        }
    }
}

function maxVersion(v1: TypeScriptVersion | undefined, v2: TypeScriptVersion): TypeScriptVersion;
function maxVersion(v1: AllTypeScriptVersion | undefined, v2: AllTypeScriptVersion): AllTypeScriptVersion;
function maxVersion(v1: AllTypeScriptVersion | undefined, v2: AllTypeScriptVersion) {
    if (!v1) return v2;
    if (!v2) return v1;
    if (parseFloat(v1) >= parseFloat(v2)) return v1;
    return v2;
}

function next(v: TypeScriptVersion): TypeScriptVersion {
    const index = TypeScriptVersion.supported.indexOf(v);
    assert.notStrictEqual(index, -1);
    assert(index < TypeScriptVersion.supported.length);
    return TypeScriptVersion.supported[index + 1];
}

async function testTypesVersion(
    dirPath: string,
    lowVersion: TsVersion,
    hiVersion: TsVersion,
    isOlderVersion: boolean,
    dt: boolean,
    expectOnly: boolean,
    tsLocal: string | undefined,
    isLatest: boolean,
): Promise<void> {
    await checkTslintJson(dirPath, dt);
    await checkTsconfig(dirPath, dt
        ? { relativeBaseUrl: ".." + (isOlderVersion ? "/.." : "") + (isLatest ? "" : "/..") + "/" }
        : undefined);
    const err = await lint(dirPath, lowVersion, hiVersion, isLatest, expectOnly, tsLocal);
    if (err) {
        throw new Error(err);
    }
}

function assertPathIsInDefinitelyTyped(dirPath: string): void {
    const parent = dirname(dirPath);
    const types = /^v\d+(\.\d+)?$/.test(basename(dirPath)) ? dirname(parent) : parent;
    // TODO: It's not clear whether this assertion makes sense, and it's broken on Azure Pipelines
    // Re-enable it later if it makes sense.
    // const dt = dirname(types);
    // if (basename(dt) !== "DefinitelyTyped" || basename(types) !== "types") {
    if (basename(types) !== "types") {
        throw new Error("Since this type definition includes a header (a comment starting with `// Type definitions for`), "
            + "assumed this was a DefinitelyTyped package.\n"
            + "But it is not in a `DefinitelyTyped/types/xxx` directory: "
            + dirPath);
    }
}

function assertPathIsNotBanned(dirPath: string) {
    const basedir = basename(dirPath);
    if (/(^|\W)download($|\W)/.test(basedir) &&
        basedir !== "download" &&
        basedir !== "downloadjs" &&
        basedir !== "s3-download-stream") {
        // Since npm won't release their banned-words list, we'll have to manually add to this list.
        throw new Error(`${dirPath}: Contains the word 'download', which is banned by npm.`);
    }
}

function getMinimumTypeScriptVersionFromComment(text: string): AllTypeScriptVersion | undefined {
    const match = text.match(/\/\/ (?:Minimum )?TypeScript Version: /);
    if (!match) {
        return undefined;
    }

    let line = text.slice(match.index, text.indexOf("\n", match.index));
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
