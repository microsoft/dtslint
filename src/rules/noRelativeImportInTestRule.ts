import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	public static metadata: Lint.IRuleMetadata = {
		ruleName: "no-relative-import-in-test",
		description: "Forbids test (non-declaration) files to use relative imports.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: false,
	};

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		if (sourceFile.isDeclarationFile) {
			return [];
		}

		return this.applyWithFunction(sourceFile, walk);
	}
}

const FAILURE_STRING = "Test file should not use a relative import. " +
	"Use a global import as if this were a user of the package.";

function walk(ctx: Lint.WalkContext<void>): void {
	for (const i of ctx.sourceFile.imports) {
		if (i.text.startsWith(".")) {
			ctx.addFailureAtNode(i, FAILURE_STRING);
		}
	}
}

declare module "typescript" {
	interface SourceFile {
		imports: ts.StringLiteral[];
	}
}
