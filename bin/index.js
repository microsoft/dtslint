#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const checks_1 = require("./checks");
const installer_1 = require("./installer");
const lint_1 = require("./lint");
const util_1 = require("./util");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        let dirPath = process.cwd();
        let onlyTestTsNext = false;
        let shouldListen = false;
        for (const arg of args) {
            switch (arg) {
                case "--installAll":
                    console.log("Cleaning old installs and installing for all TypeScript versions...");
                    yield installer_1.cleanInstalls();
                    yield installer_1.installAll();
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
                    dirPath = path_1.join(dirPath, path);
            }
        }
        if (shouldListen) {
            listen(dirPath);
            // Do this *after* to ensure messages sent during installation aren't dropped.
            yield installer_1.installAll();
        }
        else {
            if (onlyTestTsNext) {
                yield installer_1.installNext();
            }
            else {
                yield installer_1.installAll();
            }
            yield runTests(dirPath, onlyTestTsNext);
        }
    });
}
function usage() {
    console.error("Usage: dtslint [--version] [--installAll]");
    console.error("Args:");
    console.error("  --version        Print version and exit.");
    console.error("  --installAll     Cleans and installs all TypeScript versions.");
    console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
}
function listen(dirPath) {
    process.on("message", (message) => {
        const { path, onlyTestTsNext } = message;
        runTests(path_1.join(dirPath, path), onlyTestTsNext)
            .catch(e => e.stack)
            .then(maybeError => {
            process.send({ path, status: maybeError === undefined ? "OK" : maybeError });
        })
            .catch(e => console.error(e.stack));
    });
}
function runTests(dirPath, onlyTestTsNext) {
    return __awaiter(this, void 0, void 0, function* () {
        const isOlderVersion = /^v\d+$/.test(path_1.basename(dirPath));
        const indexText = yield fs_extra_1.readFile(path_1.join(dirPath, "index.d.ts"), "utf-8");
        // If this *is* on DefinitelyTyped, types-publisher will fail if it can't parse the header.
        const dt = indexText.includes("// Type definitions for");
        if (dt) {
            // Someone may have copied text from DefinitelyTyped to their type definition and included a header,
            // so assert that we're really on DefinitelyTyped.
            assertPathIsInDefinitelyTyped(dirPath);
        }
        const typesVersions = yield util_1.mapDefinedAsync(yield fs_extra_1.readdir(dirPath), (name) => __awaiter(this, void 0, void 0, function* () {
            if (name === "tsconfig.json" || name === "tslint.json" || name === "tsutils") {
                return undefined;
            }
            const version = util_1.withoutPrefix(name, "ts");
            if (version === undefined || !(yield fs_extra_1.stat(path_1.join(dirPath, name))).isDirectory()) {
                return undefined;
            }
            if (!definitelytyped_header_parser_1.isTypeScriptVersion(version)) {
                throw new Error(`There is an entry named ${name}, but ${version} is not a valid TypeScript version.`);
            }
            if (!definitelytyped_header_parser_1.TypeScriptVersion.isRedirectable(version)) {
                throw new Error(`At ${dirPath}/${name}: TypeScript version directories only available starting with ts3.1.`);
            }
            return version;
        }));
        if (dt) {
            yield checks_1.checkPackageJson(dirPath, typesVersions);
        }
        if (onlyTestTsNext) {
            if (typesVersions.length === 0) {
                yield testTypesVersion(dirPath, "next", "next", isOlderVersion, dt, indexText);
            }
            else {
                const latestTypesVersion = util_1.last(typesVersions);
                const versionPath = path_1.join(dirPath, `ts${latestTypesVersion}`);
                const versionIndexText = yield fs_extra_1.readFile(path_1.join(versionPath, "index.d.ts"), "utf-8");
                yield testTypesVersion(versionPath, "next", "next", isOlderVersion, dt, versionIndexText);
            }
        }
        else {
            yield testTypesVersion(dirPath, undefined, getTsVersion(0), isOlderVersion, dt, indexText);
            for (let i = 0; i < typesVersions.length; i++) {
                const version = typesVersions[i];
                const versionPath = path_1.join(dirPath, `ts${version}`);
                const versionIndexText = yield fs_extra_1.readFile(path_1.join(versionPath, "index.d.ts"), "utf-8");
                yield testTypesVersion(versionPath, version, getTsVersion(i + 1), isOlderVersion, dt, versionIndexText, 
                /*inTypesVersionDirectory*/ true);
            }
            function getTsVersion(i) {
                return i === typesVersions.length ? "next" : util_1.assertDefined(definitelytyped_header_parser_1.TypeScriptVersion.previous(typesVersions[i]));
            }
        }
    });
}
function testTypesVersion(dirPath, lowVersion, maxVersion, isOlderVersion, dt, indexText, inTypesVersionDirectory) {
    return __awaiter(this, void 0, void 0, function* () {
        const minVersionFromComment = getTypeScriptVersionFromComment(indexText);
        if (minVersionFromComment !== undefined && inTypesVersionDirectory) {
            throw new Error(`Already in the \`ts${lowVersion}\` directory, don't need \`// TypeScript Version\`.`);
        }
        const minVersion = lowVersion || minVersionFromComment || definitelytyped_header_parser_1.TypeScriptVersion.lowest;
        yield lint_1.checkTslintJson(dirPath, dt);
        yield checks_1.checkTsconfig(dirPath, dt
            ? { relativeBaseUrl: ".." + (isOlderVersion ? "/.." : "") + (inTypesVersionDirectory ? "/.." : "") + "/" }
            : undefined);
        const err = yield lint_1.lint(dirPath, minVersion, maxVersion, !!inTypesVersionDirectory);
        if (err) {
            throw new Error(err);
        }
    });
}
function assertPathIsInDefinitelyTyped(dirPath) {
    const parent = path_1.dirname(dirPath);
    const types = /^v\d+$/.test(path_1.basename(dirPath)) ? path_1.dirname(parent) : parent;
    const dt = path_1.dirname(types);
    if (path_1.basename(dt) !== "DefinitelyTyped" || path_1.basename(types) !== "types") {
        throw new Error("Since this type definition includes a header (a comment starting with `// Type definitions for`), "
            + "assumed this was a DefinitelyTyped package.\n"
            + "But it is not in a `DefinitelyTyped/types/xxx` directory.");
    }
}
function getTypeScriptVersionFromComment(text) {
    const searchString = "// TypeScript Version: ";
    const x = text.indexOf(searchString);
    if (x === -1) {
        return undefined;
    }
    let line = text.slice(x, text.indexOf("\n", x));
    if (line.endsWith("\r")) {
        line = line.slice(0, line.length - 1);
    }
    return definitelytyped_header_parser_1.parseTypeScriptVersionLine(line);
}
if (!module.parent) {
    main().catch(err => {
        console.error(err.stack);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map