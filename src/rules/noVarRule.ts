import * as Lint from "tslint";
import * as ts from "typescript";

// TODO: pull request to update tslint's `no-var-keyword`

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-var",
		description: "Forbids 'var'.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: false,
	};

	static FAILURE_STRING = "Do not use 'var'.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
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
						&& !(node.parent!.kind === ts.SyntaxKind.ModuleBlock && isDeclareGlobal(node.parent!.parent!))
						&& !(node.parent === sourceFile && !ts.isExternalModule(sourceFile) && sourceFile.isDeclarationFile)) {
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

function isDeclareGlobal(node: ts.Node) {
	return isModuleDeclaration(node) && node.name.kind === ts.SyntaxKind.Identifier && node.name.text === "global";
}

function isModuleDeclaration(node: ts.Node): node is ts.ModuleDeclaration {
	return node.kind === ts.SyntaxKind.ModuleDeclaration;
}
