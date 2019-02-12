import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "void-return",
        description: "`void` may only be used as a return type.",
        rationale: "style",
        optionsDescription: "Not configurable.",
        options: null,
        type: "style",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "Use the `void` type for return types only. Otherwise, use `undefined`.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    ctx.sourceFile.forEachChild(function cb(node) {
        if (node.kind === ts.SyntaxKind.VoidKeyword && !mayContainVoid(node.parent!) && !isReturnType(node)) {
            ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
        } else {
            node.forEachChild(cb);
        }
    });
}

function mayContainVoid({ kind }: ts.Node): boolean {
    switch (kind) {
        case ts.SyntaxKind.TypeReference:
        case ts.SyntaxKind.ExpressionWithTypeArguments:
        case ts.SyntaxKind.NewExpression:
        case ts.SyntaxKind.CallExpression:
        case ts.SyntaxKind.TypeParameter: // Allow f<T = void>
            return true;
        default:
            return false;
    }
}

function isReturnType(node: ts.Node): boolean {
    let parent = node.parent!;
    if (parent.kind === ts.SyntaxKind.UnionType) {
        [node, parent] = [parent, parent.parent!];
    }
    return isSignatureDeclaration(parent) && parent.type === node;
}

function isSignatureDeclaration(node: ts.Node): node is ts.SignatureDeclaration {
    switch (node.kind) {
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.CallSignature:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionType:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature:
            return true;
        default:
            return false;
    }
}
