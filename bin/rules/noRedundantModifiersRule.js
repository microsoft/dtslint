"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        if (!sourceFile.isDeclarationFile) {
            return [];
        }
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "no-redundant-modifiers",
    description: "Forbids unnecessary 'export' or 'declare' modifiers in declaration files.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    const isExportAssign = sourceFile.statements.some(s => s.kind === ts.SyntaxKind.ExportAssignment);
    for (const node of sourceFile.statements) {
        if (isDeclare(node)) {
            if (isExport(node)) {
                ctx.addFailureAtNode(node, "'export declare' is redundant, just use 'export'.");
            }
            else {
                if (ts.isExternalModule(sourceFile)) {
                    if (!isExportAssign && !isDeclareGlobalOrExternalModuleDeclaration(node)) {
                        ctx.addFailureAtNode(node, "Prefer 'export' to 'declare' in an external module.");
                    }
                }
                else {
                    // Types do not need 'declare'.
                    switch (node.kind) {
                        case ts.SyntaxKind.InterfaceDeclaration:
                        case ts.SyntaxKind.TypeAliasDeclaration:
                            ctx.addFailureAtNode(node, "'declare' keyword is redundant here.");
                    }
                }
            }
        }
        if (isModuleDeclaration(node)) {
            checkModule(node);
        }
    }
    function checkModule({ body }) {
        if (!body) {
            return;
        }
        switch (body.kind) {
            case ts.SyntaxKind.ModuleDeclaration:
                checkModule(body);
                break;
            case ts.SyntaxKind.ModuleBlock:
                checkBlock(body);
                break;
        }
    }
    function checkBlock(block) {
        for (const s of block.statements) {
            // Compiler will error for 'declare' here anyway, so just check for 'export'.
            if (isExport(s)) {
                ctx.addFailureAtNode(s, "'export' keyword is redundant here.");
            }
            if (isModuleDeclaration(s)) {
                checkModule(s);
            }
        }
    }
}
function isDeclareGlobalOrExternalModuleDeclaration(node) {
    return isModuleDeclaration(node) && (node.name.kind === ts.SyntaxKind.StringLiteral ||
        node.name.kind === ts.SyntaxKind.Identifier && node.name.text === "global");
}
function isModuleDeclaration(node) {
    return node.kind === ts.SyntaxKind.ModuleDeclaration;
}
function isDeclare(node) {
    return Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword);
}
function isExport(node) {
    return Lint.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword);
}
//# sourceMappingURL=noRedundantModifiersRule.js.map