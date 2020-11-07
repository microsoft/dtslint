import {
    CheckOptions as CriticOptions,
    CriticError,
    defaultErrors,
    dtsCritic as critic,
    ErrorKind,
    ExportErrorKind,
    Mode,
} from "dts-critic";
import { Linter, Rule as ESLintRule } from "eslint";
import * as ESTree from 'estree';

import { addSuggestion } from "../suggestions";
import { failure, isMainFile } from "../util";

/** Options as parsed from the rule configuration. */
type ConfigOptions = Linter.RuleEntry<[{
    mode: Mode.NameOnly,
    singleLine?: boolean,
} | {
    mode: Mode.Code,
    errors: Array<[ExportErrorKind, boolean]>,
    singleLine?: boolean,
}]>;

type Options = CriticOptions & { singleLine?: boolean };

const defaultOptions: ConfigOptions = ['error', {
    mode: Mode.NameOnly,
}];

const ruleName = "npm-naming";

export const rule: ESLintRule.RuleModule = {
    meta: {
        docs: {
            description: "Ensure that package name and DefinitelyTyped header match npm package info.",
        },
        schema: {
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
                            default: [],
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
        type: "suggestion",
    },

    create(context: ESLintRule.RuleContext): ESLintRule.RuleListener {
        const source = context.getSourceCode();
        const lookFor = (node: ESTree.Node, search: string, explanation: string) => {
            const idx = source.getText(node).indexOf(search);
            if (idx !== -1) {
                context.report({
                    message: failure(ruleName, explanation),
                    node
                });
            }
        };
        const fileName = context.getFilename();
        const options = context.options[0] ?? defaultOptions;
        return {
            Program(node) {
                if (isMainFile(fileName, /*allowNested*/ false)) {
                    try {
                        const optionsWithSuggestions = toOptionsWithSuggestions(options);
                        const diagnostics = critic(fileName, /* sourcePath */ undefined, optionsWithSuggestions);
                        const errors = filterErrors(diagnostics, context);
                        for (const error of errors) {
                            switch (error.kind) {
                                case ErrorKind.NoMatchingNpmPackage:
                                case ErrorKind.NoMatchingNpmVersion:
                                case ErrorKind.NonNpmHasMatchingPackage:
                                    lookFor(node, "// Type definitions for", errorMessage(error, options));
                                    break;
                                case ErrorKind.DtsPropertyNotInJs:
                                case ErrorKind.DtsSignatureNotInJs:
                                case ErrorKind.JsPropertyNotInDts:
                                case ErrorKind.JsSignatureNotInDts:
                                case ErrorKind.NeedsExportEquals:
                                case ErrorKind.NoDefaultExport:
                                    if (error.position) {
                                        context.report({
                                            message: failure(ruleName, errorMessage(error, options)),
                                            node
                                        });
                                    } else {
                                        context.report({
                                            message: failure(ruleName, errorMessage(error, options)),
                                            node
                                        });
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
        };
    }
};

const enabledSuggestions: ExportErrorKind[] = [
    ErrorKind.JsPropertyNotInDts,
    ErrorKind.JsSignatureNotInDts,
];

function toOptionsWithSuggestions(options: CriticOptions): CriticOptions {
    if (options.mode === Mode.NameOnly) {
        return options;
    }
    const optionsWithSuggestions = { mode: options.mode, errors: new Map(options.errors) };
    enabledSuggestions.forEach(err => optionsWithSuggestions.errors.set(err, true));
    return optionsWithSuggestions;
}

function filterErrors(diagnostics: CriticError[], ctx: ESLintRule.RuleContext): CriticError[] {
    const errors: CriticError[] = [];
    diagnostics.forEach(diagnostic => {
        if (isSuggestion(diagnostic, ctx.options[0])) {
            addSuggestion(ctx, diagnostic.message, diagnostic.position?.start, diagnostic.position?.length);
        } else {
            errors.push(diagnostic);
        }
    });
    return errors;
}

function isSuggestion(diagnostic: CriticError, options: Options): boolean {
    return options.mode === Mode.Code
        && (enabledSuggestions as ErrorKind[]).includes(diagnostic.kind)
        && !(options.errors as Map<ErrorKind, boolean>).get(diagnostic.kind);
}

function eslintDisableOption(error: ErrorKind): string {
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
            return JSON.stringify(["error", { mode: Mode.Code, errors: [[error, false]]}]);
    }
}

function errorMessage(error: CriticError, opts: Options): string {
    const message = error.message +
`\nIf you won't fix this error now or you think this error is wrong,
you can disable this check by adding the following options to your project's tslint.json file under "rules":

    "npm-naming": ${eslintDisableOption(error.kind)}
`;
    if (opts.singleLine) {
        return message.replace(/(\r\n|\n|\r|\t)/gm, " ");
    }

    return message;
}

/**
 * Given npm-naming lint failures, returns a rule configuration that prevents such failures.
 */
export function disabler(failures: Linter.LintMessage[]): Linter.RuleEntry {
    const disabledErrors = new Set<ExportErrorKind>();
    for (const ruleFailure of failures) {
        if (ruleFailure.ruleId !== "npm-naming") {
            throw new Error(`Expected failures of rule "npm-naming", found failures of rule ${ruleFailure.ruleId}.`);
        }
        const message = ruleFailure.message;
        // Name errors.
        if (message.includes("must have a matching npm package")
            || message.includes("must match a version that exists on npm")
            || message.includes("conflicts with the existing npm package")) {
            return "off";
        }
        // Code errors.
        if (message.includes("declaration should use 'export =' syntax")) {
            disabledErrors.add(ErrorKind.NeedsExportEquals);
        } else if (message.includes("declaration specifies 'export default' but the JavaScript source \
            does not mention 'default' anywhere")) {
            disabledErrors.add(ErrorKind.NoDefaultExport);
        } else {
            return ["error", { mode: Mode.NameOnly }];
        }
    }

    if ((defaultErrors as ExportErrorKind[]).every(error => disabledErrors.has(error))) {
        return ["error", { mode: Mode.NameOnly }];
    }
    const errors: Array<[ExportErrorKind, boolean]> = [];
    disabledErrors.forEach(error => errors.push([error, false]));
    return ["error", { mode: Mode.Code, errors }];
}
