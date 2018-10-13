"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "strict-export-declare-modifiers",
    description: "Enforces strict rules about where the 'export' and 'declare' modifiers may appear.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    const isExternal = sourceFile.isDeclarationFile
        && !sourceFile.statements.some(s => s.kind === ts.SyntaxKind.ExportAssignment)
        && ts.isExternalModule(sourceFile);
    for (const node of sourceFile.statements) {
        if (isExternal) {
            checkInExternalModule(node, isAutomaticExport(sourceFile));
        }
        else {
            checkInOther(node);
        }
        if (isModuleDeclaration(node) && (sourceFile.isDeclarationFile || isDeclare(node))) {
            checkModule(node);
        }
    }
    function checkInExternalModule(node, autoExportEnabled) {
        // Ignore certain node kinds (these can't have 'export' or 'default' modifiers)
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ImportEqualsDeclaration:
            case ts.SyntaxKind.ExportDeclaration:
            case ts.SyntaxKind.NamespaceExportDeclaration:
                return;
        }
        // `declare global` and `declare module "foo"` OK. `declare namespace N` not OK, should be `export namespace`.
        if (!isDeclareGlobalOrExternalModuleDeclaration(node)) {
            if (isDeclare(node)) {
                fail(mod(node, ts.SyntaxKind.DeclareKeyword), "'declare' keyword is redundant here.");
            }
            if (autoExportEnabled && !isExport(node)) {
                fail(node.name || node, "All declarations in this module are exported automatically. " +
                    "Prefer to explicitly write 'export' for clarity. " +
                    "If you have a good reason not to export this declaration, " +
                    "add 'export {}' to the module to shut off automatic exporting.");
            }
        }
    }
    function checkInOther(node) {
        // Compiler will enforce presence of 'declare' where necessary. But types do not need 'declare'.
        if (isDeclare(node)) {
            switch (node.kind) {
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.TypeAliasDeclaration:
                    fail(mod(node, ts.SyntaxKind.DeclareKeyword), "'declare' keyword is redundant here.");
            }
        }
    }
    function fail(node, reason) {
        ctx.addFailureAtNode(node, util_1.failure(Rule.metadata.ruleName, reason));
    }
    function mod(node, kind) {
        return node.modifiers.find(m => m.kind === kind);
    }
    function checkModule(moduleDeclaration) {
        const body = moduleDeclaration.body;
        if (!body) {
            return;
        }
        switch (body.kind) {
            case ts.SyntaxKind.ModuleDeclaration:
                checkModule(body);
                break;
            case ts.SyntaxKind.ModuleBlock:
                checkBlock(body, isAutomaticExport(moduleDeclaration));
                break;
        }
    }
    function checkBlock(block, autoExportEnabled) {
        for (const s of block.statements) {
            // Compiler will error for 'declare' here anyway, so just check for 'export'.
            if (isExport(s) && autoExportEnabled && !isDefault(s)) {
                fail(mod(s, ts.SyntaxKind.ExportKeyword), "'export' keyword is redundant here because " +
                    "all declarations in this module are exported automatically. " +
                    "If you have a good reason to export some declarations and not others, " +
                    "add 'export {}' to the module to shut off automatic exporting.");
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
function isDefault(node) {
    return Lint.hasModifier(node.modifiers, ts.SyntaxKind.DefaultKeyword);
}
// tslint:disable-next-line:max-line-length
// Copied from https://github.com/Microsoft/TypeScript/blob/dd9b8cab34a3e389e924d768eb656cf50656f582/src/compiler/binder.ts#L1571-L1581
function hasExportDeclarations(node) {
    const body = node.kind === ts.SyntaxKind.SourceFile ? node : node.body;
    if (body && (body.kind === ts.SyntaxKind.SourceFile || body.kind === ts.SyntaxKind.ModuleBlock)) {
        for (const stat of body.statements) {
            if (stat.kind === ts.SyntaxKind.ExportDeclaration || stat.kind === ts.SyntaxKind.ExportAssignment) {
                return true;
            }
        }
    }
    return false;
}
function isAutomaticExport(node) {
    // We'd like to just test ts.NodeFlags.ExportContext, but we don't run the
    // binder, so that flag won't be set, so duplicate the logic instead. :(
    //
    // ts.NodeFlags.Ambient is @internal, but all modules that get here should
    // be ambient.
    return !hasExportDeclarations(node);
}
//# sourceMappingURL=strictExportDeclareModifiersRule.js.map