import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-single-declare-module",
		description: "Don't use an ambient module declaration if you can use an external module file.",
		rationale: "Cuts down on nesting",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static FAILURE_STRING = "File has only 1 module declaration — write it as an external module.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;

	// If it's an external module, any module declarations inside are augmentations.
	if (ts.isExternalModule(sourceFile)) {
		return;
	}

	let moduleDecl: ts.ModuleDeclaration | undefined;
	for (const statement of sourceFile.statements) {
		if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
			if (moduleDecl === undefined) {
				moduleDecl = statement;
			} else {
				// Has more than 1 declaration
				return;
			}
		}
	}

	if (moduleDecl) {
		ctx.addFailureAtNode(moduleDecl, Rule.FAILURE_STRING);
	}
}
