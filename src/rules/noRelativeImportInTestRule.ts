import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.TypedRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-relative-import-in-test",
		description: "Forbids test (non-declaration) files to use relative imports.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: false,
	};

	applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
		if (sourceFile.isDeclarationFile) {
			return [];
		}

		return this.applyWithFunction(sourceFile, ctx => walk(ctx, program.getTypeChecker()));
	}
}

const FAILURE_STRING = failure(
	Rule.metadata.ruleName,
	"Test file should not use a relative import. Use a global import as if this were a user of the package.");

function walk(ctx: Lint.WalkContext<void>, checker: ts.TypeChecker): void {
	const { sourceFile } = ctx;

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
		imports: ReadonlyArray<ts.StringLiteral>;
	}
}
