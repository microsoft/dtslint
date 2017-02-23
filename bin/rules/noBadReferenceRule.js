"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
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
class Walker extends Lint.RuleWalker {
    visitSourceFile(node) {
        for (const ref of node.referencedFiles) {
            if (node.isDeclarationFile) {
                if (ref.fileName.startsWith("..")) {
                    this.addFailureAtRef(ref, Rule.FAILURE_STRING);
                }
            }
            else {
                this.addFailureAtRef(ref, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
            }
        }
    }
    addFailureAtRef(ref, failure) {
        this.addFailureAt(ref.pos, ref.end, failure);
    }
}
//# sourceMappingURL=noBadReferenceRule.js.map