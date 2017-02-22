import { basename, dirname } from "path";
import * as Lint from "tslint";
import * as ts from "typescript";

import { renderExpected, validate } from "definitelytyped-header-parser";

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
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		const text = node.getFullText();

		if (!isMainFile(node.fileName)) {
			if (text.startsWith("// Type definitions for")) {
				this.addFailureAt(0, 1, "Header should only be in `index.d.ts`.");
			}
			return;
		}

		const error = validate(text);
		if (error) {
			this.addFailureAt(error.index, 1, `Error parsing header. Expected: ${renderExpected(error.expected)}`);
		}
		// Don't recurse, we're done.
	}
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
	if (/^v\d+$/.test(basename(parent))) {
		parent = dirname(parent);
	}

	return basename(dirname(parent)) === "DefinitelyTyped";
}
