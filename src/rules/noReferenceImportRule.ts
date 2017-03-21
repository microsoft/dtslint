import * as Lint from "tslint";
// TODO: Remove when https://github.com/palantir/tslint/pull/2273 is in

import * as util from "tsutils";
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
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	const imports = allImports(sourceFile);
	for (const ref of sourceFile.typeReferenceDirectives) {
		if (imports.has(ref.fileName)) {
			ctx.addFailureAt(ref.pos, ref.end, Rule.FAILURE_STRING(ref.fileName));
		}
	}
}

function allImports(sourceFile: ts.SourceFile): Set<string> {
	const imports = new Set<string>();

	function recur(node: ts.Node): void {
		if (util.isImportEqualsDeclaration(node)) {
			const ref = node.moduleReference;
			if (ref.kind === ts.SyntaxKind.ExternalModuleReference) {
				if (ref.expression) {
					addImport(ref.expression);
				}
			}
		} else if (util.isImportDeclaration(node)) {
			addImport(node.moduleSpecifier);
		} else {
			ts.forEachChild(node, recur);
		}
	}

	function addImport(moduleReference: ts.Expression): void {
		if (util.isStringLiteral(moduleReference)) {
			imports.add(moduleReference.text);
		}
	}

	recur(sourceFile);

	return imports;
}
