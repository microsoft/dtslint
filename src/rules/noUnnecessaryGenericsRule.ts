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

	static FAILURE_STRING_NEVER(typeParameter: string) {
		return failure(
			Rule.metadata.ruleName,
			`Type parameter ${typeParameter} is never used.`);
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
			const res = getSoleUse(sig, typeParameter);
			switch (res.type) {
				case "ok":
					break;
				case "sole":
					ctx.addFailureAtNode(res.soleUse, Rule.FAILURE_STRING(typeParameter));
					break;
				case "never":
					ctx.addFailureAtNode(tp, Rule.FAILURE_STRING_NEVER(typeParameter));
					break;
				default:
					assertNever(res);
			}
		}
	}
}

type Result =
	| { type: "ok" | "never" }
	| { type: "sole", soleUse: ts.Identifier };
function getSoleUse(sig: ts.SignatureDeclaration, typeParameter: string): Result {
	const exit = {};
	let soleUse: ts.Identifier | undefined;

	try {
		if (sig.typeParameters) {
			for (const tp of sig.typeParameters) {
				if (tp.constraint) {
					recur(tp.constraint);
				}
			}
		}
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
			return { type: "ok" };
		}
		throw err;
	}

	return soleUse ? { type: "sole", soleUse } : { type: "never" };

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

function assertNever(_: never) {
	throw new Error("unreachable");
}
