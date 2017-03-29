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
const installer_1 = require("./installer");
const util_1 = require("./util");
function lintWithVersion(dirPath, options, version) {
    return __awaiter(this, void 0, void 0, function* () {
        const tslint = installer_1.getLinter(version);
        const program = tslint.Linter.createProgram(path.join(dirPath, "tsconfig.json"));
        global.program = program;
        const lintOptions = {
            fix: false,
            formatter: "stylish",
            rulesDirectory: installer_1.rulesDirectory(version),
        };
        const linter = new tslint.Linter(lintOptions, program);
        const config = yield getLintConfig(tslint.Configuration, path.join(dirPath, "tslint.json"), options);
        for (const filename of program.getRootFileNames()) {
            const contents = yield fs_promise_1.readFile(filename, "utf-8");
            linter.lint(filename, contents, config);
        }
        const result = linter.getResult();
        return result.failureCount ? { message: result.output } : undefined;
    });
}
exports.lintWithVersion = lintWithVersion;
function getLintConfig(configuration, configPath, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield fs_promise_1.exists(configPath))) {
            if (options.dt) {
                throw new Error('On DefinitelyTyped, must include `tslint.json` containing `{ "extends": "../tslint.json" }`');
            }
            return defaultConfig(configuration);
        }
        const tslintJson = yield util_1.readJson(configPath);
        if (!tslintJson.extends) {
            const shouldExtend = options.dt ? "../tslint.json" : "dtslint/dtslint.json";
            throw new Error(`If 'tslint.json' is present, it should extend "${shouldExtend}"`);
        }
        return loadConfiguration(configuration, configPath);
    });
}
function loadConfiguration(configuration, configPath) {
    // Second param doesn't matter, since config path is provided.
    const config = configuration.findConfiguration(configPath, "").results;
    if (!config) {
        throw new Error(`Could not load config at ${configPath}`);
    }
    return config;
}
function defaultConfig(configuration) {
    return loadConfiguration(configuration, path.join(__dirname, "..", "dtslint.json"));
}
//# sourceMappingURL=lint.js.map