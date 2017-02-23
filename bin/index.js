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
const path = require("path");
const yargs = require("yargs");
const checks_1 = require("./checks");
const installer_1 = require("./installer");
const lint_1 = require("./lint");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const argv = yargs.argv;
        for (const key in argv) {
            if (key === "_" || key === "clean" || key === "dt" || key === "version" || key === "noLint" || /^\$\d$/.test(key)) {
                continue;
            }
            console.error(`Unexpected argument '${key}'\n`);
            usage();
            return;
        }
        if (argv.version) {
            console.log(require("../package.json").version);
            return;
        }
        if (argv.clean) {
            console.log("Cleaning typescript installs...");
            yield installer_1.cleanInstalls();
            console.log("Cleaned.");
        }
        const cwd = process.cwd();
        const name = argv._[0];
        const dirPath = name ? path.join(cwd, name) : cwd;
        yield runTests(dirPath, { dt: !!argv.dt, noLint: !!argv.noLint });
    });
}
function usage() {
    console.log("Usage: dtslint [--dt] [--clean]");
    console.log("Args:");
    console.log("  --version Print version and exit.");
    console.log("  --dt     Run extra checks for DefinitelyTyped packages.");
    console.log("  --clean  Clean typescript installs and install again.");
    console.log("  --noLint Just run 'tsc'.");
}
function runTests(dirPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const text = yield fs_promise_1.readFile(path.join(dirPath, "index.d.ts"), "utf-8");
            if (text.includes("// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped") && !options.dt) {
                console.warn("Warning: Text includes DefinitelyTyped link, but '--dt' is not set.");
            }
            const version = getTypeScriptVersion(text);
            if (options.dt) {
                yield checks_1.checkPackageJson(dirPath);
            }
            yield checks_1.checkTsconfig(dirPath, options);
            yield test(dirPath, options, version);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
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
function test(dirPath, options, version) {
    return __awaiter(this, void 0, void 0, function* () {
        const a = yield testWithVersion(dirPath, options, version);
        if (a) {
            if (version !== definitelytyped_header_parser_1.TypeScriptVersion.Latest) {
                const b = yield testWithVersion(dirPath, options, definitelytyped_header_parser_1.TypeScriptVersion.Latest);
                if (!b) {
                    throw new Error(a.message +
                        `Package compiles in TypeScript ${definitelytyped_header_parser_1.TypeScriptVersion.Latest} but not in ${version}.\n` +
                        `You can add a line '// TypeScript Version: ${definitelytyped_header_parser_1.TypeScriptVersion.Latest}' to the end of the header ` +
                        "to specify a newer compiler version.");
                }
            }
            throw new Error(a.message);
        }
    });
}
function testWithVersion(dirPath, options, version) {
    if (options.noLint) {
        // Special for old DefinitelyTyped packages that aren't linted yet.
        return execScript("node " + installer_1.tscPath(version), dirPath);
    }
    else {
        return lint_1.lintWithVersion(dirPath, options, version);
    }
}
function execScript(cmd, cwd) {
    return new Promise(resolve => {
        // Resolves with 'err' if it's present.
        child_process_1.exec(cmd, { encoding: "utf8", cwd }, resolve);
    });
}
if (!module.parent) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map