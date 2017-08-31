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
    ruleName: "no-dead-reference",
    description: "Ensures that all `/// <reference>` comments go at the top of the file.",
    rationale: "style",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "`/// <reference>` directive must be at top of file to take effect.");
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile: { statements, text } } = ctx;
    if (!statements.length) {
        return;
    }
    // 'm' flag makes it multiline, so `^` matches the beginning of any line.
    // 'g' flag lets us set rgx.lastIndex
    const rgx = /^\s*(\/\/\/ <reference)/mg;
    // Start search at the first statement. (`/// <reference>` before that is OK.)
    rgx.lastIndex = statements[0].getStart();
    while (true) {
        const match = rgx.exec(text);
        if (match === null) {
            break;
        }
        const length = match[1].length;
        const start = match.index + match[0].length - length;
        ctx.addFailureAt(start, length, Rule.FAILURE_STRING);
    }
}
//# sourceMappingURL=noDeadReferenceRule.js.map