import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import os = require("os");
import { basename, dirname, join, resolve as resolvePath } from "path";
import * as Lint from "tslint";
import * as TsType from "typescript";
import { last } from "../util";

type Program = TsType.Program;
type SourceFile = TsType.SourceFile;

// Based on https://github.com/danvk/typings-checker

const perfDir = join(os.homedir(), ".dts", "perf");

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

    static FAILURE_STRING(expectedVersion: string, expectedType: string, actualType: string): string {
        return `TypeScript@${expectedVersion} expected type to be:\n  ${expectedType}\ngot:\n  ${actualType}`;
    }

    applyWithProgram(sourceFile: SourceFile, lintProgram: Program): Lint.RuleFailure[] {
        const options = this.ruleArguments[0] as Options | undefined;
        if (!options) {
            return this.applyWithFunction(sourceFile, ctx =>
                walk(ctx, lintProgram, TsType, "next", /*nextHigherVersion*/ undefined));
        }

        const { tsconfigPath, versionsToTest } = options;

        const getFailures = (
            { versionName, path }: VersionToTest,
            nextHigherVersion: string | undefined,
            writeOutput: boolean,
        ) => {
            const ts = require(path);
            const program = getProgram(tsconfigPath, ts, versionName, lintProgram);
            const failures = this.applyWithFunction(sourceFile, ctx => walk(ctx, program, ts, versionName, nextHigherVersion));
            if (writeOutput) {
                const packageName = basename(dirname(tsconfigPath));
                if (!packageName.match(/v\d+/) && !packageName.match(/ts\d\.\d/)) {
                    const d = {
                        [packageName]: {
                            typeCount: (program as any).getTypeCount(),
                            memory: ts.sys.getMemoryUsage ? ts.sys.getMemoryUsage() : 0,
                        },
                    };
                    if (!existsSync(perfDir)) {
                        mkdirSync(perfDir);
                    }
                    writeFileSync(join(perfDir, `${packageName}.json`), JSON.stringify(d));
                }
            }
            return failures;
        };

        const maxFailures = getFailures(last(versionsToTest), undefined, /*writeOutput*/ true);
        if (maxFailures.length) {
            return maxFailures;
        }

        // As an optimization, check the earliest version for errors;
        // assume that if it works on min and max, it works for everything in between.
        const minFailures = getFailures(versionsToTest[0], undefined, /*writeOutput*/ false);
        if (!minFailures.length) {
            return [];
        }

        // There are no failures in the max version, but there are failures in the min version.
        // Work backward to find the newest version with failures.
        for (let i = versionsToTest.length - 2; i >= 0; i--) {
            const failures = getFailures(versionsToTest[i], options.versionsToTest[i + 1].versionName, /*writeOutput*/ false);
            if (failures.length) {
                return failures;
            }
        }

        throw new Error(); // unreachable -- at least the min version should have failures.
    }
}

export interface Options {
    readonly tsconfigPath: string;
    // These should be sorted with oldest first.
    readonly versionsToTest: ReadonlyArray<VersionToTest>;
}
export interface VersionToTest {
    readonly versionName: string;
    readonly path: string;
}

const programCache = new WeakMap<Program, Map<string, Program>>();
/** Maps a tslint Program to one created with the version specified in `options`. */
export function getProgram(configFile: string, ts: typeof TsType, versionName: string, lintProgram: Program): Program {
    let versionToProgram = programCache.get(lintProgram);
    if (versionToProgram === undefined) {
        versionToProgram = new Map<string, Program>();
        programCache.set(lintProgram, versionToProgram);
    }

    let newProgram = versionToProgram.get(versionName);
    if (newProgram === undefined) {
        newProgram = createProgram(configFile, ts);
        versionToProgram.set(versionName, newProgram);
    }
    return newProgram;
}

function createProgram(configFile: string, ts: typeof TsType): Program {
    const projectDirectory = dirname(configFile);
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
    const parseConfigHost: TsType.ParseConfigHost = {
        fileExists: existsSync,
        readDirectory: ts.sys.readDirectory,
        readFile: file => readFileSync(file, "utf8"),
        useCaseSensitiveFileNames: true,
    };
    const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, resolvePath(projectDirectory), {noEmit: true});
    const host = ts.createCompilerHost(parsed.options, true);
    return ts.createProgram(parsed.fileNames, parsed.options, host);
}

