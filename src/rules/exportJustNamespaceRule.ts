import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "export-just-namespace",
		description:
			"Forbid to `export = foo` where `foo` is a namespace and isn't merged with a function/class/type/interface.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static FAILURE_STRING = "Instead of `export =`-ing a namespace, use the body of the namespace as the module body.";

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		const exportEqualsNode = node.statements.find(isExportEquals) as ts.ExportAssignment | undefined;
		if (!exportEqualsNode) {
			return;
		}
		const expr = exportEqualsNode.expression;
		if (expr.kind !== ts.SyntaxKind.Identifier) {
			return;
		}
		const exportEqualsName = (expr as ts.Identifier).text;

		if (exportEqualsName && isJustNamespace(node.statements, exportEqualsName)) {
			this.addFailureAtNode(exportEqualsNode, Rule.FAILURE_STRING);
		}
	}
}

function isExportEquals(node: ts.Node): boolean {
	return node.kind === ts.SyntaxKind.ExportAssignment && !!(node as ts.ExportAssignment).isExportEquals;
}

/** Returns true if there is a namespace but there are no functions/classes with the name. */
function isJustNamespace(statements: ts.Statement[], exportEqualsName: string) {
	let anyNamespace = false;

	for (const statement of statements) {
		switch (statement.kind) {
			case ts.SyntaxKind.ModuleDeclaration:
				anyNamespace = anyNamespace || nameMatches((statement as ts.ModuleDeclaration).name);
				break;
			case ts.SyntaxKind.VariableStatement:
				if ((statement as ts.VariableStatement).declarationList.declarations.some(d => nameMatches(d.name))) {
					// OK. It's merged with a variable.
					return false;
				}
				break;
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.TypeAliasDeclaration:
			case ts.SyntaxKind.InterfaceDeclaration:
				if (nameMatches((statement as ts.DeclarationStatement).name)) {
					// OK. It's merged with a function/class/type/interface.
					return false;
				}
				break;
			default:
		}
	}

	return anyNamespace;

	function nameMatches(nameNode: ts.Node | undefined): boolean {
		return nameNode !== undefined &&
			nameNode.kind === ts.SyntaxKind.Identifier &&
			(nameNode as ts.Identifier).text === exportEqualsName;
	}
}

/*
Tests:

OK:
	export = foo;
	declare namespace foo {}
	declare function foo(): void; // or interface, type, class

Error:
	export = foo;
	declare namespace foo {}

OK: (it's assumed to come from elsewhere)
	export = foo;
*/
