import { makeTypesVersionsForPackageJson } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import { pathExists } from "fs-extra";
import { join as joinPaths } from "path";

import { getCompilerOptions, readJson } from "./util";

export async function checkPackageJson(
    dirPath: string,
    typesVersions: ReadonlyArray<TypeScriptVersion>,
): Promise<void> {
    const pkgJsonPath = joinPaths(dirPath, "package.json");
    const needsTypesVersions = typesVersions.length !== 0;
    if (!await pathExists(pkgJsonPath)) {
        if (needsTypesVersions) {
            throw new Error(`${dirPath}: Must have 'package.json' for "typesVersions"`);
        }
        return;
    }

    const pkgJson = await readJson(pkgJsonPath) as Record<string, unknown>;

    if ((pkgJson as any).private !== true) {
        throw new Error(`${pkgJsonPath} should set \`"private": true\``);
    }

    if (needsTypesVersions) {
        assert.strictEqual((pkgJson as any).types, "index", `"types" in '${pkgJsonPath}' should be "index".`);
        const expected = makeTypesVersionsForPackageJson(typesVersions);
        assert.deepEqual((pkgJson as any).typesVersions, expected,
            `"typesVersions" in '${pkgJsonPath}' is not set right. Should be: ${JSON.stringify(expected, undefined, 4)}`);
    }

    for (const key in pkgJson) { // tslint:disable-line forin
        switch (key) {
            case "private":
            case "dependencies":
            case "license":
                // "private"/"typesVersions"/"types" checked above, "dependencies" / "license" checked by types-publisher,
                break;
            case "typesVersions":
            case "types":
                if (!needsTypesVersions) {
                    throw new Error(`${pkgJsonPath} doesn't need to set "${key}" when no 'ts3.x' directories exist.`);
                }
                break;
            default:
                throw new Error(`${pkgJsonPath} should not include field ${key}`);
        }
    }
}

export interface DefinitelyTypedInfo {
    /** "../" or "../../" or "../../../". This should use '/' even on windows. */
    readonly relativeBaseUrl: string;
}
export async function checkTsconfig(dirPath: string, dt: DefinitelyTypedInfo | undefined): Promise<void> {
    const options = await getCompilerOptions(dirPath);

    if (dt) {
        const { relativeBaseUrl } = dt;

        const mustHave = {
            module: "commonjs",
            noEmit: true,
            forceConsistentCasingInFileNames: true,
            baseUrl: relativeBaseUrl,
            typeRoots: [relativeBaseUrl],
            types: [],
        };

        for (const key of Object.getOwnPropertyNames(mustHave) as Array<keyof typeof mustHave>) {
            const expected = mustHave[key];
            const actual = options[key];
            if (!deepEquals(expected, actual)) {
                throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${JSON.stringify(expected)}`);
            }
        }

        for (const key in options) { // tslint:disable-line forin
            switch (key) {
                case "lib":
                case "noImplicitAny":
                case "noImplicitThis":
                case "strict":
                case "strictNullChecks":
                case "noUncheckedIndexedAccess":
                case "strictFunctionTypes":
                case "esModuleInterop":
                case "allowSyntheticDefaultImports":
                    // Allow any value
                    break;
                case "target":
                case "paths":
                case "jsx":
                case "jsxFactory":
                case "experimentalDecorators":
                case "noUnusedLocals":
                case "noUnusedParameters":
                    // OK. "paths" checked further by types-publisher
                    break;
                default:
                    if (!(key in mustHave)) {
                        throw new Error(`Unexpected compiler option ${key}`);
                    }
            }
        }
    }

    if (!("lib" in options)) {
        throw new Error('Must specify "lib", usually to `"lib": ["es6"]` or `"lib": ["es6", "dom"]`.');
    }

    if ("strict" in options) {
        if (options.strict !== true) {
            throw new Error('When "strict" is present, it must be set to `true`.');
        }

        for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
            if (key in options) {
                throw new TypeError(`Expected "${key}" to not be set when "strict" is \`true\`.`);
            }
        }
    } else {
        for (const key of ["noImplicitAny"]) {
            if (!options[key]) {
                throw new Error(`Expected \`"${key}": true\`.`);
            }
        }

        for (const key of ["noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
            if (!(key in options)) {
                throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
            }
        }
    }

    if (options.types && options.types.length) {
        throw new Error(
            'Use `/// <reference types="..." />` directives in source files and ensure ' +
            'that the "types" field in your tsconfig is an empty array.');
    }
}

function deepEquals(expected: unknown, actual: unknown): boolean {
    if (expected instanceof Array) {
        return actual instanceof Array
            && actual.length === expected.length
            && expected.every((e, i) => deepEquals(e, actual[i]));
    } else {
        return expected === actual;
    }
}
