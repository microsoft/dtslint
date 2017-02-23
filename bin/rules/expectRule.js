"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
// Based on https://github.com/danvk/typings-checker
// TODO: Want TypedRule, but currently it gives me a bad `program`.
class Rule extends Lint.Rules.AbstractRule {
    /* tslint:enable:object-literal-sort-keys */
    static FAILURE_STRING(expectedType, actualType) {
        return `Expected type to be '${expectedType}'; got '${actualType}'.`;
    }
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions(), global.program));
    }
}
/* tslint:disable:object-literal-sort-keys */
Rule.metadata = {
    ruleName: "expect",
    description: "Asserts types with $ExpectType and presence of errors with $ExpectError.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
    requiresTypeInfo: true,
};
Rule.FAILURE_STRING_DUPLICATE_ASSERTION = "This line has 2 $ExpectType assertions.";
Rule.FAILURE_STRING_ASSERTION_MISSING_NODE = "Can not match a node to this assertion.";
Rule.FAILURE_STRING_EXPECTED_ERROR = "Expected an error on this line, but found none.";
exports.Rule = Rule;
class Walker extends Lint.ProgramAwareRuleWalker {
    visitSourceFile(sourceFile) {
        // See https://github.com/palantir/tslint/issues/1969
        sourceFile = this.getProgram().getSourceFile(sourceFile.fileName);
        // Don't care about emit errors.
        const diagnostics = ts.getPreEmitDiagnostics(this.getProgram(), sourceFile);
        if (sourceFile.isDeclarationFile || !sourceFile.text.includes("$ExpectType")) {
            // Normal file.
            for (const diagnostic of diagnostics) {
                this.addDiagnosticFailure(sourceFile, diagnostic);
            }
        }
        else {
            this.checkExpects(sourceFile, diagnostics);
        }
    }
    addDiagnosticFailure(sourceFile, diagnostic) {
        if (diagnostic.file === sourceFile) {
            this.addFailureAt(diagnostic.start, diagnostic.length, "TypeScript compile error: " + ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        }
        else {
            this.addFailureAt(0, 0, `TypeScript compile error: ${diagnostic.file}: ${diagnostic.messageText}`);
        }
    }
    checkExpects(sourceFile, diagnostics) {
        const { errors, types } = this.parseAssertions(sourceFile);
        this.handleExpectError(sourceFile, errors, diagnostics);
        this.addExpectTypeFailures(sourceFile, types);
    }
    handleExpectError(sourceFile, errorLines, diagnostics) {
        for (const diagnostic of diagnostics) {
            const line = this.lineOfPosition(diagnostic.start);
            if (!errorLines.delete(line)) {
                this.addDiagnosticFailure(sourceFile, diagnostic);
            }
        }
        for (const line of errorLines) {
            this.addFailureAtLine(line, Rule.FAILURE_STRING_EXPECTED_ERROR);
        }
    }
    // Returns a map from a line number to the expected type at that line.
    parseAssertions(source) {
        const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false, ts.LanguageVariant.Standard, source.text);
        const errors = new Set();
        const types = new Map();
        let prevTokenPos = -1;
        const lineStarts = source.getLineStarts();
        let curLine = 0;
        const getLine = (pos) => {
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
                            if (errors.has(line)) {
                                this.addFailureAtLine(line, Rule.FAILURE_STRING_DUPLICATE_ASSERTION);
                            }
                            errors.add(line);
                        }
                        else {
                            const expectedType = match[3];
                            if (types.has(line)) {
                                this.addFailureAtLine(line, Rule.FAILURE_STRING_DUPLICATE_ASSERTION);
                            }
                            types.set(line, expectedType);
                        }
                    }
                    break;
                default:
                    prevTokenPos = pos;
                    break;
            }
        }
        return { errors, types };
    }
    addExpectTypeFailures(source, assertions) {
        const checker = this.getTypeChecker();
        // Match assertions to the first node that appears on the line they apply to.
        const iterate = (node) => {
            const line = this.lineOfPosition(node.getStart());
            const expectedType = assertions.get(line);
            if (expectedType !== undefined) {
                // https://github.com/Microsoft/TypeScript/issues/14077
                if (node.kind === ts.SyntaxKind.ExpressionStatement) {
                    node = node.expression;
                }
                const actualType = checker.typeToString(checker.getTypeAtLocation(node));
                if (actualType !== expectedType) {
                    this.addFailureAtNode(node, Rule.FAILURE_STRING(expectedType, actualType));
                }
                assertions.delete(line);
            }
            ts.forEachChild(node, iterate);
        };
        iterate(source);
        for (const line of assertions.keys()) {
            this.addFailureAtLine(line, Rule.FAILURE_STRING_ASSERTION_MISSING_NODE);
        }
    }
    lineOfPosition(pos) {
        return this.getSourceFile().getLineAndCharacterOfPosition(pos).line;
    }
    addFailureAtLine(line, failure) {
        const source = this.getSourceFile();
        const start = source.getPositionOfLineAndCharacter(line, 0);
        const end = source.getPositionOfLineAndCharacter(line + 1, 0);
        this.addFailureFromStartToEnd(start, end, failure);
    }
}
//# sourceMappingURL=expectRule.js.map