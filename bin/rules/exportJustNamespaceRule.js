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
    ruleName: "export-just-namespace",
    description: "Forbid to `export = foo` where `foo` is a namespace and isn't merged with a function/class/type/interface.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = util_1.failure(Rule.metadata.ruleName, "Instead of `export =`-ing a namespace, use the body of the namespace as the module body.");
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile: { statements } } = ctx;
    const exportEqualsNode = statements.find(isExportEquals);
    if (!exportEqualsNode) {
        return;
    }
    const expr = exportEqualsNode.expression;
    if (!ts.isIdentifier(expr)) {
        return;
    }
    const exportEqualsName = expr.text;
    if (exportEqualsName && isJustNamespace(statements, exportEqualsName)) {
        ctx.addFailureAtNode(exportEqualsNode, Rule.FAILURE_STRING);
    }
}
function isExportEquals(node) {
    return ts.isExportAssignment(node) && !!node.isExportEquals;
}
/** Returns true if there is a namespace but there are no functions/classes with the name. */
function isJustNamespace(statements, exportEqualsName) {
    let anyNamespace = false;
    for (const statement of statements) {
        switch (statement.kind) {
            case ts.SyntaxKind.ModuleDeclaration:
                anyNamespace = anyNamespace || nameMatches(statement.name);
                break;
            case ts.SyntaxKind.VariableStatement:
                if (statement.declarationList.declarations.some(d => nameMatches(d.name))) {
                    // OK. It's merged with a variable.
                    return false;
                }
                break;
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
                if (nameMatches(statement.name)) {
                    // OK. It's merged with a function/class/type/interface.
                    return false;
                }
                break;
            default:
        }
    }
    return anyNamespace;
    function nameMatches(nameNode) {
        return nameNode !== undefined && ts.isIdentifier(nameNode) && nameNode.text === exportEqualsName;
    }
}
/*
Tests:

OK:
    export = foo;
    declare namespace foo {}
    declare function foo(): void; // or interface, type, class

Error:
    export = foo;
    declare namespace foo {}

OK: (it's assumed to come from elsewhere)
    export = foo;
*/
//# sourceMappingURL=exportJustNamespaceRule.js.map