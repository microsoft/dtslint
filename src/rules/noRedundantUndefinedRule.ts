import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-redundant-undefined",
		description: "Forbids optional parameters/properties to include an explicit `undefined` in their type.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function failureString(container: ts.Node): string {
	const desc = container.kind === ts.SyntaxKind.Parameter ? "Parameter" : "Property";
	return failure(
		Rule.metadata.ruleName,
		`${desc} is optional, so no need to specify \`undefined\` as a possible value.`);
}

function walk(ctx: Lint.WalkContext<void>): void {
	ctx.sourceFile.forEachChild(function recur(node) {
		if (node.kind === ts.SyntaxKind.UndefinedKeyword
			&& ts.isUnionTypeNode(node.parent!)
			&& isOptionalParent(node.parent!.parent!)) {
			ctx.addFailureAtNode(node, failureString(node.parent!.parent!));
		}
		node.forEachChild(recur);
	});
}

function isOptionalParent(node: ts.Node): boolean {
	switch (node.kind) {
		case ts.SyntaxKind.Parameter:
		case ts.SyntaxKind.PropertyDeclaration:
		case ts.SyntaxKind.PropertySignature:
			return (node as ts.ParameterDeclaration | ts.PropertyDeclaration).questionToken !== undefined;
		default:
			return false;
	}
}
