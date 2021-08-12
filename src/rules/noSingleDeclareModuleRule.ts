import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-single-declare-module",
        description: "Don't use an ambient module declaration if there's just one -- write it as a normal module.",
        rationale: "Cuts down on nesting",
        optionsDescription: "Not configurable.",
        options: null,
        type: "style",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "File has only 1 ambient module declaration. Move the contents outside the ambient module block, rename the file to match the ambient module name, and remove the block.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    const { sourceFile } = ctx;

    // If it's an external module, any module declarations inside are augmentations.
    if (ts.isExternalModule(sourceFile)) {
        return;
    }

    let moduleDecl: ts.ModuleDeclaration | undefined;
    for (const statement of sourceFile.statements) {
        if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
            if (statement.name.text.indexOf('*') !== -1) {
                // Ignore wildcard module declarations
                return;
            }

            if (moduleDecl === undefined) {
                moduleDecl = statement;
            } else {
                // Has more than 1 declaration
                return;
            }
        }
    }

    if (moduleDecl) {
        ctx.addFailureAtNode(moduleDecl, Rule.FAILURE_STRING);
    }
}
