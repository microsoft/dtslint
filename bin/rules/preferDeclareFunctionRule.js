"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "prefer-declare-function",
    description: "Forbids `export const x = () => void`.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Use a function declaration instead of a variable of function type.");
exports.Rule = Rule;
function walk(ctx) {
    util_1.eachModuleStatement(ctx.sourceFile, statement => {
        if (ts.isVariableStatement(statement)) {
            for (const varDecl of statement.declarationList.declarations) {
                if (varDecl.type !== undefined && varDecl.type.kind === ts.SyntaxKind.FunctionType) {
                    ctx.addFailureAtNode(varDecl, Rule.FAILURE_STRING);
                }
            }
        }
    });
}
//# sourceMappingURL=preferDeclareFunctionRule.js.map