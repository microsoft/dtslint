import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-single-element-tuple-type",
        description: "Forbids `[T]`, which should be `T[]`.",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    const { sourceFile } = ctx;
    sourceFile.forEachChild(function cb(node) {
        if (ts.isTupleTypeNode(node) && (node.elements ?? (node as any).elementTypes).length === 1) {
            ctx.addFailureAtNode(node, failure(
                Rule.metadata.ruleName,
                "Type [T] is a single-element tuple type. You probably meant T[]."));
        }
        node.forEachChild(cb);
    });
}
