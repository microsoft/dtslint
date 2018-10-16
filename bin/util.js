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
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const stripJsonComments = require("strip-json-comments");
const ts = require("typescript");
function readJson(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = yield fs_extra_1.readFile(path, "utf-8");
        return JSON.parse(stripJsonComments(text));
    });
}
exports.readJson = readJson;
function failure(ruleName, s) {
    return `${s} See: https://github.com/Microsoft/dtslint/blob/master/docs/${ruleName}.md`;
}
exports.failure = failure;
function getCommonDirectoryName(files) {
    let minLen = 999;
    let minDir = "";
    for (const file of files) {
        const dir = path_1.dirname(file);
        if (dir.length < minLen) {
            minDir = dir;
            minLen = dir.length;
        }
    }
    return path_1.basename(minDir);
}
exports.getCommonDirectoryName = getCommonDirectoryName;
function eachModuleStatement(sourceFile, action) {
    if (!sourceFile.isDeclarationFile) {
        return;
    }
    for (const node of sourceFile.statements) {
        if (ts.isModuleDeclaration(node)) {
            const statements = getModuleDeclarationStatements(node);
            if (statements) {
                for (const statement of statements) {
                    action(statement);
                }
            }
        }
        else {
            action(node);
        }
    }
}
exports.eachModuleStatement = eachModuleStatement;
function getModuleDeclarationStatements(node) {
    let { body } = node;
    while (body && body.kind === ts.SyntaxKind.ModuleDeclaration) {
        body = body.body;
    }
    return body && ts.isModuleBlock(body) ? body.statements : undefined;
}
exports.getModuleDeclarationStatements = getModuleDeclarationStatements;
function getCompilerOptions(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const tsconfigPath = path_1.join(dirPath, "tsconfig.json");
        if (!(yield fs_extra_1.pathExists(tsconfigPath))) {
            throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
        }
        return (yield readJson(tsconfigPath)).compilerOptions;
    });
}
exports.getCompilerOptions = getCompilerOptions;
function withoutPrefix(s, prefix) {
    return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}
exports.withoutPrefix = withoutPrefix;
function last(a) {
    assert(a.length !== 0);
    return a[a.length - 1];
}
exports.last = last;
function assertDefined(a) {
    if (a === undefined) {
        throw new Error();
    }
    return a;
}
exports.assertDefined = assertDefined;
function mapDefinedAsync(arr, mapper) {
    return __awaiter(this, void 0, void 0, function* () {
        const out = [];
        for (const a of arr) {
            const res = yield mapper(a);
            if (res !== undefined) {
                out.push(res);
            }
        }
        return out;
    });
}
exports.mapDefinedAsync = mapDefinedAsync;
//# sourceMappingURL=util.js.map