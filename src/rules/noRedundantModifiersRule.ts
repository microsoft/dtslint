import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-redundant-modifiers",
		description: "Forbids unnecessary 'export' or 'declare' modifiers in declaration files.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		if (!sourceFile.isDeclarationFile) {
			return [];
		}

		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	const isExportAssign = sourceFile.statements.some(s => s.kind === ts.SyntaxKind.ExportAssignment);

	for (const node of sourceFile.statements) {
		if (isDeclare(node)) {
			if (isExport(node)) {
				ctx.addFailureAtNode(node, "'export declare' is redundant, just use 'export'.");
			} else {
				if (ts.isExternalModule(sourceFile)) {
					if (!isExportAssign && !isDeclareGlobalOrExternalModuleDeclaration(node)) {
						ctx.addFailureAtNode(node, "Prefer 'export' to 'declare' in an external module.");
					}
				} else {
					// Types do not need 'declare'.
					switch (node.kind) {
						case ts.SyntaxKind.InterfaceDeclaration:
						case ts.SyntaxKind.TypeAliasDeclaration: {
							const { name } = node as ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
							ctx.addFailureAtNode(name, "'declare' keyword is redundant here.");
						}
					}
				}
			}
		}

		if (isModuleDeclaration(node)) {
			checkModule(node);
		}
	}

	function checkModule({ body }: ts.ModuleDeclaration): void {
		if (!body) {
			return;
		}

		switch (body.kind) {
			case ts.SyntaxKind.ModuleDeclaration:
				checkModule(body);
				break;
			case ts.SyntaxKind.ModuleBlock:
				checkBlock(body);
				break;
		}
	}

	function checkBlock(block: ts.ModuleBlock): void {
		for (const s of block.statements) {
			// Compiler will error for 'declare' here anyway, so just check for 'export'.
			if (isExport(s)) {
				ctx.addFailureAtNode(s, "'export' keyword is redundant here.");
			}

			if (isModuleDeclaration(s)) {
				checkModule(s);
			}
		}
	}
}

function isDeclareGlobalOrExternalModuleDeclaration(node: ts.Node): boolean {
	return isModuleDeclaration(node) && (
		node.name.kind === ts.SyntaxKind.StringLiteral ||
		node.name.kind === ts.SyntaxKind.Identifier && node.name.text === "global");
}

function isModuleDeclaration(node: ts.Node): node is ts.ModuleDeclaration {
	return node.kind === ts.SyntaxKind.ModuleDeclaration;
}

function isDeclare(node: ts.Node): boolean {
	return Lint.hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword);
}

function isExport(node: ts.Node): boolean {
	return Lint.hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword);
}
