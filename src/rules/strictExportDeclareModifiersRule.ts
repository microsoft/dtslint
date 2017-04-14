import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "strict-export-declare-modifiers",
		description: "Enforces strict rules about where the 'export' and 'declare' modifiers may appear.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	const isExternal = sourceFile.isDeclarationFile
		&& !sourceFile.statements.some(s => s.kind === ts.SyntaxKind.ExportAssignment)
		&& ts.isExternalModule(sourceFile);

	for (const node of sourceFile.statements) {
		if (isExternal) {
			checkInExternalModule(node);
		} else {
			checkInOther(node);
		}

		if (isModuleDeclaration(node) && (sourceFile.isDeclarationFile || isDeclare(node))) {
			checkModule(node);
		}
	}

	function checkInExternalModule(node: ts.Statement) {
		// Ignore certain node kinds (these can't have 'export' or 'default' modifiers)
		switch (node.kind) {
			case ts.SyntaxKind.ImportDeclaration:
			case ts.SyntaxKind.ImportEqualsDeclaration:
			case ts.SyntaxKind.ExportDeclaration:
			case ts.SyntaxKind.NamespaceExportDeclaration:
				return;
		}

		// `declare global` and `declare module "foo"` OK. `declare namespace N` not OK, should be `export namespace`.
		if (!isDeclareGlobalOrExternalModuleDeclaration(node)) {
			if (isDeclare(node)) {
				ctx.addFailureAtNode(mod(node, ts.SyntaxKind.DeclareKeyword), isExport(node)
					? "'export declare' is redundant, just use 'export'."
					: "Prefer 'export' to 'declare' in an external module.");
			} else if (!isExport(node)) {
				ctx.addFailureAtNode(
					(node as ts.DeclarationStatement).name || node,
					"Prefer to explicitly write 'export' for an external module export.");
			}
		}
	}

	function checkInOther(node: ts.Statement): void {
		// Compiler will enforce presence of 'declare' where necessary. But types do not need 'declare'.
		if (isDeclare(node)) {
			switch (node.kind) {
				case ts.SyntaxKind.InterfaceDeclaration:
				case ts.SyntaxKind.TypeAliasDeclaration:
					ctx.addFailureAtNode(mod(node, ts.SyntaxKind.DeclareKeyword), "'declare' keyword is redundant here.");
			}
		}
	}

	function mod(node: ts.Statement, kind: ts.SyntaxKind): ts.Node {
		return node.modifiers!.find(m => m.kind === kind)!;
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
				ctx.addFailureAtNode(mod(s, ts.SyntaxKind.ExportKeyword), "'export' keyword is redundant here.");
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
