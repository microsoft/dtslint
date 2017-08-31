"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.TypedRule {
    applyWithProgram(sourceFile, program) {
        if (sourceFile.isDeclarationFile) {
            return [];
        }
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, program.getTypeChecker()));
    }
}
Rule.metadata = {
    ruleName: "no-relative-import-in-test",
    description: "Forbids test (non-declaration) files to use relative imports.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: false,
};
exports.Rule = Rule;
const FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Test file should not use a relative import. Use a global import as if this were a user of the package.");
function walk(ctx, checker) {
    const { sourceFile } = ctx;
    for (const i of sourceFile.imports) {
        if (i.text.startsWith(".")) {
            const moduleSymbol = checker.getSymbolAtLocation(i);
            if (!moduleSymbol || !moduleSymbol.declarations) {
                continue;
            }
            for (const decl of moduleSymbol.declarations) {
                if (decl.kind === ts.SyntaxKind.SourceFile && decl.isDeclarationFile) {
                    ctx.addFailureAtNode(i, FAILURE_STRING);
                }
            }
        }
    }
}
//# sourceMappingURL=noRelativeImportInTestRule.js.map