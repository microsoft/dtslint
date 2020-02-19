import path = require("path");
import fs = require("fs");
import { isExternalDependency } from "./lint";
import { Configuration as Config, ILinterOptions, Linter, RuleFailure, IRuleFailureJson, LintResult } from "tslint";
import { disabler as npmNamingDisabler } from "./rules/npmNamingRule";
import * as ts from "typescript";
import yargs = require("yargs");
import stringify = require("json-stable-stringify");

function main() {
    const args = yargs
        .usage(`\`$0 --dt=path-to-dt\` or \`$0 --package=path-to-dt-package\`
'dt.json' is used as the base tslint config for running the linter.`)
        .option("package", {
            describe: "Path of DT package.",
            type: "string",
            conflicts: "dt",
        })
        .option("dt", {
            describe: "Path of local DefinitelyTyped repository.",
            type: "string",
            conflicts: "package",
        })
        .check(arg => {
            if (!arg.package && !arg.dt) {
                throw new Error("You must provide either argument 'package' or 'dt'.");
            }
            return true;
        }).argv;
    
    if (args.package) {
        updatePackage(args.package, dtConfig());
    } else if (args.dt) {
        updateAll(args.dt);
    }
}

const dtConfigPath = "dt.json";
const ignoredRules: string[] = ["expect"];

function dtConfig(): Config.IConfigurationFile {
    const config = Config.findConfiguration(dtConfigPath).results;
    if (!config) {
        throw new Error(`Could not load config at ${dtConfigPath}.`);
    }
    // Disable ignored rules.
    for (const ignoredRule of ignoredRules) {
        const ruleOpts = config.rules.get(ignoredRule);
        if (ruleOpts) {
            ruleOpts.ruleSeverity = "off";
        }
    }
    return config;
}

function updateAll(dtPath: string): void {
    const packages = fs.readdirSync(path.join(dtPath, "types"));
    for (const pkg of packages) {
        updatePackage(path.join(dtPath, "types", pkg), dtConfig());
    }
}

function updatePackage(pkgPath: string, baseConfig: Config.IConfigurationFile): void {
    const packages = walkPackageDir(pkgPath);

    const linterOpts: ILinterOptions = {
        fix: false,
    };

    for (const pkg of packages) {
        const results = pkg.lint(linterOpts, baseConfig);
        if (results.failures.length > 0) {
            const disabledRules = disableRules(results.failures);
            const newConfig = mergeConfigRules(pkg.config(), disabledRules, baseConfig);
            pkg.updateConfig(newConfig);
        }
    }
}

function mergeConfigRules(
    config: Config.RawConfigFile,
    newRules: Config.RawRulesConfig,
    baseConfig: Config.IConfigurationFile): Config.RawConfigFile {
        const activeRules: string[] = [];
        baseConfig.rules.forEach((ruleOpts, ruleName) => {
            if (ruleOpts.ruleSeverity !== "off") {
                activeRules.push(ruleName);
            }
        });
        const oldRules: Config.RawRulesConfig = config.rules || {};
        let newRulesConfig: Config.RawRulesConfig = {};
        for (const rule of Object.keys(oldRules)) {
            if (activeRules.includes(rule)) {
                continue;
            }
            newRulesConfig[rule] = oldRules[rule];
        }
        newRulesConfig = { ...newRulesConfig, ...newRules };
        return { ...config, rules: newRulesConfig };
}

/** Represents a package from the linter's perspective.
 * For example, `DefinitelyTyped/types/react` and `DefinitelyTyped/types/react/v15` are different
 * packages.
*/
class LintPackage {
    private rootDir: string;
    private files: ts.SourceFile[];
    private program: ts.Program;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.files = [];
        this.program = Linter.createProgram(path.join(this.rootDir, "tsconfig.json"));
    }

    config(): Config.RawConfigFile {
        return Config.readConfigurationFile(path.join(this.rootDir, "tslint.json"));
    }

    addFile(filePath: string): void {
        const file = this.program.getSourceFile(filePath);
        if (file) {
            this.files.push(file);
        }
    }

    lint(opts: ILinterOptions, config: Config.IConfigurationFile): LintResult {
        const linter = new Linter(opts, this.program);
        for (const file of this.files) {
            if (ignoreFile(file, this.rootDir, this.program)) {
                continue;
            }
//             console.log(`Linting file ${file.fileName}.
// Root: ${this.rootDir}.`);
            linter.lint(file.fileName, file.text, config);
        }
        return linter.getResult();
    }

    updateConfig(config: Config.RawConfigFile): void {
        fs.writeFileSync(
            path.join(this.rootDir, "tslint.json"),
            stringify(config, { space: 4 }),
            { encoding: "utf8", flag: "w" });
    }
}

function ignoreFile(file: ts.SourceFile, dirPath: string, program: ts.Program): boolean {
    return program.isSourceFileDefaultLibrary(file) || isExternalDependency(file, path.resolve(dirPath), program);
}

function walkPackageDir(rootDir: string): LintPackage[] {
    const packages: LintPackage[] = [];

    function walk(curPackage: LintPackage, dir: string): void {
        for (const ent of fs.readdirSync(dir, { encoding: "utf8", withFileTypes: true })) {
            const entPath = path.join(dir, ent.name);
            if (ent.isFile()) {
                curPackage.addFile(entPath);
            }
            else if (ent.isDirectory()) {
                if (isVersionDir(ent.name)) {
                    const newPackage = new LintPackage(entPath);
                    packages.push(newPackage)
                    walk(newPackage, entPath);
                } else {
                    walk(curPackage, entPath);
                }
            }
        }
    }

    const lintPackage = new LintPackage(rootDir);
    packages.push(lintPackage);
    walk(lintPackage, rootDir);
    return packages;
}

/** Returns true if directory name matches a TypeScript or package version directory.
 *  Examples: `ts3.5`, `v11`, `v0.6` are all version names.
*/
function isVersionDir(dirName: string): boolean {
    return /^ts\d+\.\d$/.test(dirName) || /^v\d+(\.\d+)?$/.test(dirName);
}

type RuleOptions = boolean | unknown[];
type RuleDisabler = (failures: IRuleFailureJson[]) => RuleOptions;
const defaultDisabler: RuleDisabler = (_) => {
    return false;
}
const ruleDisablers: Map<string, RuleDisabler> = new Map([
    ["npm-naming", npmNamingDisabler],
]);

function disableRules(failures: RuleFailure[]): Config.RawRulesConfig {
    const ruleToFailures: Map<string, IRuleFailureJson[]> = new Map();
    for (const failure of failures) {
        const failureJson = failure.toJson();
        if (ruleToFailures.has(failureJson.ruleName)) {
            ruleToFailures.get(failureJson.ruleName)!.push(failureJson);
        } else {
            ruleToFailures.set(failureJson.ruleName, [failureJson]);
        }
    }

    const newRulesConfig: Config.RawRulesConfig = {};
    ruleToFailures.forEach((failures, rule) => {
        if (ignoredRules.includes(rule)) {
            return;
        }
        const disabler = ruleDisablers.get(rule) || defaultDisabler;
        const opts = disabler(failures);
        newRulesConfig[rule] = opts;
    });

    return newRulesConfig;
}

if (!module.parent) {
    main();
}