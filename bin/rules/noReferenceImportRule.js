"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    static FAILURE_STRING(moduleReference) {
        return `No need to reference ${moduleReference}, since it is imported anyway.`;
    }
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
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
class Walker extends Lint.RuleWalker {
    visitSourceFile(node) {
        const imports = allImports(node);
        for (const ref of node.typeReferenceDirectives) {
            if (imports.has(ref.fileName)) {
                this.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING(ref.fileName));
            }
        }
        // Don't recurse; we're done.
    }
}
function allImports(sourceFile) {
    const imports = new Set();
    function recur(node) {
        if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
            const ref = node.moduleReference;
            if (ref.kind === ts.SyntaxKind.ExternalModuleReference) {
                if (ref.expression) {
                    addImport(ref.expression);
                }
            }
        }
        else if (node.kind === ts.SyntaxKind.ImportDeclaration) {
            addImport(node.moduleSpecifier);
        }
        else {
            ts.forEachChild(node, recur);
        }
    }
    function addImport(moduleReference) {
        if (moduleReference.kind === ts.SyntaxKind.StringLiteral) {
            imports.add(moduleReference.text);
        }
    }
    recur(sourceFile);
    return imports;
}
//# sourceMappingURL=noReferenceImportRule.js.map