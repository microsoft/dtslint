"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
// Same functionality as https://github.com/palantir/tslint/pull/1654, but simpler implementation.
// Remove when that PR is in.
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        if (sourceFile.statements.length) {
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
Rule.FAILURE_STRING = "File has no content.";
exports.Rule = Rule;
//# sourceMappingURL=noUselessFilesRule.js.map