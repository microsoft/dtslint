"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const util_1 = require("../util");
// Same functionality as https://github.com/palantir/tslint/pull/1654, but simpler implementation.
// Remove when that PR is in.
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        const { statements, referencedFiles, typeReferenceDirectives } = sourceFile;
        if (statements.length + referencedFiles.length + typeReferenceDirectives.length !== 0) {
            return [];
        }
        return [new Lint.RuleFailure(sourceFile, 0, 1, Rule.FAILURE_STRING, this.ruleName)];
    }
}
Rule.metadata = {
    ruleName: "no-useless-files",
    description: "Forbids files with no content.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: false,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "File has no content.");
exports.Rule = Rule;
//# sourceMappingURL=noUselessFilesRule.js.map