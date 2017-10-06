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
const fs_promise_1 = require("fs-promise");
const path = require("path");
const util_1 = require("./util");
function checkPackageJson(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const pkgJsonPath = path.join(dirPath, "package.json");
        if (!(yield fs_promise_1.exists(pkgJsonPath))) {
            return;
        }
        const pkgJson = yield util_1.readJson(pkgJsonPath);
        if (pkgJson.private !== true) {
            throw new Error(`${pkgJsonPath} should set \`"private": true\``);
        }
        for (const key in pkgJson) {
            switch (key) {
                case "private":
                case "dependencies":
                    // "private" checked above, "dependencies" checked by types-publisher
                    break;
                default:
                    throw new Error(`${pkgJsonPath} should not include field ${key}`);
            }
        }
    });
}
exports.checkPackageJson = checkPackageJson;
function checkTsconfig(dirPath, dt) {
    return __awaiter(this, void 0, void 0, function* () {
        const tsconfigPath = path.join(dirPath, "tsconfig.json");
        if (!(yield fs_promise_1.exists(tsconfigPath))) {
            throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
        }
        const tsconfig = yield util_1.readJson(tsconfigPath);
        const options = tsconfig.compilerOptions;
        if (dt) {
            const isOlderVersion = /^v\d+$/.test(path.basename(dirPath));
            const baseUrl = isOlderVersion ? "../../" : "../";
            const mustHave = {
                module: "commonjs",
                noEmit: true,
                forceConsistentCasingInFileNames: true,
                baseUrl,
                typeRoots: [baseUrl],
                types: [],
            };
            for (const key of Object.getOwnPropertyNames(mustHave)) {
                const expected = mustHave[key];
                const actual = options[key];
                if (!deepEquals(expected, actual)) {
                    throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${JSON.stringify(expected)}`);
                }
            }
            for (const key in options) {
                switch (key) {
                    case "lib":
                    case "noImplicitAny":
                    case "noImplicitThis":
                    case "strictNullChecks":
                    case "strictFunctionTypes":
                        break;
                    case "target":
                    case "paths":
                    case "jsx":
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
        for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks", "strictFunctionTypes"]) {
            if (!(key in options)) {
                throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
            }
        }
        if (options.types && options.types.length) {
            throw new Error('Use `/// <reference types="..." />` directives in source files and ensure ' +
                'that the "types" field in your tsconfig is an empty array.');
        }
    });
}
exports.checkTsconfig = checkTsconfig;
function deepEquals(expected, actual) {
    if (expected instanceof Array) {
        return actual instanceof Array
            && actual.length === expected.length
            && expected.every((e, i) => deepEquals(e, actual[i]));
    }
    else {
        return expected === actual;
    }
}
//# sourceMappingURL=checks.js.map