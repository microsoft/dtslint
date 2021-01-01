// This is a stand-alone script that updates TSLint configurations for DefinitelyTyped packages.
// It runs all rules specified in `dt.json`, and updates the existing configuration for a package
// by adding rule exemptions only for the rules that caused a lint failure.
// For example, if a configuration specifies `"no-trailing-whitespace": false` and this rule
// no longer produces an error, then it will not be disabled in the new configuration.
// If you update or create a rule and now it causes new failures in DT, you can update the `dt.json`
// configuration with your rule, then register a disabler function for your rule
// (check `disableRules` function below), then run this script with your rule as argument.

import cp = require("child_process");
import fs = require("fs");
import stringify = require("json-stable-stringify");
import path = require("path");
import { Configuration as Config, ILinterOptions, IRuleFailureJson, Linter, LintResult, RuleFailure } from "tslint";
import * as ts from "typescript";
import yargs = require("yargs");
import { isExternalDependency } from "./lint";
import { disabler as npmNamingDisabler } from "./rules/npmNamingRule";

// Rule "expect" needs TypeScript version information, which this script doesn't collect.
const ignoredRules: string[] = ["expect"];

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
        .option("rules", {
            describe: "Names of the rules to be updated. Leave this empty to update all rules.",
            type: "array",
            string: true,
            default: [] as string[],
        })
        .check(arg => {
            if (!arg.package && !arg.dt) {
                throw new Error("You must provide either argument 'package' or 'dt'.");
            }
            const unsupportedRules = arg.rules.filter(rule => ignoredRules.includes(rule));
            if (unsupportedRules.length > 0) {
                throw new Error(`Rules ${unsupportedRules.join(", ")} are not supported at the moment.`);
            }
            return true;
        }).argv;

    if (args.package) {
        updatePackage(args.package, dtConfig(args.rules));
    } else if (args.dt) {
        updateAll(args.dt, dtConfig(args.rules));
    }
}

const dtConfigPath = "dt.json";

function dtConfig(updatedRules: string[]): Config.IConfigurationFile {
    const config = Config.findConfiguration(dtConfigPath).results;
    if (!config) {
        throw new Error(`Could not load config at ${dtConfigPath}.`);
    }
    // Disable ignored or non-updated rules.
    for (const entry of config.rules.entries()) {
        const [rule, ruleOpts] = entry;
        if (ignoredRules.includes(rule) || (updatedRules.length > 0 && !updatedRules.includes(rule))) {
            ruleOpts.ruleSeverity = "off";
        }
    }
    return config;
}

function updateAll(dtPath: string, config: Config.IConfigurationFile): void {
    const packages = fs.readdirSync(path.join(dtPath, "types"));
    for (const pkg of packages) {
        updatePackage(path.join(dtPath, "types", pkg), config);
    }
}

function updatePackage(pkgPath: string, baseConfig: Config.IConfigurationFile): void {
    installDependencies(pkgPath);
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

function installDependencies(pkgPath: string): void {
    if (fs.existsSync(path.join(pkgPath, "package.json"))) {
        cp.execSync(
            "npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links",
            {
                encoding: "utf8",
                cwd: pkgPath,
            });
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

/**
 * Represents a package from the linter's perspective.
 * For example, `DefinitelyTyped/types/react` and `DefinitelyTyped/types/react/v15` are different
 * packages.
 */
class LintPackage {
    private files: ts.SourceFile[] = [];
    private program: ts.Program;

    constructor(private rootDir: string) {
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
            } else if (ent.isDirectory() && ent.name !== "node_modules") {
                if (isVersionDir(ent.name)) {
                    const newPackage = new LintPackage(entPath);
                    packages.push(newPackage);
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

/**
 * Returns true if directory name matches a TypeScript or package version directory.
 * Examples: `ts3.5`, `v11`, `v0.6` are all version names.
 */
function isVersionDir(dirName: string): boolean {
    return /^ts\d+\.\d$/.test(dirName) || /^v\d+(\.\d+)?$/.test(dirName);
}

type RuleOptions = boolean | unknown[];
type RuleDisabler = (failures: IRuleFailureJson[]) => RuleOptions;
const defaultDisabler: RuleDisabler = () => {
    return false;
};

function disableRules(allFailures: RuleFailure[]): Config.RawRulesConfig {
    const ruleToFailures: Map<string, IRuleFailureJson[]> = new Map();
    for (const failure of allFailures) {
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
        const disabler = rule === "npm-naming" ? npmNamingDisabler : defaultDisabler;
        const opts: RuleOptions = disabler(failures);
        newRulesConfig[rule] = opts;
    });

    return newRulesConfig;
}

if (!module.parent) {
    main();
}
