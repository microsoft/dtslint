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
    ruleName: "no-redundant-undefined",
    description: "Forbids optional parameters/properties to include an explicit `undefined` in their type.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
exports.Rule = Rule;
function failureString(container) {
    const desc = container.kind === ts.SyntaxKind.Parameter ? "Parameter" : "Property";
    return util_1.failure(Rule.metadata.ruleName, `${desc} is optional, so no need to specify \`undefined\` as a possible value.`);
}
function walk(ctx) {
    ctx.sourceFile.forEachChild(function recur(node) {
        if (node.kind === ts.SyntaxKind.UndefinedKeyword
            && ts.isUnionTypeNode(node.parent)
            && isOptionalParent(node.parent.parent)) {
            ctx.addFailureAtNode(node, failureString(node.parent.parent));
        }
        node.forEachChild(recur);
    });
}
function isOptionalParent(node) {
    switch (node.kind) {
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.PropertySignature:
            return node.questionToken !== undefined;
        default:
            return false;
    }
}
//# sourceMappingURL=noRedundantUndefinedRule.js.map