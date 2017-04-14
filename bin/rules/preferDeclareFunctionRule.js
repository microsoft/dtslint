"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "prefer-declare-function",
    description: "Forbids `export const x = () => void`.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
Rule.FAILURE_STRING = "Use a function declaration instead of a variable of function type.";
exports.Rule = Rule;
function walk(ctx) {
    eachModuleStatement(ctx.sourceFile, statement => {
        if (isVariableStatement(statement)) {
            for (const varDecl of statement.declarationList.declarations) {
                if (varDecl.type !== undefined && varDecl.type.kind === ts.SyntaxKind.FunctionType) {
                    ctx.addFailureAtNode(varDecl, Rule.FAILURE_STRING);
                }
            }
        }
    });
}
function isVariableStatement(node) {
    return node.kind === ts.SyntaxKind.VariableStatement;
}
function eachModuleStatement(sourceFile, action) {
    if (!sourceFile.isDeclarationFile) {
        return;
    }
    for (const node of sourceFile.statements) {
        if (isModuleDeclaration(node)) {
            let { body } = node;
            if (!body) {
                return;
            }
            while (body.kind === ts.SyntaxKind.ModuleDeclaration) {
                body = body.body;
            }
            if (body.kind === ts.SyntaxKind.ModuleBlock) {
                for (const statement of body.statements) {
                    action(statement);
                }
            }
        }
        else {
            action(node);
        }
    }
}
function isModuleDeclaration(node) {
    return node.kind === ts.SyntaxKind.ModuleDeclaration;
}
//# sourceMappingURL=preferDeclareFunctionRule.js.map