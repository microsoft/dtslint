"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const util_1 = require("../util");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-bad-reference",
    description: 'Forbid <reference path="../etc"/> in any file, and forbid <reference path> in test files.',
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Don't use <reference path> to reference another package. Use an import or <reference types> instead.");
Rule.FAILURE_STRING_REFERENCE_IN_TEST = util_1.failure(Rule.metadata.ruleName, "Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'.");
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    for (const ref of sourceFile.referencedFiles) {
        if (sourceFile.isDeclarationFile) {
            if (ref.fileName.startsWith("..")) {
                ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING);
            }
        }
        else {
            ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
        }
    }
}
//# sourceMappingURL=noBadReferenceRule.js.map