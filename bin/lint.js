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
const assert = require("assert");
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const tslint_1 = require("tslint");
const expectRule_1 = require("./rules/expectRule");
const installer_1 = require("./installer");
const util_1 = require("./util");
function lint(dirPath, minVersion, maxVersion, inTypesVersionDirectory) {
    return __awaiter(this, void 0, void 0, function* () {
        const tsconfigPath = path_1.join(dirPath, "tsconfig.json");
        const lintProgram = tslint_1.Linter.createProgram(tsconfigPath);
        for (const version of [maxVersion, minVersion]) {
            const errors = testDependencies(version, dirPath, lintProgram);
            if (errors) {
                return errors;
            }
        }
        const lintOptions = {
            fix: false,
            formatter: "stylish",
        };
        const linter = new tslint_1.Linter(lintOptions, lintProgram);
        const config = yield getLintConfig(getConfigPath(dirPath), tsconfigPath, minVersion, maxVersion);
        for (const file of lintProgram.getSourceFiles()) {
            if (lintProgram.isSourceFileDefaultLibrary(file)) {
                continue;
            }
            const { fileName, text } = file;
            const err = testNoTsIgnore(text) || testNoTslintDisables(text);
            if (err) {
                const { pos, message } = err;
                const place = file.getLineAndCharacterOfPosition(pos);
                return `At ${fileName}:${JSON.stringify(place)}: ${message}`;
            }
            // External dependencies should have been handled by `testDependencies`;
            // typesVersions should be handled in a separate lint
            if (!isExternalDependency(file, dirPath, lintProgram) &&
                (inTypesVersionDirectory || !isTypesVersionPath(fileName, dirPath))) {
                linter.lint(fileName, text, config);
            }
        }
        const result = linter.getResult();
        return result.failures.length ? result.output : undefined;
    });
}
exports.lint = lint;
function testDependencies(version, dirPath, lintProgram) {
    const tsconfigPath = path_1.join(dirPath, "tsconfig.json");
    const ts = require(installer_1.typeScriptPath(version));
    const program = expectRule_1.getProgram(tsconfigPath, ts, version, lintProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !d.file || isExternalDependency(d.file, dirPath, program));
    if (!diagnostics.length) {
        return undefined;
    }
    const showDiags = ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: f => f,
        getCurrentDirectory: () => dirPath,
        getNewLine: () => "\n",
    });
    return `Errors in typescript@${version} for external dependencies:\n${showDiags}`;
}
function isExternalDependency(file, dirPath, program) {
    return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}
function isTypesVersionPath(fileName, dirPath) {
    const subdirPath = util_1.withoutPrefix(fileName, dirPath);
    return subdirPath && /^\/ts\d+\.\d/.test(subdirPath);
}
function startsWithDirectory(filePath, dirPath) {
    const normalFilePath = path_1.normalize(filePath);
    const normalDirPath = path_1.normalize(dirPath);
    assert(!normalDirPath.endsWith("/") && !normalDirPath.endsWith("\\"));
    return normalFilePath.startsWith(normalDirPath + "/") || normalFilePath.startsWith(normalDirPath + "\\");
}
function testNoTsIgnore(text) {
    const tsIgnore = "ts-ignore";
    const pos = text.indexOf(tsIgnore);
    return pos === -1 ? undefined : { pos, message: "'ts-ignore' is forbidden." };
}
function testNoTslintDisables(text) {
    const tslintDisable = "tslint:disable";
    let lastIndex = 0;
    while (true) {
        const pos = text.indexOf(tslintDisable, lastIndex);
        if (pos === -1) {
            return undefined;
        }
        const end = pos + tslintDisable.length;
        const nextChar = text.charAt(end);
        if (nextChar !== "-" && nextChar !== ":") {
            const message = "'tslint:disable' is forbidden. " +
                "('tslint:disable:rulename', tslint:disable-line' and 'tslint:disable-next-line' are allowed.)";
            return { pos, message };
        }
        lastIndex = end;
    }
}
function checkTslintJson(dirPath, dt) {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = getConfigPath(dirPath);
        const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
        if (!(yield fs_extra_1.pathExists(configPath))) {
            if (dt) {
                throw new Error(`On DefinitelyTyped, must include \`tslint.json\` containing \`{ "extends": "${shouldExtend}" }\`.\n` +
                    "This was inferred as a DefinitelyTyped package because it contains a `// Type definitions for` header.");
            }
            return;
        }
        const tslintJson = yield util_1.readJson(configPath);
        if (tslintJson.extends !== shouldExtend) {
            throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
        }
    });
}
exports.checkTslintJson = checkTslintJson;
function getConfigPath(dirPath) {
    return path_1.join(dirPath, "tslint.json");
}
function getLintConfig(expectedConfigPath, tsconfigPath, minVersion, maxVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        const configExists = yield fs_extra_1.pathExists(expectedConfigPath);
        const configPath = configExists ? expectedConfigPath : path_1.join(__dirname, "..", "dtslint.json");
        // Second param to `findConfiguration` doesn't matter, since config path is provided.
        const config = tslint_1.Configuration.findConfiguration(configPath, "").results;
        if (!config) {
            throw new Error(`Could not load config at ${configPath}`);
        }
        const expectRule = config.rules.get("expect");
        if (!expectRule || expectRule.ruleSeverity !== "error") {
            throw new Error("'expect' rule should be enabled, else compile errors are ignored");
        }
        if (expectRule) {
            const versionsToTest = range(minVersion, maxVersion).map(versionName => ({ versionName, path: installer_1.typeScriptPath(versionName) }));
            const expectOptions = { tsconfigPath, versionsToTest };
            expectRule.ruleArguments = [expectOptions];
        }
        return config;
    });
}
function range(minVersion, maxVersion) {
    if (minVersion === "next") {
        assert(maxVersion === "next");
        return ["next"];
    }
    // The last item of TypeScriptVersion is the unreleased version of Typescript,
    // which is called 'next' on npm, so replace it with 'next'.
    const allReleased = [...definitelytyped_header_parser_1.TypeScriptVersion.all];
    allReleased[allReleased.length - 1] = "next";
    const minIdx = allReleased.indexOf(minVersion);
    assert(minIdx >= 0);
    const maxIdx = allReleased.indexOf(maxVersion);
    assert(maxIdx >= minIdx);
    return allReleased.slice(minIdx, maxIdx + 1);
}
//# sourceMappingURL=lint.js.map