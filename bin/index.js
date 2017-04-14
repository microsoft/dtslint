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
const child_process_1 = require("child_process");
const fs_promise_1 = require("fs-promise");
const path_1 = require("path");
const definitelytyped_header_parser_1 = require("./rules/definitelytyped-header-parser");
const checks_1 = require("./checks");
const installer_1 = require("./installer");
const lint_1 = require("./lint");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        let noLint = false;
        let tsNext = false;
        let dirPath = process.cwd();
        for (const arg of args) {
            switch (arg) {
                case "--clean":
                    console.log("Cleaning installs...");
                    yield installer_1.cleanInstalls();
                    return;
                case "--installAll":
                    console.log("Installing for all TypeScript versions...");
                    yield installer_1.cleanInstalls();
                    yield installer_1.installAll();
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
                    dirPath = dirPath === undefined ? arg : path_1.join(dirPath, arg);
            }
        }
        yield runTests(dirPath, noLint, tsNext);
    });
}
function usage() {
    console.log("Usage: dtslint [--version] [--clean] [--noLint] [--tsNext] [--installAll]");
    console.log("Args:");
    console.log("  --version    Print version and exit.");
    console.log("  --clean      Clean TypeScript installs and install again.");
    console.log("  --noLint     Just run 'tsc'. (Not recommended.)");
    console.log("  --tsNext     Run with 'typescript@next' instead of the specified version.");
    console.log("  --installAll Cleans and installs all TypeScript versions.");
}
function runTests(dirPath, noLint, tsNext) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = yield fs_promise_1.readFile(path_1.join(dirPath, "index.d.ts"), "utf-8");
        const dt = text.includes("// Type definitions for");
        const version = tsNext ? "next" : getTypeScriptVersion(text);
        if (!noLint) {
            yield lint_1.checkTslintJson(dirPath, dt);
        }
        if (dt) {
            yield checks_1.checkPackageJson(dirPath);
        }
        yield checks_1.checkTsconfig(dirPath, dt);
        yield test(dirPath, noLint, version);
    });
}
function getTypeScriptVersion(text) {
    const searchString = "// TypeScript Version: ";
    const x = text.indexOf(searchString);
    if (x === -1) {
        return "2.0";
    }
    let line = text.slice(x, text.indexOf("\n", x));
    if (line.endsWith("\r")) {
        line = line.slice(0, line.length - 1);
    }
    return definitelytyped_header_parser_1.parseTypeScriptVersionLine(line);
}
function test(dirPath, noLint, version) {
    return __awaiter(this, void 0, void 0, function* () {
        const errorFromSpecifiedVersion = yield testWithVersion(dirPath, noLint, version);
        if (!errorFromSpecifiedVersion) {
            return;
        }
        if (version !== definitelytyped_header_parser_1.TypeScriptVersion.latest) {
            const errorFromLatest = yield testWithVersion(dirPath, noLint, definitelytyped_header_parser_1.TypeScriptVersion.latest);
            if (!errorFromLatest) {
                throw new Error(errorFromSpecifiedVersion +
                    `Package compiles in TypeScript ${definitelytyped_header_parser_1.TypeScriptVersion.latest} but not in ${version}.\n` +
                    `You can add a line '// TypeScript Version: ${definitelytyped_header_parser_1.TypeScriptVersion.latest}' to the end of the header ` +
                    "to specify a newer compiler version.");
            }
        }
        throw new Error(errorFromSpecifiedVersion);
    });
}
function testWithVersion(dirPath, noLint, version) {
    return __awaiter(this, void 0, void 0, function* () {
        yield installer_1.install(version);
        if (noLint) {
            // Special for old DefinitelyTyped packages that aren't linted yet.
            return execScript("node " + installer_1.tscPath(version), dirPath);
        }
        else {
            return lint_1.lintWithVersion(dirPath, version);
        }
    });
}
function execScript(cmd, cwd) {
    return new Promise(resolve => {
        child_process_1.exec(cmd, { encoding: "utf8", cwd }, (err, stdout, stderr) => resolve(err ? stdout + stderr : undefined));
    });
}
if (!module.parent) {
    main().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map