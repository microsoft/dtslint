"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const Lint = require("tslint");
const TsType = require("typescript");
const util_1 = require("../util");
// Based on https://github.com/danvk/typings-checker
class Rule extends Lint.Rules.TypedRule {
    static FAILURE_STRING(expectedType, actualType) {
        return `Expected type to be:\n  ${expectedType}\ngot:\n  ${actualType}`;
    }
    applyWithProgram(sourceFile, lintProgram) {
        const options = this.ruleArguments[0];
        if (!options) {
            return this.applyWithFunction(sourceFile, ctx => walk(ctx, lintProgram, TsType, "next", /*nextHigherVersion*/ undefined));
        }
        const { tsconfigPath, versionsToTest } = options;
        const getFailures = ({ versionName, path }, nextHigherVersion) => {
            const ts = require(path);
            const program = getProgram(tsconfigPath, ts, versionName, lintProgram);
            return this.applyWithFunction(sourceFile, ctx => walk(ctx, program, ts, versionName, nextHigherVersion));
        };
        const maxFailures = getFailures(util_1.last(versionsToTest), undefined);
        if (maxFailures.length) {
            return maxFailures;
        }
        // As an optimization, check the earliest version for errors;
        // assume that if it works on min and max, it works for everything in between.
        const minFailures = getFailures(versionsToTest[0], undefined);
        if (!minFailures.length) {
            return [];
        }
        // There are no failures in the max version, but there are failures in the min version.
        // Work backward to find the newest version with failures.
        for (let i = versionsToTest.length - 2; i >= 0; i--) {
            const failures = getFailures(versionsToTest[i], options.versionsToTest[i + 1].versionName);
            if (failures.length) {
                return failures;
            }
        }
        throw new Error(); // unreachable -- at least the min version should have failures.
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
/* tslint:enable:object-literal-sort-keys */
Rule.FAILURE_STRING_DUPLICATE_ASSERTION = "This line has 2 $ExpectType assertions.";
Rule.FAILURE_STRING_ASSERTION_MISSING_NODE = "Can not match a node to this assertion.";
Rule.FAILURE_STRING_EXPECTED_ERROR = "Expected an error on this line, but found none.";
exports.Rule = Rule;
const programCache = new WeakMap();
/** Maps a tslint Program to one created with the version specified in `options`. */
function getProgram(configFile, ts, versionName, lintProgram) {
    let versionToProgram = programCache.get(lintProgram);
    if (versionToProgram === undefined) {
        versionToProgram = new Map();
        programCache.set(lintProgram, versionToProgram);
    }
    let newProgram = versionToProgram.get(versionName);
    if (newProgram === undefined) {
        newProgram = createProgram(configFile, ts);
        versionToProgram.set(versionName, newProgram);
    }
    return newProgram;
}
exports.getProgram = getProgram;
function createProgram(configFile, ts) {
    const projectDirectory = path_1.dirname(configFile);
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
    const parseConfigHost = {
        fileExists: fs_1.existsSync,
        readDirectory: ts.sys.readDirectory,
        readFile: file => fs_1.readFileSync(file, "utf8"),
        useCaseSensitiveFileNames: true,
    };
    const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, path_1.resolve(projectDirectory), { noEmit: true });
    const host = ts.createCompilerHost(parsed.options, true);
    return ts.createProgram(parsed.fileNames, parsed.options, host);
}
function walk(ctx, program, ts, versionName, nextHigherVersion) {
    const { fileName } = ctx.sourceFile;
    const sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
        ctx.addFailure(0, 0, `Program source files differ between TypeScript versions. This may be a dtslint bug.\n` +
            `Expected to find a file '${fileName}' present in ${TsType.version}, but did not find it in ts@${versionName}.`);
        return;
    }
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
    const seenDiagnosticsOnLine = new Set();
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
    const { unmetExpectations, unusedAssertions } = getExpectTypeFailures(sourceFile, typeAssertions, checker, ts);
    for (const { node, expected, actual } of unmetExpectations) {
        ctx.addFailureAtNode(node, Rule.FAILURE_STRING(expected, actual));
    }
    for (const line of unusedAssertions) {
        addFailureAtLine(line, Rule.FAILURE_STRING_ASSERTION_MISSING_NODE);
    }
    function addDiagnosticFailure(diagnostic) {
        const intro = getIntro();
        if (diagnostic.file === sourceFile) {
            const msg = `${intro}\n${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
            ctx.addFailureAt(diagnostic.start, diagnostic.length, msg);
        }
        else {
            ctx.addFailureAt(0, 0, `${intro}\n${fileName}${diagnostic.messageText}`);
        }
    }
    function getIntro() {
        if (nextHigherVersion === undefined) {
            return `TypeScript@${versionName} compile error: `;
        }
        else {
            const msg = `Compile error in typescript@${versionName} but not in typescript@${nextHigherVersion}.\n`;
            const explain = nextHigherVersion === "next"
                ? "TypeScript@next features not yet supported."
                : `Fix with a comment '// TypeScript Version: ${nextHigherVersion}' just under the header.`;
            return msg + explain;
        }
    }
    function addFailureAtLine(line, failure) {
        const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
        let end = start + sourceFile.text.split("\n")[line].length;
        if (sourceFile.text[end - 1] === "\r") {
            end--;
        }
        ctx.addFailure(start, end, `TypeScript@${versionName}: ${failure}`);
    }
}
function parseAssertions(sourceFile) {
    const errorLines = new Set();
    const typeAssertions = new Map();
    const duplicates = [];
    const { text } = sourceFile;
    const commentRegexp = /\/\/(.*)/g;
    const lineStarts = sourceFile.getLineStarts();
    let curLine = 0;
    while (true) {
        const commentMatch = commentRegexp.exec(text);
        if (commentMatch === null) {
            break;
        }
        // Match on the contents of that comment so we do nothing in a commented-out assertion,
        // i.e. `// foo; // $ExpectType number`
        const match = /^ \$Expect((Type (.*))|Error)$/.exec(commentMatch[1]);
        if (match === null) {
            continue;
        }
        const line = getLine(commentMatch.index);
        if (match[1] === "Error") {
            if (errorLines.has(line)) {
                duplicates.push(line);
            }
            errorLines.add(line);
        }
        else {
            const expectedType = match[3];
            // Don't bother with the assertion if there are 2 assertions on 1 line. Just fail for the duplicate.
            if (typeAssertions.delete(line)) {
                duplicates.push(line);
            }
            else {
                typeAssertions.set(line, expectedType);
            }
        }
    }
    return { errorLines, typeAssertions, duplicates };
    function getLine(pos) {
        // advance curLine to be the line preceding 'pos'
        while (lineStarts[curLine + 1] <= pos) {
            curLine++;
        }
        // If this is the first token on the line, it applies to the next line.
        // Otherwise, it applies to the text to the left of it.
        return isFirstOnLine(text, lineStarts[curLine], pos) ? curLine + 1 : curLine;
    }
}
function isFirstOnLine(text, lineStart, pos) {
    for (let i = lineStart; i < pos; i++) {
        if (text[i] !== " ") {
            return false;
        }
    }
    return true;
}
function getExpectTypeFailures(sourceFile, typeAssertions, checker, ts) {
    const unmetExpectations = [];
    // Match assertions to the first node that appears on the line they apply to.
    // `forEachChild` isn't available as a method in older TypeScript versions, so must use `ts.forEachChild` instead.
    ts.forEachChild(sourceFile, function iterate(node) {
        const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
        const expected = typeAssertions.get(line);
        if (expected !== undefined) {
            // https://github.com/Microsoft/TypeScript/issues/14077
            if (node.kind === ts.SyntaxKind.ExpressionStatement) {
                node = node.expression;
            }
            const type = checker.getTypeAtLocation(getNodeForExpectType(node, ts));
            const actual = type
                ? checker.typeToString(type, /*enclosingDeclaration*/ undefined, ts.TypeFormatFlags.NoTruncation)
                : "";
            if (actual !== expected) {
                unmetExpectations.push({ node, expected, actual });
            }
            typeAssertions.delete(line);
        }
        ts.forEachChild(node, iterate);
    });
    return { unmetExpectations, unusedAssertions: typeAssertions.keys() };
}
function getNodeForExpectType(node, ts) {
    if (node.kind === ts.SyntaxKind.VariableStatement) { // ts2.0 doesn't have `isVariableStatement`
        const { declarationList: { declarations } } = node;
        if (declarations.length === 1) {
            const { initializer } = declarations[0];
            if (initializer) {
                return initializer;
            }
        }
    }
    return node;
}
function lineOfPosition(pos, sourceFile) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line;
}
//# sourceMappingURL=expectRule.js.map