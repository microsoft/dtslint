"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
    }
}
Rule.metadata = {
    ruleName: "no-public",
    description: "Forbids the 'public' keyword.",
    rationale: "For simplicity",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = "No need to write `public`; this is implicit.";
exports.Rule = Rule;
class Walker extends Lint.RuleWalker {
    visitConstructorDeclaration(node) {
        this.check(node);
        super.visitConstructorDeclaration(node);
    }
    visitMethodDeclaration(node) {
        this.check(node);
        super.visitMethodDeclaration(node);
    }
    visitPropertyDeclaration(node) {
        this.check(node);
        super.visitPropertyDeclaration(node);
    }
    visitGetAccessor(node) {
        this.check(node);
        super.visitGetAccessor(node);
    }
    visitSetAccessor(node) {
        this.check(node);
        super.visitSetAccessor(node);
    }
    check(node) {
        if (node.modifiers && Lint.hasModifier(node.modifiers, ts.SyntaxKind.PublicKeyword)) {
            this.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
    }
}
//# sourceMappingURL=noPublicRule.js.map