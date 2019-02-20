import assert = require("assert");
import { TypeScriptVersion } from "definitelytyped-header-parser";
import { pathExists } from "fs-extra";
import { join as joinPaths, normalize } from "path";
import { Configuration, ILinterOptions, Linter } from "tslint";
import * as TsType from "typescript";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { getProgram, Options as ExpectOptions } from "./rules/expectRule";

import { typeScriptPath } from "./installer";
import { readJson, withoutPrefix } from "./util";

export async function lint(
    dirPath: string,
    minVersion: TsVersion,
    maxVersion: TsVersion,
    inTypesVersionDirectory: boolean,
    expectOnly: boolean): Promise<string | undefined> {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    const lintProgram = Linter.createProgram(tsconfigPath);

    for (const version of [maxVersion, minVersion]) {
        const errors = testDependencies(version, dirPath, lintProgram);
        if (errors) { return errors; }
    }

    const lintOptions: ILinterOptions = {
        fix: false,
        formatter: "stylish",
    };
    const linter = new Linter(lintOptions, lintProgram);
    const configPath = expectOnly ? joinPaths(__dirname, "..", "dtslint-expect-only.json") : getConfigPath(dirPath);
    const config = await getLintConfig(configPath, tsconfigPath, minVersion, maxVersion);

    for (const file of lintProgram.getSourceFiles()) {
        if (lintProgram.isSourceFileDefaultLibrary(file)) { continue; }

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
}

function testDependencies(version: TsVersion, dirPath: string, lintProgram: TsType.Program): string | undefined {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    const ts: typeof TsType = require(typeScriptPath(version));
    const program = getProgram(tsconfigPath, ts, version, lintProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !d.file || isExternalDependency(d.file, dirPath, program));
    if (!diagnostics.length) { return undefined; }

    const showDiags = ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: f => f,
        getCurrentDirectory: () => dirPath,
        getNewLine: () => "\n",
    });
    return `Errors in typescript@${version} for external dependencies:\n${showDiags}`;
}

function isExternalDependency(file: TsType.SourceFile, dirPath: string, program: TsType.Program): boolean {
    return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}

function isTypesVersionPath(fileName: string, dirPath: string) {
    const subdirPath = withoutPrefix(fileName, dirPath);
    return subdirPath && /^\/ts\d+\.\d/.test(subdirPath);
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
    const normalFilePath = normalize(filePath);
    const normalDirPath = normalize(dirPath);
    assert(!normalDirPath.endsWith("/") && !normalDirPath.endsWith("\\"));
    return normalFilePath.startsWith(normalDirPath + "/") || normalFilePath.startsWith(normalDirPath + "\\");
}

interface Err { pos: number; message: string; }
function testNoTsIgnore(text: string): Err | undefined {
    const tsIgnore = "ts-ignore";
    const pos = text.indexOf(tsIgnore);
    return pos === -1 ? undefined : { pos, message: "'ts-ignore' is forbidden." };
}
function testNoTslintDisables(text: string): Err | undefined {
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

export async function checkTslintJson(dirPath: string, dt: boolean): Promise<void> {
    const configPath = getConfigPath(dirPath);
    const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
    const validateExtends = (extend: string | string[]) =>
        extend === shouldExtend || (!dt && Array.isArray(extend) && extend.some(val => val === shouldExtend));

    if (!await pathExists(configPath)) {
        if (dt) {
            throw new Error(
                `On DefinitelyTyped, must include \`tslint.json\` containing \`{ "extends": "${shouldExtend}" }\`.\n` +
                "This was inferred as a DefinitelyTyped package because it contains a `// Type definitions for` header.");
        }
        return;
    }

    const tslintJson = await readJson(configPath);
    if (!validateExtends(tslintJson.extends)) {
        throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
    }
}

function getConfigPath(dirPath: string): string {
    return joinPaths(dirPath, "tslint.json");
}

async function getLintConfig(
    expectedConfigPath: string,
    tsconfigPath: string,
    minVersion: TsVersion,
    maxVersion: TsVersion,
): Promise<IConfigurationFile> {
    const configExists = await pathExists(expectedConfigPath);
    const configPath = configExists ? expectedConfigPath : joinPaths(__dirname, "..", "dtslint.json");
    // Second param to `findConfiguration` doesn't matter, since config path is provided.
    const config = Configuration.findConfiguration(configPath, "").results;
    if (!config) {
        throw new Error(`Could not load config at ${configPath}`);
    }

    const expectRule = config.rules.get("expect");
    if (!expectRule || expectRule.ruleSeverity !== "error") {
        throw new Error("'expect' rule should be enabled, else compile errors are ignored");
    }
    if (expectRule) {
        const versionsToTest = range(minVersion, maxVersion).map(versionName =>
            ({ versionName, path: typeScriptPath(versionName) }));
        const expectOptions: ExpectOptions = { tsconfigPath, versionsToTest };
        expectRule.ruleArguments = [expectOptions];
    }
    return config;
}

function range(minVersion: TsVersion, maxVersion: TsVersion): ReadonlyArray<TsVersion> {
    if (minVersion === "next") {
        assert(maxVersion === "next");
        return ["next"];
    }

    // The last item of TypeScriptVersion is the unreleased version of Typescript,
    // which is called 'next' on npm, so replace it with 'next'.
    const allReleased: TsVersion[] = [...TypeScriptVersion.all];
    allReleased[allReleased.length - 1] = "next";
    const minIdx = allReleased.indexOf(minVersion);
    assert(minIdx >= 0);
    const maxIdx = allReleased.indexOf(maxVersion);
    assert(maxIdx >= minIdx);
    return allReleased.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "next";
