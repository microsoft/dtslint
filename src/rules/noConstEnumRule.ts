import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-const-enum",
        description: "Forbid `const enum`",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "Use of `const enum`s is forbidden.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    ctx.sourceFile.forEachChild(function recur(node) {
        if (ts.isEnumDeclaration(node) && node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ConstKeyword)) {
            ctx.addFailureAtNode(node.name, Rule.FAILURE_STRING);
        }
        node.forEachChild(recur);
    });
}
