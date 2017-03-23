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

		return this.applyWithFunction(sourceFile, ctx => walk(ctx, global.program));
	}
}

const FAILURE_STRING = "Test file should not use a relative import. " +
	"Use a global import as if this were a user of the package.";

function walk(ctx: Lint.WalkContext<void>, program: ts.Program): void {
	// See https://github.com/palantir/tslint/issues/1969
	const sourceFile = program.getSourceFile(ctx.sourceFile.fileName);
	const checker = program.getTypeChecker();

	for (const i of sourceFile.imports) {
		if (i.text.startsWith(".")) {
			const moduleSymbol = checker.getSymbolAtLocation(i);
			if (!moduleSymbol || !moduleSymbol.declarations) {
				continue;
			}

			for (const decl of moduleSymbol.declarations) {
				if (decl.kind === ts.SyntaxKind.SourceFile && (decl as ts.SourceFile).isDeclarationFile) {
					ctx.addFailureAtNode(i, FAILURE_STRING);
				}
			}
		}
	}
}

declare module "typescript" {
	interface SourceFile {
		imports: ts.StringLiteral[];
	}
}
