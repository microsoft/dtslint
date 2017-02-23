"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        // If it's an external module, any module declarations inside are augmentations.
        if (ts.isExternalModule(sourceFile)) {
            return [];
        }
        if (hasSoleModuleDeclaration(sourceFile)) {
            return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
        }
        else {
            return [];
        }
    }
}
Rule.metadata = {
    ruleName: "no-single-declare-module",
    description: "Don't use an ambient module declaration if you can use an external module file.",
    rationale: "Cuts down on nesting",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = "File has only 1 module declaration — write it as an external module.";
exports.Rule = Rule;
// A walker is needed for `tslint:disable` to work.
class Walker extends Lint.RuleWalker {
    visitModuleDeclaration(node) {
        if (isModuleDeclaration(node)) {
            this.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
    }
}
function hasSoleModuleDeclaration({ statements }) {
    let moduleDecl;
    for (const statement of statements) {
        if (statement.kind === ts.SyntaxKind.ModuleDeclaration) {
            const decl = statement;
            if (isModuleDeclaration(decl)) {
                if (moduleDecl === undefined) {
                    moduleDecl = decl;
                }
                else {
                    // Has more than 1 declaration
                    return false;
                }
            }
        }
    }
    return !!moduleDecl;
}
function isModuleDeclaration(decl) {
    return decl.name.kind === ts.SyntaxKind.StringLiteral;
}
//# sourceMappingURL=noSingleDeclareModuleRule.js.map