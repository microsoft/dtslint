"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const Lint = require("tslint");
const definitelytyped_header_parser_1 = require("definitelytyped-header-parser");
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
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
class Walker extends Lint.RuleWalker {
    visitSourceFile(node) {
        const text = node.getFullText();
        if (!isMainFile(node.fileName)) {
            if (text.startsWith("// Type definitions for")) {
                this.addFailureAt(0, 1, "Header should only be in `index.d.ts`.");
            }
            return;
        }
        const error = definitelytyped_header_parser_1.validate(text);
        if (error) {
            this.addFailureAt(error.index, 1, `Error parsing header. Expected: ${definitelytyped_header_parser_1.renderExpected(error.expected)}`);
        }
        // Don't recurse, we're done.
    }
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
    if (/^v\d+$/.test(path_1.basename(parent))) {
        parent = path_1.dirname(parent);
    }
    return path_1.basename(path_1.dirname(parent)) === "DefinitelyTyped";
}
//# sourceMappingURL=dtHeaderRule.js.map