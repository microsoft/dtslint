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
    ruleName: "no-single-element-tuple-type",
    description: "Forbids `[T]`, which should be `T[]`.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    sourceFile.forEachChild(function cb(node) {
        if (ts.isTupleTypeNode(node) && node.elementTypes.length === 1) {
            ctx.addFailureAtNode(node, util_1.failure(Rule.metadata.ruleName, "Type [T] is a single-element tuple type. You probably meant T[]."));
        }
        node.forEachChild(cb);
    });
}
//# sourceMappingURL=noSingleElementTupleTypeRule.js.map