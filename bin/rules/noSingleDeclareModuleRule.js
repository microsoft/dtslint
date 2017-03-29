"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const util = require("tsutils");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-single-declare-module",
    description: "Don't use an ambient module declaration if you can use an external module file.",
    rationale: "Cuts down on nesting",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = "File has only 1 module declaration — write it as an external module.";
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    // If it's an external module, any module declarations inside are augmentations.
    if (ts.isExternalModule(sourceFile)) {
        return;
    }
    let moduleDecl;
    for (const statement of sourceFile.statements) {
        if (util.isModuleDeclaration(statement) && util.isStringLiteral(statement.name)) {
            if (moduleDecl === undefined) {
                moduleDecl = statement;
            }
            else {
                // Has more than 1 declaration
                return;
            }
        }
    }
    if (moduleDecl) {
        ctx.addFailureAtNode(moduleDecl, Rule.FAILURE_STRING);
    }
}
//# sourceMappingURL=noSingleDeclareModuleRule.js.map