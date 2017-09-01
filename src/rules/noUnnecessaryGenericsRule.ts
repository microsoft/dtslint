import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-unnecessary-generics",
		description: "Forbids signatures using a generic parameter only once.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

	static FAILURE_STRING(typeParameter: string) {
		return failure(
			Rule.metadata.ruleName,
			`Type parameter ${typeParameter} is used only once.`);
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;
	sourceFile.forEachChild(function cb(node) {
		if (ts.isFunctionLike(node)) {
			checkSignature(node);
		}
		node.forEachChild(cb);
	});

	function checkSignature(sig: ts.SignatureDeclaration) {
		if (!sig.typeParameters) {
			return;
		}

		for (const tp of sig.typeParameters) {
			const typeParameter = tp.name.text;
			const soleUse = getSoleUse(sig, typeParameter);
			if (soleUse !== undefined) {
				ctx.addFailureAtNode(soleUse, Rule.FAILURE_STRING(typeParameter));
			}
		}
	}
}

function getSoleUse(sig: ts.SignatureDeclaration, typeParameter: string): ts.Identifier | undefined {
	const exit = {};
	let soleUse: ts.Identifier | undefined;

	try {
		for (const param of sig.parameters) {
			if (param.type) {
				recur(param.type);
			}
		}
		if (sig.type) {
			recur(sig.type);
		}
	} catch (err) {
		if (err === exit) {
			return undefined;
		}
		throw err;
	}

	return soleUse;

	function recur(node: ts.TypeNode) {
		if (ts.isIdentifier(node)) {
			if (node.text === typeParameter) {
				if (soleUse === undefined) {
					soleUse = node;
				} else {
					throw exit;
				}
			}
		} else {
			node.forEachChild(recur);
		}
	}
}
