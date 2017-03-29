"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-parent-references",
    description: 'Forbid <reference path="../etc"/>',
    rationale: "Parent references are not inferred as dependencies by types-publisher.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = "Don't use <reference path> to reference another package. Use an import or <reference types> instead.";
Rule.FAILURE_STRING_REFERENCE_IN_TEST = "Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'";
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    for (const ref of sourceFile.referencedFiles) {
        if (sourceFile.isDeclarationFile) {
            if (ref.fileName.startsWith("..")) {
                ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING);
            }
        }
        else {
            ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
        }
    }
}
//# sourceMappingURL=noBadReferenceRule.js.map