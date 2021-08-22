import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { typeScriptPath } from "@definitelytyped/utils";
import assert = require("assert");
import * as fs from "fs";
import { pathExists } from "fs-extra";
import { dirname, join as joinPaths, normalize } from "path";
import { Configuration, ILinterOptions, Linter } from "tslint";
import * as TsType from "typescript";
type Configuration = typeof Configuration;
type IConfigurationFile = Configuration.IConfigurationFile;

import { getProgram, Options as ExpectOptions } from "./rules/expectRule";

import { readJson, withoutPrefix } from "./util";

export async function lint(
    dirPath: string,
    minVersion: TsVersion,
    maxVersion: TsVersion,
    isLatest: boolean,
    expectOnly: boolean,
    tsLocal: string | undefined): Promise<string | undefined> {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    const lintProgram = Linter.createProgram(tsconfigPath);

    for (const version of [maxVersion, minVersion]) {
        const errors = testDependencies(version, dirPath, lintProgram, tsLocal);
        if (errors) { return errors; }
    }

    {
        const { config } = TsType.readConfigFile(tsconfigPath, TsType.sys.readFile);
        const parseConfigHost: TsType.ParseConfigHost = {
            fileExists: fs.existsSync,
            readDirectory: TsType.sys.readDirectory,
            readFile: file => fs.readFileSync(file, "utf8"),
            useCaseSensitiveFileNames: true,
        };
        const projectDirectory = dirname(tsconfigPath);
        const parsed = TsType.parseJsonConfigFileContent(config, parseConfigHost, projectDirectory, { noEmit: true });
        const program = TsType.createProgram(parsed.fileNames.filter(fileName => fileName.endsWith(".d.ts")), parsed.options);
        const diagnostics = TsType.getPreEmitDiagnostics(program);
        if (diagnostics.length) {
            const showDiags = TsType.formatDiagnostics(diagnostics, {
                getCanonicalFileName: f => f,
                getCurrentDirectory: () => dirPath,
                getNewLine: () => "\n",
            });
            return showDiags;
        }
    }

    const lintOptions: ILinterOptions = {
        fix: false,
        formatter: "stylish",
    };
    const linter = new Linter(lintOptions, lintProgram);
    const configPath = expectOnly ? joinPaths(__dirname, "..", "dtslint-expect-only.json") : getConfigPath(dirPath);
    const config = await getLintConfig(configPath, tsconfigPath, minVersion, maxVersion, tsLocal);

    for (const file of lintProgram.getSourceFiles()) {
        if (lintProgram.isSourceFileDefaultLibrary(file)) { continue; }

        const { fileName, text } = file;
        if (!fileName.includes("node_modules")) {
            const err = testNoTsIgnore(text) || testNoTslintDisables(text);
            if (err) {
                const { pos, message } = err;
                const place = file.getLineAndCharacterOfPosition(pos);
                return `At ${fileName}:${JSON.stringify(place)}: ${message}`;
            }
        }

        // External dependencies should have been handled by `testDependencies`;
        // typesVersions should be handled in a separate lint
        if (!isExternalDependency(file, dirPath, lintProgram) &&
            (!isLatest || !isTypesVersionPath(fileName, dirPath))) {
            linter.lint(fileName, text, config);
        }
    }

    const result = linter.getResult();
    return result.failures.length ? result.output : undefined;
}

function testDependencies(
    version: TsVersion,
    dirPath: string,
    lintProgram: TsType.Program,
    tsLocal: string | undefined,
): string | undefined {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    assert(version !== "local" || tsLocal);
    const ts: typeof TsType = require(typeScriptPath(version, tsLocal));
    const program = getProgram(tsconfigPath, ts, version, lintProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !d.file || isExternalDependency(d.file, dirPath, program));
    if (!diagnostics.length) { return undefined; }

    const showDiags = ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: f => f,
        getCurrentDirectory: () => dirPath,
        getNewLine: () => "\n",
    });

    const message = `Errors in typescript@${version} for external dependencies:\n${showDiags}`;

    // Add an edge-case for someone needing to `npm install` in react when they first edit a DT module which depends on it - #226
    const cannotFindDepsDiags = diagnostics.find(d => d.code === 2307 && d.messageText.toString().includes("Cannot find module"));
    if (cannotFindDepsDiags && cannotFindDepsDiags.file) {
        const path = cannotFindDepsDiags.file.fileName;
        const typesFolder = dirname(path);

        return `
A module look-up failed, this often occurs when you need to run \`npm install\` on a dependent module before you can lint.

Before you debug, first try running:

   npm install --prefix ${typesFolder}

Then re-run. Full error logs are below.

${message}`;
    } else {
        return message;
    }
}

export function isExternalDependency(file: TsType.SourceFile, dirPath: string, program: TsType.Program): boolean {
    return !startsWithDirectory(file.fileName, dirPath) || program.isSourceFileFromExternalLibrary(file);
}

function normalizePath(file: string) {
    // replaces '\' with '/' and forces all DOS drive letters to be upper-case
    return normalize(file)
        .replace(/\\/g, "/")
        .replace(/^[a-z](?=:)/, c => c.toUpperCase());
}

function isTypesVersionPath(fileName: string, dirPath: string) {
    const normalFileName = normalizePath(fileName);
    const normalDirPath = normalizePath(dirPath);
    const subdirPath = withoutPrefix(normalFileName, normalDirPath);
    return subdirPath && /^\/ts\d+\.\d/.test(subdirPath);
}

function startsWithDirectory(filePath: string, dirPath: string): boolean {
    const normalFilePath = normalizePath(filePath);
    const normalDirPath = normalizePath(dirPath).replace(/\/$/, "");
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
    // eslint-disable-next-line no-constant-condition
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
    tsLocal: string | undefined,
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
        const versionsToTest =
            range(minVersion, maxVersion).map(versionName => ({ versionName, path: typeScriptPath(versionName, tsLocal) }));
        const expectOptions: ExpectOptions = { tsconfigPath, versionsToTest };
        expectRule.ruleArguments = [expectOptions];
    }
    return config;
}

function range(minVersion: TsVersion, maxVersion: TsVersion): ReadonlyArray<TsVersion> {
    if (minVersion === "local") {
        assert(maxVersion === "local");
        return ["local"];
    }
    if (minVersion === TypeScriptVersion.latest) {
        assert(maxVersion === TypeScriptVersion.latest);
        return [TypeScriptVersion.latest];
    }
    assert(maxVersion !== "local");

    const minIdx = TypeScriptVersion.shipped.indexOf(minVersion);
    assert(minIdx >= 0);
    if (maxVersion === TypeScriptVersion.latest) {
        return [...TypeScriptVersion.shipped.slice(minIdx), TypeScriptVersion.latest];
    }
    const maxIdx = TypeScriptVersion.shipped.indexOf(maxVersion as TypeScriptVersion);
    assert(maxIdx >= minIdx);
    return TypeScriptVersion.shipped.slice(minIdx, maxIdx + 1);
}

export type TsVersion = TypeScriptVersion | "local";
