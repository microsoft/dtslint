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
import { ESLint, Linter } from "eslint";
import yargs = require("yargs");
import { disabler as npmNamingDisabler } from "./rules/npmNamingRule";

// Rule "expect" needs TypeScript version information, which this script doesn't collect.
const ignoredRules: string[] = ["expect"];

async function main() {
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
        await updatePackage(args.package, await dtConfig(args.rules));
    } else if (args.dt) {
        await updateAll(args.dt, await dtConfig(args.rules));
    }
}

const dtConfigPath = "dt.json";

/**
 * Transforms an existing config file by disabling any rules no longer
 * specified explicitly in the provided list.
 */
async function dtConfig(updatedRules: string[]): Promise<Linter.Config> {
    const eslint = new ESLint({ fix: false });
    const config = await eslint.calculateConfigForFile(dtConfigPath);
    // Disable ignored or non-updated rules.
    if (config.rules) {
        for (const rule in config.rules) {
            if (config.rules.hasOwnProperty(rule)) {
                if (ignoredRules.includes(rule) || (updatedRules.length > 0 && !updatedRules.includes(rule))) {
                    config[rule] = "off";
                }
            }
        }
    }
    return config;
}

/**
 * Updates all types packages.
 */
function updateAll(dtPath: string, config: Linter.Config): Promise<void[]> {
    const packages = fs.readdirSync(path.join(dtPath, "types"));
    return Promise.all(packages.map(pkg =>
        updatePackage(path.join(dtPath, "types", pkg), config)));
}

/**
 * Updates an individual package's lint rules.
 * If a rule has failures, it will be disabled.
 */
async function updatePackage(pkgPath: string, baseConfig: Linter.Config): Promise<void> {
    installDependencies(pkgPath);
    const packages = walkPackageDir(pkgPath);

    const linterOpts: ESLint.Options = {
        fix: false,
    };

    for (const pkg of packages) {
        const results = await pkg.lint(linterOpts, baseConfig);
        if (results.some(result => result.errorCount > 0)) {
            const disabledRules = disableRules(results);
            const newConfig = mergeConfigRules(await pkg.config(), disabledRules, baseConfig);
            pkg.updateConfig(newConfig);
        }
    }
}

/**
 * Installs the dependencies for a single package.
 */
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

/**
 * Merges a set of rules into a configuration object.
 */
function mergeConfigRules(
    config: Linter.Config,
    newRules: Partial<Linter.RulesRecord>,
    baseConfig: Linter.Config): Linter.Config {
        const activeRules: string[] = [];
        if (baseConfig.rules) {
            for (const [ruleName, ruleOpts] of Object.entries(baseConfig.rules)) {
                if (ruleOpts !== "off" || (Array.isArray(ruleOpts) && ruleOpts[0] !== "off")) {
                    activeRules.push(ruleName);
                }
            }
        }
        const oldRules: Partial<Linter.RulesRecord> = config.rules ?? {};
        let newRulesConfig: Partial<Linter.RulesRecord> = {};
        for (const [ruleName, ruleOpts] of Object.entries(oldRules)) {
            if (activeRules.includes(ruleName)) {
                continue;
            }
            newRulesConfig[ruleName] = ruleOpts;
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
    private files: Set<string> = new Set();

    constructor(private rootDir: string) {
    }

    config(): Promise<Linter.Config> {
        const eslint = new ESLint({ fix: false });
        const tsConfigPath = path.join(this.rootDir, "tsconfig.json");
        return eslint.calculateConfigForFile(tsConfigPath);
    }

    addFile(filePath: string): void {
        this.files.add(filePath);
    }

    lint(opts: ESLint.Options, config: Linter.Config): Promise<ESLint.LintResult[]> {
        const linter = new ESLint({
            ...opts,
            overrideConfig: config
        });
        return linter.lintFiles([...this.files]);
    }

    updateConfig(config: Linter.Config): void {
        fs.writeFileSync(
            path.join(this.rootDir, "eslint.json"),
            stringify(config, { space: 4 }),
            { encoding: "utf8", flag: "w" });
    }
}

/**
 * Walks a package's directory for files to lint.
 */
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

type RuleDisabler = (failures: Linter.LintMessage[]) => Linter.RuleEntry;
const defaultDisabler: RuleDisabler = _ => {
    return 0;
};

function disableRules(results: ESLint.LintResult[]): Partial<Linter.RulesRecord> {
    const ruleToFailures: Map<string, Linter.LintMessage[]> = new Map();
    for (const result of results) {
        for (const message of result.messages) {
            if (message.fatal && message.ruleId) {
                if (ruleToFailures.has(message.ruleId)) {
                    ruleToFailures.get(message.ruleId)!.push(message);
                } else {
                    ruleToFailures.set(message.ruleId, [message]);
                }
            }
        }
    }

    const newRulesConfig: Partial<Linter.RulesRecord> = {};
    for (const [ruleName, messages] of ruleToFailures.entries()) {
        if (ignoredRules.includes(ruleName)) {
            return {};
        }
        const disabler = ruleName === "npm-naming" ? npmNamingDisabler : defaultDisabler;
        const opts: Linter.RuleEntry = disabler(messages);
        newRulesConfig[ruleName] = opts;
    }

    return newRulesConfig;
}

if (!module.parent) {
    main();
}
