import * as Lint from "tslint";
import * as util from "tsutils";
import * as ts from "typescript";

// Based on https://github.com/danvk/typings-checker

export class Rule extends Lint.Rules.TypedRule {
	/* tslint:disable:object-literal-sort-keys */
	static metadata: Lint.IRuleMetadata = {
		ruleName: "expect",
		description: "Asserts types with $ExpectType and presence of errors with $ExpectError.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
		requiresTypeInfo: true,
	};
	/* tslint:enable:object-literal-sort-keys */

	static FAILURE_STRING_DUPLICATE_ASSERTION = "This line has 2 $ExpectType assertions.";
	static FAILURE_STRING_ASSERTION_MISSING_NODE = "Can not match a node to this assertion.";
	static FAILURE_STRING_EXPECTED_ERROR = "Expected an error on this line, but found none.";

	static FAILURE_STRING(expectedType: string, actualType: string): string {
		return `Expected type to be:\n  ${expectedType}\ngot:\n  ${actualType}`;
	}

	applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, ctx => walk(ctx, program));
	}
}

function walk(ctx: Lint.WalkContext<void>, program: ts.Program): void {
	const { sourceFile } = ctx;
	const checker = program.getTypeChecker();
	// Don't care about emit errors.
	const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);

	if (sourceFile.isDeclarationFile || !/\$Expect(Type|Error)/.test(sourceFile.text)) {
		// Normal file.
		for (const diagnostic of diagnostics) {
			addDiagnosticFailure(diagnostic);
		}
		return;
	}

	const { errorLines, typeAssertions, duplicates } = parseAssertions(sourceFile);

	for (const line of duplicates) {
		addFailureAtLine(line, Rule.FAILURE_STRING_DUPLICATE_ASSERTION);
	}

	const seenDiagnosticsOnLine = new Set<number>();

	for (const diagnostic of diagnostics) {
		const line = lineOfPosition(diagnostic.start, sourceFile);
		seenDiagnosticsOnLine.add(line);
		if (!errorLines.has(line)) {
			addDiagnosticFailure(diagnostic);
		}
	}

	for (const line of errorLines) {
		if (!seenDiagnosticsOnLine.has(line)) {
			addFailureAtLine(line, Rule.FAILURE_STRING_EXPECTED_ERROR);
		}
	}

	const { unmetExpectations, unusedAssertions } = getExpectTypeFailures(sourceFile, typeAssertions, checker);
	for (const { node, expected, actual } of unmetExpectations) {
		ctx.addFailureAtNode(node, Rule.FAILURE_STRING(expected, actual));
	}
	for (const line of unusedAssertions) {
		addFailureAtLine(line, Rule.FAILURE_STRING_ASSERTION_MISSING_NODE);
	}

	function addDiagnosticFailure(diagnostic: ts.Diagnostic): void {
		if (diagnostic.file === sourceFile) {
			ctx.addFailureAt(diagnostic.start, diagnostic.length,
				"TypeScript compile error: " + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
		} else {
			ctx.addFailureAt(0, 0, `TypeScript compile error: ${diagnostic.file}: ${diagnostic.messageText}`);
		}
	}

	function addFailureAtLine(line: number, failure: string): void {
		const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
		let end = sourceFile.getPositionOfLineAndCharacter(line + 1, 0) - 1;
		if (sourceFile.text[end - 1] === "\r") {
			end--;
		}
		ctx.addFailure(start, end, failure);
	}
}

interface Assertions {
	/** Lines with an $ExpectError. */
	errorLines: Set<number>;
	/** Map from a line number to the expected type at that line. */
	typeAssertions: Map<number, string>;
	/** Lines with more than one assertion (these are errors). */
	duplicates: number[];
}

function parseAssertions(source: ts.SourceFile): Assertions {
	const scanner = ts.createScanner(
		ts.ScriptTarget.Latest, /*skipTrivia*/false, ts.LanguageVariant.Standard, source.text);
	const errorLines = new Set<number>();
	const typeAssertions = new Map<number, string>();
	const duplicates: number[] = [];

	let prevTokenPos = -1;
	const lineStarts = source.getLineStarts();
	let curLine = 0;

	const getLine = (pos: number) => {
		// advance curLine to be the line preceding 'pos'
		while (lineStarts[curLine + 1] <= pos) {
			curLine++;
		}
		const isFirstTokenOnLine = lineStarts[curLine] > prevTokenPos;
		// If this is the first token on the line, it applies to the next line.
		// Otherwise, it applies to the text to the left of it.
		return isFirstTokenOnLine ? curLine + 1 : curLine;
	};

	loop: while (true) {
		const token = scanner.scan();
		const pos = scanner.getTokenPos();
		switch (token) {
			case ts.SyntaxKind.EndOfFileToken:
				break loop;

			case ts.SyntaxKind.WhitespaceTrivia:
				continue loop;

			case ts.SyntaxKind.SingleLineCommentTrivia:
				const commentText = scanner.getTokenText();
				const match = commentText.match(/^\/\/ \$Expect((Type (.*))|Error)/);
				if (match) {
					const line = getLine(pos);
					if (match[1] === "Error") {
						if (errorLines.has(line)) {
							duplicates.push(line);
						}
						errorLines.add(line);
					} else {
						const expectedType = match[3];
						// Don't bother with the assertion if there are 2 assertions on 1 line. Just fail for the duplicate.
						if (typeAssertions.delete(line)) {
							duplicates.push(line);
						} else {
							typeAssertions.set(line, expectedType);
						}
					}
				}
				break;

			default:
				prevTokenPos = pos;
				break;
		}
	}

	return { errorLines, typeAssertions, duplicates };
}

interface ExpectTypeFailures {
	/** Lines with an $ExpectType, but a different type was there. */
	unmetExpectations: Array<{ node: ts.Node, expected: string, actual: string }>;
	/** Lines with an $ExpectType, but no node could be found. */
	unusedAssertions: Iterable<number>;
}

function getExpectTypeFailures(
		sourceFile: ts.SourceFile,
		typeAssertions: Map<number, string>,
		checker: ts.TypeChecker,
		): ExpectTypeFailures {
	const unmetExpectations: Array<{ node: ts.Node, expected: string, actual: string }> = [];
	// Match assertions to the first node that appears on the line they apply to.
	ts.forEachChild(sourceFile, iterate);
	return { unmetExpectations, unusedAssertions: typeAssertions.keys() };

	function iterate(node: ts.Node): void {
		const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
		const expected = typeAssertions.get(line);
		if (expected !== undefined) {
			// https://github.com/Microsoft/TypeScript/issues/14077
			if (util.isExpressionStatement(node)) {
				node = node.expression;
			}

			const type = checker.getTypeAtLocation(node);
			const actual = checker.typeToString(type, /*enclosingDeclaration*/ undefined, ts.TypeFormatFlags.NoTruncation);
			if (actual !== expected) {
				unmetExpectations.push({ node, expected, actual });
			}

			typeAssertions.delete(line);
		}

		ts.forEachChild(node, iterate);
	}
}

function lineOfPosition(pos: number, sourceFile: ts.SourceFile): number {
	return sourceFile.getLineAndCharacterOfPosition(pos).line;
}
