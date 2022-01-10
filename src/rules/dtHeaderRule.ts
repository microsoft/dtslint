import { renderExpected, validate } from "@definitelytyped/header-parser";
import * as cp from "child_process";
import { dtToNpmName, findDtsName } from "dts-critic";
import { readFileSync } from "fs";
import * as Lint from "tslint";
import * as ts from "typescript";
import { failure, isMainFile } from "../util";

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
    if (!isMainFile(sourceFile.fileName, /*allowNested*/ true)) {
        lookFor("// Type definitions for", "Header should only be in `index.d.ts` of the root.");
        lookFor("// TypeScript Version", "TypeScript version should be specified under header in `index.d.ts`.");
        lookFor("// Minimum TypeScript Version", "TypeScript version should be specified under header in `index.d.ts`.");
        return;
    }

    let message = "This link seems to be broken. There was an error trying to visit it.";
    const name = findDtsName(sourceFile.fileName);
    const npmName = dtToNpmName(name);
    const { stdout } = cp.spawnSync("npm", ["view", npmName, "homepage"], { encoding: "utf8" });
    const [homepage] = stdout.split(/\r?\n/, 1);
    if (homepage) {
        message += ` Did you mean ${homepage}?`;
    }
    for (const brokenLink of readFileSync("broken-links.txt", "utf8").split(/\r?\n/)) {
        if (brokenLink) {
            lookFor(brokenLink, message);
        }
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
