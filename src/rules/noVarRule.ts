import * as Lint from "tslint";
import * as ts from "typescript";

// TODO: pull request to update tslint's `no-var-keyword`

export class Rule extends Lint.Rules.AbstractRule {
	public static metadata: Lint.IRuleMetadata = {
		ruleName: "no-var",
		description: "Forbids 'var'.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: false,
	};

	public static FAILURE_STRING = "Do not use 'var'.";

	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	ts.forEachChild(ctx.sourceFile, function cb(node: ts.Node) {
		switch (node.kind) {
			case ts.SyntaxKind.VariableStatement:
				if (!Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword)
						&& !Lint.isBlockScopedVariable(node as ts.VariableStatement)
						// Global 'var' declaration OK.
						&& !(sourceFile.isDeclarationFile && !ts.isExternalModule(ctx.sourceFile) && node.parent === sourceFile)) {
					ctx.addFailureAtNode(node, Rule.FAILURE_STRING);
				}
				break;

			case ts.SyntaxKind.ForStatement:
			case ts.SyntaxKind.ForInStatement:
			case ts.SyntaxKind.ForOfStatement: {
				const { initializer } = node as ts.ForStatement | ts.ForInStatement | ts.ForOfStatement;
				if (initializer && initializer.kind === ts.SyntaxKind.VariableDeclarationList &&
						// tslint:disable-next-line no-bitwise
						!Lint.isNodeFlagSet(initializer, ts.NodeFlags.Let | ts.NodeFlags.Const)) {
					ctx.addFailureAtNode(initializer, Rule.FAILURE_STRING);
				}
				break;
			}
		}

		ts.forEachChild(node, cb);
	});
}
