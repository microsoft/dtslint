import path from "path";
import fs from "fs";
import { isExternalDependency } from "./lint";
import { Configuration as Config, ILinterOptions, Linter, RuleFailure, IRuleFailureJson, LintResult } from "tslint";
import { disabler as npmNamingDisabler } from "./rules/npmNamingRule";
import * as ts from "typescript";
import yargs = require("yargs");

function main() {
    // TODO: write about our assumptions of config file (dt.json).
    const args = yargs
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

function dtConfig(): Config.IConfigurationFile {
    const config = Config.findConfiguration(dtConfigPath).results;
    if (!config) {
        throw new Error(`Could not load config at ${dtConfigPath}.`);
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

    // console.log(packages);
    for (const pkg of packages) {
        const results = pkg.lint(linterOpts, baseConfig);
        if (results.failures.length > 0) {
            const newRulesConfig = disableRules(results.failures);
            const oldConfig: Config.RawConfigFile = pkg.config();
            const newConfig: Config.RawConfigFile = { ...oldConfig, rules: newRulesConfig };
            pkg.updateConfig(newConfig);
        }
    }
}

/** Represents a package from the linter's perspective. */
// TODO: write more about this.
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
            console.log(`Linting file ${file.fileName}.
Root: ${this.rootDir}.`);
            linter.lint(file.fileName, file.text, config);
        }
        return linter.getResult();
    }

    updateConfig(config: Config.RawConfigFile): void {
        fs.writeFileSync(
            path.join(this.rootDir, "tslint.json"),
            JSON.stringify(config, /* replacer */ undefined, /* space */ 4),
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
 *  Examples: `ts3.5`, `v11`, v0.6
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
        console.log(JSON.stringify(failureJson));
        if (ruleToFailures.has(failureJson.ruleName)) {
            ruleToFailures.get(failureJson.ruleName)!.push(failureJson);
        } else {
            ruleToFailures.set(failureJson.ruleName, [failureJson]);
        }
    }

    const newRulesConfig: Config.RawRulesConfig = {};
    ruleToFailures.forEach((failures, rule) => {
        const disabler = ruleDisablers.get(rule) || defaultDisabler;
        const opts = disabler(failures);
        newRulesConfig[rule] = opts;
    });

    return newRulesConfig;
}

const dtConfigPath = "dt.json";
// const baseDtTslintConfig: Config.RawConfigFile = {
//     extends: `dtslint/${dtConfigPath}`,
// };

// function readConfig(pkgPath: string): Config.RawConfigFile {
//     if (fs.existsSync(path.join(pkgPath, "tslint.json"))) {
//         return Config.readConfigurationFile(path.join(pkgPath, "tslint.json"));
//     }
//     return baseDtTslintConfig;
// }

if (!module.parent) {
    main();
}