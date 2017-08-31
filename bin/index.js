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
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
const fs_promise_1 = require("fs-promise");
const path_1 = require("path");
const checks_1 = require("./checks");
const installer_1 = require("./installer");
const lint_1 = require("./lint");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        let noLint = false;
        let dirPath = process.cwd();
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
                        ? arg.substr(1).replace("/", "__")
                        : arg;
                    dirPath = dirPath === undefined ? path : path_1.join(dirPath, path);
            }
        }
        yield installer_1.installAll();
        yield runTests(dirPath, noLint);
    });
}
function usage() {
    console.error("Usage: dtslint [--version] [--noLint] [--installAll]");
    console.error("Args:");
    console.error("  --version    Print version and exit.");
    console.error("  --noLint     Just run 'tsc'. (Not recommended.)");
    console.error("  --installAll Cleans and installs all TypeScript versions.");
}
function runTests(dirPath, noLint) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = yield fs_promise_1.readFile(path_1.join(dirPath, "index.d.ts"), "utf-8");
        const dt = text.includes("// Type definitions for");
        const minVersion = getTypeScriptVersion(text);
        if (!noLint) {
            yield lint_1.checkTslintJson(dirPath, dt);
        }
        if (dt) {
            yield checks_1.checkPackageJson(dirPath);
        }
        yield checks_1.checkTsconfig(dirPath, dt);
        const err = yield test(dirPath, noLint, minVersion);
        if (err) {
            throw new Error(err);
        }
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
function test(dirPath, noLint, minVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        if (noLint) {
            for (const tsVersion of ["next", minVersion]) {
                // Special for old DefinitelyTyped packages that aren't linted yet.
                const err = yield execScript("node " + installer_1.tscPath(tsVersion), dirPath);
                if (err !== undefined) {
                    return `Error in TypeScript@${tsVersion}: ${err}`;
                }
            }
            return undefined;
        }
        else {
            return lint_1.lint(dirPath, minVersion);
        }
    });
}
function execScript(cmd, cwd) {
    return new Promise(resolve => {
        child_process_1.exec(cmd, { encoding: "utf8", cwd }, (err, stdout, stderr) => {
            if (err) {
                resolve(stdout + stderr);
            }
            else {
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
//# sourceMappingURL=index.js.map