import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-dead-reference",
        description: "Ensures that all `/// <reference>` comments go at the top of the file.",
        rationale: "style",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    static FAILURE_STRING = failure(
        Rule.metadata.ruleName,
        "`/// <reference>` directive must be at top of file to take effect.");

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    const { sourceFile: { statements, text } } = ctx;
    if (!statements.length) {
        return;
    }

    // 'm' flag makes it multiline, so `^` matches the beginning of any line.
    // 'g' flag lets us set rgx.lastIndex
    const rgx = /^\s*(\/\/\/ <reference)/mg;

    // Start search at the first statement. (`/// <reference>` before that is OK.)
    rgx.lastIndex = statements[0].getStart();

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const match = rgx.exec(text);
        if (match === null) {
            break;
        }

        const length = match[1].length;
        const start = match.index + match[0].length - length;
        ctx.addFailureAt(start, length, Rule.FAILURE_STRING);
    }
}
