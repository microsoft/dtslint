import * as Lint from "tslint";
import * as ts from "typescript";

// Same functionality as https://github.com/palantir/tslint/pull/1654, but simpler implementation.
// Remove when that PR is in.

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-useless-files",
		description: "Forbids files with no content.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: false,
	};

	static FAILURE_STRING = "File has no content.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		if (sourceFile.statements.length) {
			return [];
		}

		return [new Lint.RuleFailure(sourceFile, 0, 1, Rule.FAILURE_STRING, this.ruleName)];
	}
}
