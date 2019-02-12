import * as Lint from "tslint";
import * as ts from "typescript";

import { eachModuleStatement, failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "prefer-declare-function",
        description: "Forbids `export const x = () => void`.",
        optionsDescription: "Not configurable.",
        options: null,
        type: "style",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "Use a function declaration instead of a variable of function type.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    eachModuleStatement(ctx.sourceFile, statement => {
        if (ts.isVariableStatement(statement)) {
            for (const varDecl of statement.declarationList.declarations) {
                if (varDecl.type !== undefined && varDecl.type.kind === ts.SyntaxKind.FunctionType) {
                    ctx.addFailureAtNode(varDecl, Rule.FAILURE_STRING);
                }
            }
        }
    });
}
