"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const util_1 = require("../util");
class Rule extends Lint.Rules.TypedRule {
    applyWithProgram(sourceFile, program) {
        if (!sourceFile.isDeclarationFile) {
            return [];
        }
        const name = util_1.getCommonDirectoryName(program.getRootFileNames());
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, name));
    }
}
Rule.metadata = {
    ruleName: "no-self-import",
    description: "Forbids declaration files to import the current package using a global import.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: false,
};
exports.Rule = Rule;
const FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Declaration file should not use a global import of itself. Use a relative import.");
function walk(ctx, packageName) {
    for (const i of ctx.sourceFile.imports) {
        if (i.text === packageName || i.text.startsWith(packageName + "/")) {
            ctx.addFailureAtNode(i, FAILURE_STRING);
        }
    }
}
//# sourceMappingURL=noSelfImportRule.js.map