"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
const path_1 = require("path");
const Lint = require("tslint");
const util_1 = require("../util");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
    }
}
Rule.metadata = {
    ruleName: "dt-header",
    description: "Ensure consistency of DefinitelyTyped headers.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx) {
    const { sourceFile } = ctx;
    const { text } = sourceFile;
    if (!isMainFile(sourceFile.fileName)) {
        const lookFor = (search, explanation) => {
            const idx = text.indexOf(search);
            if (idx !== -1) {
                ctx.addFailureAt(idx, search.length, util_1.failure(Rule.metadata.ruleName, explanation));
            }
        };
        lookFor("// Type definitions for", "Header should only be in `index.d.ts` of the root.");
        lookFor("// TypeScript Version", "TypeScript version should be specified under header in `index.d.ts`.");
        return;
    }
    const error = definitelytyped_header_parser_1.validate(text);
    if (error) {
        ctx.addFailureAt(error.index, 1, util_1.failure(Rule.metadata.ruleName, `Error parsing header. Expected: ${definitelytyped_header_parser_1.renderExpected(error.expected)}.`));
    }
    // Don't recurse, we're done.
}
function isMainFile(fileName) {
    // Linter may be run with cwd of the package. We want `index.d.ts` but not `submodule/index.d.ts` to match.
    if (fileName === "index.d.ts") {
        return true;
    }
    if (path_1.basename(fileName) !== "index.d.ts") {
        return false;
    }
    let parent = path_1.dirname(fileName);
    // May be a directory for an older version, e.g. `v0`.
    // Note a types redirect `foo/ts3.1` should not have its own header.
    if (/^v\d+$/.test(path_1.basename(parent))) {
        parent = path_1.dirname(parent);
    }
    // Allow "types/foo/index.d.ts", not "types/foo/utils/index.d.ts"
    return path_1.basename(path_1.dirname(parent)) === "types";
}
//# sourceMappingURL=dtHeaderRule.js.map