"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
// TODO: pull request to update tslint's `no-var-keyword`
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-var",
    description: "Forbids 'var'.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: false,
};
Rule.FAILURE_STRING = "Do not use 'var'.";
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    ts.forEachChild(ctx.sourceFile, function cb(node) {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                if (!Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword)
                    && !Lint.isBlockScopedVariable(node)
                    && !(node.parent.kind === ts.SyntaxKind.ModuleBlock && isDeclareGlobal(node.parent.parent))
                    && !(node.parent === sourceFile && !ts.isExternalModule(sourceFile) && sourceFile.isDeclarationFile)) {
                    ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
                }
                break;
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement: {
                const { initializer } = node;
                if (initializer && initializer.kind === ts.SyntaxKind.VariableDeclarationList &&
                    // tslint:disable-next-line no-bitwise
                    !Lint.isNodeFlagSet(initializer, ts.NodeFlags.Let | ts.NodeFlags.Const)) {
                    ctx.addFailureAtNode(initializer, Rule.FAILURE_STRING);
                }
                break;
            }
        }
        ts.forEachChild(node, cb);
    });
}
function isDeclareGlobal(node) {
    return isModuleDeclaration(node) && node.name.kind === ts.SyntaxKind.Identifier && node.name.text === "global";
}
function isModuleDeclaration(node) {
    return node.kind === ts.SyntaxKind.ModuleDeclaration;
}
//# sourceMappingURL=noVarRule.js.map