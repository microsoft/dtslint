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
    ruleName: "no-const-enum",
    description: "Forbid `const enum`",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Use of `const enum`s is forbidden.");
exports.Rule = Rule;
function walk(ctx) {
    ctx.sourceFile.forEachChild(function recur(node) {
        if (ts.isEnumDeclaration(node) && node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ConstKeyword)) {
            ctx.addFailureAtNode(node.name, Rule.FAILURE_STRING);
        }
        node.forEachChild(recur);
    });
}
//# sourceMappingURL=noConstEnumRule.js.map