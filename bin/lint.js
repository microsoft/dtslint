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
const path_1 = require("path");
const installer_1 = require("./installer");
const util_1 = require("./util");
function lintWithVersion(dirPath, version) {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = getConfigPath(dirPath);
        const tslint = installer_1.getLinter(version);
        const program = tslint.Linter.createProgram(path_1.join(dirPath, "tsconfig.json"));
        const lintOptions = {
            fix: false,
            formatter: "stylish",
            rulesDirectory: installer_1.rulesDirectory(version),
        };
        const linter = new tslint.Linter(lintOptions, program);
        const config = yield getLintConfig(tslint.Configuration, configPath);
        for (const filename of program.getRootFileNames()) {
            const contents = yield fs_promise_1.readFile(filename, "utf-8");
            linter.lint(filename, contents, config);
        }
        const result = linter.getResult();
        return result.failures.length ? result.output : undefined;
    });
}
exports.lintWithVersion = lintWithVersion;
function checkTslintJson(dirPath, dt) {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = getConfigPath(dirPath);
        const shouldExtend = `dtslint/${dt ? "dt" : "dtslint"}.json`;
        if (!(yield fs_promise_1.exists(configPath))) {
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
function getLintConfig(configuration, expectedConfigPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const configPath = (yield fs_promise_1.exists(expectedConfigPath)) ? expectedConfigPath : path_1.join(__dirname, "..", "dtslint.json");
        // Second param to `findConfiguration` doesn't matter, since config path is provided.
        const config = configuration.findConfiguration(configPath, "").results;
        if (!config) {
            throw new Error(`Could not load config at ${configPath}`);
        }
        return config;
    });
}
//# sourceMappingURL=lint.js.map