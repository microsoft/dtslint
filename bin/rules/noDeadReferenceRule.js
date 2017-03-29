"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
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
Rule.FAILURE_STRING = "`/// <reference>` directive must be at top of file to take effect.";
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    if (!sourceFile.statements.length) {
        return;
    }
    // 'm' flag makes it multiline, so `^` matches the beginning of any line.
    // 'g' flag lets us set rgx.lastIndex
    const rgx = /^\s*\/\/\/ <reference/mg;
    // Start search at the first statement. (`/// <reference>` before that is OK.)
    rgx.lastIndex = sourceFile.statements[0].getStart();
    const match = rgx.exec(sourceFile.text);
    if (match !== null) {
        ctx.addFailureAt(match.index, 0, Rule.FAILURE_STRING);
    }
}
//# sourceMappingURL=noDeadReferenceRule.js.map