import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.TypedRule {
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

    applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, program.getTypeChecker()));
    }
}

function walk(ctx: Lint.WalkContext<void>, checker: ts.TypeChecker): void {
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
            const res = getSoleUse(sig, assertDefined(checker.getSymbolAtLocation(tp.name)), checker);
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
function getSoleUse(sig: ts.SignatureDeclaration, typeParameterSymbol: ts.Symbol, checker: ts.TypeChecker): Result {
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

    function recur(node: ts.TypeNode): void {
        if (ts.isIdentifier(node)) {
            if (checker.getSymbolAtLocation(node) === typeParameterSymbol) {
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

function assertDefined<T>(value: T | undefined): T {
    if (value === undefined) {
        throw new Error("unreachable");
    }
    return value;
}
function assertNever(_: never) {
    throw new Error("unreachable");
}
