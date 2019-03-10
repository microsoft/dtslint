import { renderExpected, validate } from "definitelytyped-header-parser";
import { basename, dirname } from "path";
import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "dt-header",
        description: "Ensure consistency of DefinitelyTyped headers.",
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
    const { text } = sourceFile;
    const lookFor = (search: string, explanation: string) => {
        const idx = text.indexOf(search);
        if (idx !== -1) {
            ctx.addFailureAt(idx, search.length, failure(Rule.metadata.ruleName, explanation));
        }
    };
    if (!isMainFile(sourceFile.fileName)) {
        lookFor("// Type definitions for", "Header should only be in `index.d.ts` of the root.");
        lookFor("// TypeScript Version", "TypeScript version should be specified under header in `index.d.ts`.");
        return;
    }

    lookFor("// Definitions by: My Self", "Author name should be your name, not the default.");
    const error = validate(text);
    if (error) {
        ctx.addFailureAt(error.index, 1, failure(
            Rule.metadata.ruleName,
            `Error parsing header. Expected: ${renderExpected(error.expected)}.`));
    }
    // Don't recurse, we're done.
}

function isMainFile(fileName: string) {
    // Linter may be run with cwd of the package. We want `index.d.ts` but not `submodule/index.d.ts` to match.
    if (fileName === "index.d.ts") {
        return true;
    }

    if (basename(fileName) !== "index.d.ts") {
        return false;
    }

    let parent = dirname(fileName);
    // May be a directory for an older version, e.g. `v0`.
    // Note a types redirect `foo/ts3.1` should not have its own header.
    if (/^v\d+$/.test(basename(parent))) {
        parent = dirname(parent);
    }

    // Allow "types/foo/index.d.ts", not "types/foo/utils/index.d.ts"
    return basename(dirname(parent)) === "types";
}
