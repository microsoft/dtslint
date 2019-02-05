import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-any-union",
        description: "Forbid a union to contain `any`",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "Including `any` in a union will override all other members of the union.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    ctx.sourceFile.forEachChild(function recur(node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword && ts.isUnionTypeNode(node.parent!)) {
            ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
        }
        node.forEachChild(recur);
    });
}
