"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.TypedRule {
    applyWithProgram(sourceFile, program) {
        if (!sourceFile.isDeclarationFile) {
            return [];
        }
        const packageName = util_1.getCommonDirectoryName(program.getRootFileNames());
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, packageName));
    }
}
Rule.metadata = {
    ruleName: "no-declare-current-package",
    description: "Don't use an ambient module declaration of the current package; use an external module.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx, packageName) {
    for (const statement of ctx.sourceFile.statements) {
        if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
            const { text } = statement.name;
            if (text === packageName || text.startsWith(`${packageName}/`)) {
                const preferred = text === packageName ? '"index.d.ts"' : `"${text}.d.ts" or "${text}/index.d.ts`;
                ctx.addFailureAtNode(statement.name, util_1.failure(Rule.metadata.ruleName, `Instead of declaring a module with \`declare module "${text}"\`, ` +
                    `write its contents in directly in ${preferred}.`));
            }
        }
    }
}
//# sourceMappingURL=noDeclareCurrentPackageRule.js.map