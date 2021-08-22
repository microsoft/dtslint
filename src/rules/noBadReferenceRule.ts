import * as path from "path";
import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-bad-reference",
        description: 'Forbid <reference path="../etc"/> in any file, and forbid <reference path> in test files.',
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "Don't use <reference path> to reference another package. Use an import or <reference types> instead.");
    static FAILURE_STRING_REFERENCE_IN_TEST = failure(
        Rule.metadata.ruleName,
        "Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    const { sourceFile } = ctx;
    for (const ref of sourceFile.referencedFiles) {
        if (sourceFile.isDeclarationFile) {
            const dirPath = path.dirname(sourceFile.fileName);
            if (path.normalize(ref.fileName).startsWith(/^ts\d+\.\d$/.test(path.basename(dirPath)) ? "../.." : "..")) {
                ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING);
            }
        } else {
            ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
        }
    }
}
