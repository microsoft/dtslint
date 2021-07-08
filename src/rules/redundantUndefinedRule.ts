import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "redundant-undefined",
        description: "Forbids optional parameters to include an explicit `undefined` in their type; requires it in optional properties.",
        optionsDescription: "Not configurable.",
        options: null,
        type: "style",
        typescriptOnly: true,
    };

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    if (ctx.sourceFile.fileName.includes('node_modules')) return;
    ctx.sourceFile.forEachChild(function recur(node) {
        if (node.kind === ts.SyntaxKind.UndefinedKeyword
            && ts.isUnionTypeNode(node.parent!)
            && isOptionalParameter(node.parent!.parent!)) {
            ctx.addFailureAtNode(
                node,
                failure(
                    Rule.metadata.ruleName,
                    `Parameter is optional, so no need to include \`undefined\` in the type.`));
        }
        node.forEachChild(recur);
    });
}

function isOptionalParameter(node: ts.Node): boolean {
    return node.kind === ts.SyntaxKind.Parameter
        && (node as ts.ParameterDeclaration).questionToken !== undefined;
}
