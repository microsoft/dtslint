import {
    CheckOptions as CriticOptions,
    CriticError,
    dtsCritic as critic,
    ErrorKind,
    ExportErrorKind,
    Mode,
    NameOnlyOptions,
    parseExportErrorKind,
    parseMode } from "dts-critic";
import * as Lint from "tslint";
import * as ts from "typescript";

import { failure, isMainFile } from "../util";

type Options = CriticOptions & { singleLine?: boolean };

const defaultOptions: NameOnlyOptions = {
    mode: Mode.NameOnly,
};

export class Rule extends Lint.Rules.AbstractRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "npm-naming",
        description: "Ensure that package name and DefinitelyTyped header match npm package info.",
        optionsDescription: `An object with a \`mode\` property should be provided.
If \`mode\` is '${Mode.Code}', then option \`errors\` can be provided.
\`errors\` should be an array specifying which code checks should be enabled or disabled.`,
        options: {
            oneOf: [
                {
                    type: "object",
                    properties: {
                        "mode": {
                            type: "string",
                            enum: [Mode.NameOnly],
                        },
                        "single-line": {
                            description: "Whether to print error messages in a single line. Used for testing.",
                            type: "boolean",
                        },
                        "required": ["mode"],
                    },
                },
                {
                    type: "object",
                    properties: {
                        "mode": {
                            type: "string",
                            enum: [Mode.Code],
                        },
                        "errors": {
                            type: "array",
                            items: {
                                type: "array",
                                items: [
                                    {   description: "Name of the check.",
                                        type: "string",
                                        enum: [ErrorKind.NeedsExportEquals, ErrorKind.NoDefaultExport] as ExportErrorKind[],
                                    },
                                    {
                                        description: "Whether the check is enabled or disabled.",
                                        type: "boolean",
                                    },
                                ],
                                minItems: 2,
                                maxItems: 2,
                            },
                        },
                        "single-line": {
                            description: "Whether to print error messages in a single line. Used for testing.",
                            type: "boolean",
                        },
                        "required": ["mode"],
                    },
                },
            ],
        },
        optionExamples: [
            true,
            [true, { mode: Mode.NameOnly }],
            [true, { mode: Mode.Code, errors: [[ErrorKind.NeedsExportEquals, true], [ErrorKind.NoDefaultExport, false]] }],
        ],
        type: "functionality",
        typescriptOnly: true,
    };

    apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk, parseOptions(this.ruleArguments));
    }
}

function parseOptions(args: unknown[]): Options {
    if (args.length === 0) {
        return defaultOptions;
    }

    const arg = args[0] as { [prop: string]: unknown } | null | undefined;
    if (arg == null) {
        return defaultOptions;
    }

    if (!arg.mode || typeof arg.mode !== "string") {
        return defaultOptions;
    }

    const mode = parseMode(arg.mode);
    if (!mode) {
        return defaultOptions;
    }

    const singleLine = !!arg["single-line"];

    switch (mode) {
        case Mode.NameOnly:
            return { mode, singleLine };
        case Mode.Code:
            if (!arg.errors || !Array.isArray(arg.errors)) {
                return { mode, errors: new Map(), singleLine };
            }
            return { mode, errors: parseEnabledErrors(arg.errors), singleLine };
    }
}

function parseEnabledErrors(errors: unknown[]): Map<ExportErrorKind, boolean> {
    const enabledChecks = new Map<ExportErrorKind, boolean>();
    for (const tuple of errors) {
        if (Array.isArray(tuple)
            && tuple.length === 2
            && typeof tuple[0] === "string"
            && typeof tuple[1] === "boolean") {
            const error = parseExportErrorKind(tuple[0]);
            if (error) {
                enabledChecks.set(error, tuple[1]);
            }
        }
    }
    return enabledChecks;
}

function tslintDisableOption(error: ErrorKind): string {
    switch (error) {
        case ErrorKind.NoMatchingNpmPackage:
        case ErrorKind.NoMatchingNpmVersion:
        case ErrorKind.NonNpmHasMatchingPackage:
            return `false`;
        case ErrorKind.NoDefaultExport:
        case ErrorKind.NeedsExportEquals:
        case ErrorKind.JsSignatureNotInDts:
        case ErrorKind.JsPropertyNotInDts:
        case ErrorKind.DtsSignatureNotInJs:
        case ErrorKind.DtsPropertyNotInJs:
            return JSON.stringify([true, { mode: Mode.Code, errors: [[error, false]]}]);
    }
}

function errorMessage(error: CriticError, opts: Options): string {
    const message = error.message +
`\nIf you won't fix this error now or you think this error is wrong,
you can disable this check by adding the following options to your project's tslint.json file under "rules":

    "npm-naming": ${tslintDisableOption(error.kind)}
`;
    if (opts.singleLine) {
        return message.replace(/(\r\n|\n|\r|\t)/gm, " ");
    }

    return message;
}

function walk(ctx: Lint.WalkContext<Options>): void {
    const { sourceFile } = ctx;
    const { text } = sourceFile;
    const lookFor = (search: string, explanation: string) => {
        const idx = text.indexOf(search);
        if (idx !== -1) {
            ctx.addFailureAt(idx, search.length, failure(Rule.metadata.ruleName, explanation));
        }
    };
    if (isMainFile(sourceFile.fileName, /*allowNested*/ false)) {
        try {
            const errors = critic(sourceFile.fileName, /* sourcePath */ undefined, ctx.options);
            for (const error of errors) {
                switch (error.kind) {
                    case ErrorKind.NoMatchingNpmPackage:
                    case ErrorKind.NoMatchingNpmVersion:
                    case ErrorKind.NonNpmHasMatchingPackage:
                        lookFor("// Type definitions for", errorMessage(error, ctx.options));
                        break;
                    case ErrorKind.DtsPropertyNotInJs:
                    case ErrorKind.DtsSignatureNotInJs:
                    case ErrorKind.JsPropertyNotInDts:
                    case ErrorKind.JsSignatureNotInDts:
                    case ErrorKind.NeedsExportEquals:
                    case ErrorKind.NoDefaultExport:
                        if (error.position) {
                            ctx.addFailureAt(
                                error.position.start,
                                error.position.length,
                                failure(Rule.metadata.ruleName, errorMessage(error, ctx.options)));
                        } else {
                            ctx.addFailure(0, 1, failure(Rule.metadata.ruleName, errorMessage(error, ctx.options)));
                        }
                        break;
                }
            }

        } catch (e) {
            // We're ignoring exceptions.
        }
    }
    // Don't recur, we're done.
}
