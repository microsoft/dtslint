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
        const ignoredField = Object.keys(pkgJson).find(field => !["dependencies", "peerDependencies", "description"].includes(field));
        if (ignoredField) {
            throw new Error(`Ignored field in ${pkgJsonPath}: ${ignoredField}`);
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
            const mustHave = {
                module: "commonjs",
                // target: "es6", // Some libraries use an ES5 target, such as es6-shim
                noEmit: true,
                forceConsistentCasingInFileNames: true,
            };
            for (const [key, value] of Object.entries(mustHave)) {
                if (options[key] !== value) {
                    throw new Error(`Expected compilerOptions[${JSON.stringify(key)}] === ${value}`);
                }
            }
        }
        if (!("lib" in options)) {
            throw new Error('Must specify "lib", usually to `"lib": ["es6"]` or `"lib": ["es6", "dom"]`.');
        }
        for (const key of ["noImplicitAny", "noImplicitThis", "strictNullChecks"]) {
            if (!(key in options)) {
                throw new Error(`Expected \`"${key}": true\` or \`"${key}": false\`.`);
            }
        }
        if (dt) {
            if (("typeRoots" in options) && !("types" in options)) {
                throw new Error('If the "typeRoots" option is specified in your tsconfig, ' +
                    'you must include `"types": []` to prevent very long compile times.');
            }
        }
        if (options.types && options.types.length) {
            throw new Error('Use `/// <reference types="..." />` directives in source files and ensure ' +
                'that the "types" field in your tsconfig is an empty array.');
        }
    });
}
exports.checkTsconfig = checkTsconfig;
//# sourceMappingURL=checks.js.map