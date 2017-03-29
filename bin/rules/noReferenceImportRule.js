"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
// TODO: Remove when https://github.com/palantir/tslint/pull/2273 is in
const util = require("tsutils");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    static FAILURE_STRING(moduleReference) {
        return `No need to reference ${moduleReference}, since it is imported anyway.`;
    }
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-reference-import",
    description: 'Don\'t <reference types="foo" /> if you import "foo" anyway.',
    rationale: "Removes unnecessary code.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    const imports = allImports(sourceFile);
    for (const ref of sourceFile.typeReferenceDirectives) {
        if (imports.has(ref.fileName)) {
            ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING(ref.fileName));
        }
    }
}
function allImports(sourceFile) {
    const imports = new Set();
    function recur(node) {
        if (util.isImportEqualsDeclaration(node)) {
            const ref = node.moduleReference;
            if (ref.kind === ts.SyntaxKind.ExternalModuleReference) {
                if (ref.expression) {
                    addImport(ref.expression);
                }
            }
        }
        else if (util.isImportDeclaration(node)) {
            addImport(node.moduleSpecifier);
        }
        else {
            ts.forEachChild(node, recur);
        }
    }
    function addImport(moduleReference) {
        if (util.isStringLiteral(moduleReference)) {
            imports.add(moduleReference.text);
        }
    }
    recur(sourceFile);
    return imports;
}
//# sourceMappingURL=noReferenceImportRule.js.map