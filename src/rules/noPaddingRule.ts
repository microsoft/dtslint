import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-padding",
		description: "Forbids unnecessary 'export' or 'declare' modifiers in declaration files.",
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
	ts.forEachChild(sourceFile, function cb(node: ts.Node): void {
		const children = node.getChildren();
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			switch (child.kind) {
				case ts.SyntaxKind.OpenParenToken:
				case ts.SyntaxKind.OpenBracketToken:
				case ts.SyntaxKind.OpenBraceToken:
					if (blankLineInBetween(child.getEnd(), children[i + 1].getStart())) {
						fail("after");
					}
					break;

				case ts.SyntaxKind.CloseParenToken:
				case ts.SyntaxKind.CloseBracketToken:
				case ts.SyntaxKind.CloseBraceToken:
					if (blankLineInBetween(child.getStart() - 1, children[i - 1].getEnd() - 1)) {
						fail("before");
					}
					break;

				default:
					cb(child);
			}

			function fail(kind: "before" | "after"): void {
				ctx.addFailureAtNode(child, `Don't leave a blank line ${kind} '${ts.tokenToString(child.kind)}'`);
			}
		}
	});

	// Looks for two newlines (with nothing else in between besides whitespace)
	function blankLineInBetween(start: number, end: number): boolean {
		const step = start < end ? 1 : -1;
		let seenLine = false;
		for (let i = start; i !== end; i += step) {
			switch (sourceFile.text[i]) {
				case "\n":
					if (seenLine) {
						return true;
					} else {
						seenLine = true;
					}
					break;

				case " ": case "\t": case "\r":
					break;

				default:
					return false;
			}
		}

		return false;
	}
}