function walk(
        ctx: Lint.WalkContext<void>,
        program: Program,
        ts: typeof TsType,
        versionName: string,
        nextHigherVersion: string | undefined): void {
    const { fileName } = ctx.sourceFile;
    const sourceFile = program.getSourceFile(fileName)!;
    if (!sourceFile) {
        ctx.addFailure(0, 0,
            `Program source files differ between TypeScript versions. This may be a dtslint bug.\n` +
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

    const seenDiagnosticsOnLine = new Set<number>();

    for (const diagnostic of diagnostics) {
        const line = lineOfPosition(diagnostic.start!, sourceFile);
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
        ctx.addFailureAtNode(node, Rule.FAILURE_STRING(versionName, expected, actual));
    }
    for (const line of unusedAssertions) {
        addFailureAtLine(line, Rule.FAILURE_STRING_ASSERTION_MISSING_NODE);
    }

    function addDiagnosticFailure(diagnostic: TsType.Diagnostic): void {
        const intro = getIntro();
        if (diagnostic.file === sourceFile) {
            const msg = `${intro}\n${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
            ctx.addFailureAt(diagnostic.start!, diagnostic.length!, msg);
        } else {
            ctx.addFailureAt(0, 0, `${intro}\n${fileName}${diagnostic.messageText}`);
        }
    }

    function getIntro(): string {
        if (nextHigherVersion === undefined) {
            return `TypeScript@${versionName} compile error: `;
        } else {
            const msg = `Compile error in typescript@${versionName} but not in typescript@${nextHigherVersion}.\n`;
            const explain = nextHigherVersion === "next"
                ? "TypeScript@next features not yet supported."
                : `Fix with a comment '// TypeScript Version: ${nextHigherVersion}' just under the header.`;
            return msg + explain;
        }
    }

    function addFailureAtLine(line: number, failure: string): void {
        const start = sourceFile.getPositionOfLineAndCharacter(line, 0);
        let end = start + sourceFile.text.split("\n")[line].length;
        if (sourceFile.text[end - 1] === "\r") {
            end--;
        }
        ctx.addFailure(start, end, `TypeScript@${versionName}: ${failure}`);
    }
}

interface Assertions {
    /** Lines with an $ExpectError. */
    readonly errorLines: ReadonlySet<number>;
    /** Map from a line number to the expected type at that line. */
    readonly typeAssertions: Map<number, string>;
    /** Lines with more than one assertion (these are errors). */
    readonly duplicates: ReadonlyArray<number>;
}

function parseAssertions(sourceFile: SourceFile): Assertions {
    const errorLines = new Set<number>();
    const typeAssertions = new Map<number, string>();
    const duplicates: number[] = [];

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

    return { errorLines, typeAssertions, duplicates };

    function getLine(pos: number): number {
        // advance curLine to be the line preceding 'pos'
        while (lineStarts[curLine + 1] <= pos) {
            curLine++;
        }
        // If this is the first token on the line, it applies to the next line.
        // Otherwise, it applies to the text to the left of it.
        return isFirstOnLine(text, lineStarts[curLine], pos) ? curLine + 1 : curLine;
    }
}

function isFirstOnLine(text: string, lineStart: number, pos: number): boolean {
    for (let i = lineStart; i < pos; i++) {
        if (text[i] !== " ") {
            return false;
        }
    }
    return true;
}

interface ExpectTypeFailures {
    /** Lines with an $ExpectType, but a different type was there. */
    readonly unmetExpectations: ReadonlyArray<{ node: TsType.Node, expected: string, actual: string }>;
    /** Lines with an $ExpectType, but no node could be found. */
    readonly unusedAssertions: Iterable<number>;
}

function matchReadonlyArray(actual: string, expected: string) {
    if (!(/\breadonly\b/.test(actual) && /\bReadonlyArray\b/.test(expected))) return false;
    const readonlyArrayRegExp = /\bReadonlyArray</y;
    const readonlyModifierRegExp = /\breadonly /y;

    // A<ReadonlyArray<B<ReadonlyArray<C>>>>
    // A<readonly B<readonly C[]>[]>

    let expectedPos = 0;
    let actualPos = 0;
    let depth = 0;
    while (expectedPos < expected.length && actualPos < actual.length) {
        const expectedChar = expected.charAt(expectedPos);
        const actualChar = actual.charAt(actualPos);
        if (expectedChar === actualChar) {
            expectedPos++;
            actualPos++;
            continue;
        }

        // check for end of readonly array
        if (depth > 0 && expectedChar === ">" && actualChar === "[" && actualPos < actual.length - 1 &&
            actual.charAt(actualPos + 1) === "]") {
            depth--;
            expectedPos++;
            actualPos += 2;
            continue;
        }

        // check for start of readonly array
        readonlyArrayRegExp.lastIndex = expectedPos;
        readonlyModifierRegExp.lastIndex = actualPos;
        if (readonlyArrayRegExp.test(expected) && readonlyModifierRegExp.test(actual)) {
            depth++;
            expectedPos += 14; // "ReadonlyArray<".length;
            actualPos += 9; // "readonly ".length;
            continue;
        }

        return false;
    }

    return true;
}

function getExpectTypeFailures(
        sourceFile: SourceFile,
        typeAssertions: Map<number, string>,
        checker: TsType.TypeChecker,
        ts: typeof TsType,
        ): ExpectTypeFailures {
    const unmetExpectations: Array<{ node: TsType.Node, expected: string, actual: string }> = [];
    // Match assertions to the first node that appears on the line they apply to.
    // `forEachChild` isn't available as a method in older TypeScript versions, so must use `ts.forEachChild` instead.
    ts.forEachChild(sourceFile, function iterate(node) {
        const line = lineOfPosition(node.getStart(sourceFile), sourceFile);
        const expected = typeAssertions.get(line);
        if (expected !== undefined) {
            // https://github.com/Microsoft/TypeScript/issues/14077
            if (node.kind === ts.SyntaxKind.ExpressionStatement) {
                node = (node as TsType.ExpressionStatement).expression;
            }

            const type = checker.getTypeAtLocation(getNodeForExpectType(node, ts));

            const actual = type
                ? checker.typeToString(type, /*enclosingDeclaration*/ undefined, ts.TypeFormatFlags.NoTruncation)
                : "";

            if (actual !== expected && !matchReadonlyArray(actual, expected)) {
                unmetExpectations.push({ node, expected, actual });
            }

            typeAssertions.delete(line);
        }

        ts.forEachChild(node, iterate);
    });
    return { unmetExpectations, unusedAssertions: typeAssertions.keys() };
}

function getNodeForExpectType(node: TsType.Node, ts: typeof TsType): TsType.Node {
    if (node.kind === ts.SyntaxKind.VariableStatement) { // ts2.0 doesn't have `isVariableStatement`
        const { declarationList: { declarations } } = node as TsType.VariableStatement;
        if (declarations.length === 1) {
            const { initializer } = declarations[0];
            if (initializer) {
                return initializer;
            }
        }
    }
    return node;
}

function lineOfPosition(pos: number, sourceFile: SourceFile): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line;
}
