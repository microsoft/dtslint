import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-bad-reference",
		description: 'Forbid <reference path="../etc"/> in any file, and forbid <reference path> in test files.',
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static FAILURE_STRING =
		"Don't use <reference path> to reference another package. Use an import or <reference types> instead.";
	static FAILURE_STRING_REFERENCE_IN_TEST =
		"Don't use <reference path> in test files. Use <reference types> or include the file in 'tsconfig.json'";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	for (const ref of sourceFile.referencedFiles) {
		if (sourceFile.isDeclarationFile) {
			if (ref.fileName.startsWith("..")) {
				ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING);
			}
		} else {
			ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
		}
	}
}
