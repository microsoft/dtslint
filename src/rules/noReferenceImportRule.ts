import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-reference-import",
		description: 'Don\'t <reference types="foo" /> if you import "foo" anyway.',
		rationale: "Removes unnecessary code.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static FAILURE_STRING(moduleReference: string): string {
		return `No need to reference ${moduleReference}, since it is imported anyway.`;
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
	}
}

class Walker extends Lint.RuleWalker {
	visitSourceFile(node: ts.SourceFile) {
		const imports = allImports(node);
		for (const ref of node.typeReferenceDirectives) {
			if (imports.has(ref.fileName)) {
				this.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING(ref.fileName));
			}
		}

		// Don't recurse; we're done.
	}
}

function allImports(sourceFile: ts.SourceFile): Set<string> {
	const imports = new Set<string>();

	function recur(node: ts.Node) {
		if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
			const ref = (node as ts.ImportEqualsDeclaration).moduleReference;
			if (ref.kind === ts.SyntaxKind.ExternalModuleReference) {
				if (ref.expression) {
					addImport(ref.expression);
				}
			}
		} else if (node.kind === ts.SyntaxKind.ImportDeclaration) {
			addImport((node as ts.ImportDeclaration).moduleSpecifier);
		} else {
			ts.forEachChild(node, recur);
		}
	}

	function addImport(moduleReference: ts.Expression) {
		if (moduleReference.kind === ts.SyntaxKind.StringLiteral) {
			imports.add((moduleReference as ts.StringLiteral).text);
		}
	}

	recur(sourceFile);

	return imports;
}
