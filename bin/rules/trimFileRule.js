"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "trim-file",
    description: "Forbids leading/trailing blank lines in a file. Allows file to end in '\n'.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: false,
};
Rule.FAILURE_STRING_LEADING = "File should not begin with a blank line.";
Rule.FAILURE_STRING_TRAILING = "File should not end with a blank line. (Ending in '\\n' OK, ending in '\\n\\n' not OK.)";
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile: { text } } = ctx;
    if (text.startsWith("\r") || text.startsWith("\n")) {
        ctx.addFailureAt(0, 1, Rule.FAILURE_STRING_LEADING);
    }
    if (text.endsWith("\n\n") || text.endsWith("\r\n\r\n")) {
        ctx.addFailureAt(text.length - 1, 1, Rule.FAILURE_STRING_TRAILING);
    }
}
//# sourceMappingURL=trimFileRule.js.map