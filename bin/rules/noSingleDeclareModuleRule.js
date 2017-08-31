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
    ruleName: "no-single-declare-module",
    description: "Don't use an ambient module declaration if you can use an external module file.",
    rationale: "Cuts down on nesting",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "File has only 1 module declaration — write it as an external module.");
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    // If it's an external module, any module declarations inside are augmentations.
    if (ts.isExternalModule(sourceFile)) {
        return;
    }
    let moduleDecl;
    for (const statement of sourceFile.statements) {
        if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
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