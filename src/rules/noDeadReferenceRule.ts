import * as Lint from "tslint";
import * as ts from "typescript";

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

	static FAILURE_STRING = "`/// <reference>` directive must be at top of file to take effect.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		const text = node.getFullText();
		if (!node.statements.length) {
			return;
		}
		const firstStatement = node.statements[0];

		// 'm' flag makes it multiline, so `^` matches the beginning of any line.
		// 'g' flag lets us set rgx.lastIndex
		const rgx = /^\s*\/\/\/ <reference/mg;
		// Start search at the first statement. (`/// <reference>` before that is OK.)
		rgx.lastIndex = firstStatement.getStart();
		const match = rgx.exec(text);
		if (match === null) {
			return;
		}

		this.addFailureAt(match.index, 0, Rule.FAILURE_STRING);

		// Don't recurse; we're done.
	}
}
