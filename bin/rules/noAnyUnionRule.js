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
    ruleName: "no-any-union",
    description: "Forbid a union to contain `any`",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Including `any` in a union will override all other members of the union.");
exports.Rule = Rule;
function walk(ctx) {
    ctx.sourceFile.forEachChild(function recur(node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword && ts.isUnionTypeNode(node.parent)) {
            ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
        node.forEachChild(recur);
    });
}
//# sourceMappingURL=noAnyUnionRule.js.map