"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.TypedRule {
    static FAILURE_STRING(typeParameter) {
        return util_1.failure(Rule.metadata.ruleName, `Type parameter ${typeParameter} is used only once.`);
    }
    static FAILURE_STRING_NEVER(typeParameter) {
        return util_1.failure(Rule.metadata.ruleName, `Type parameter ${typeParameter} is never used.`);
    }
    applyWithProgram(sourceFile, program) {
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, program.getTypeChecker()));
    }
}
Rule.metadata = {
    ruleName: "no-unnecessary-generics",
    description: "Forbids signatures using a generic parameter only once.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "style",
    typescriptOnly: true,
};
exports.Rule = Rule;
function walk(ctx, checker) {
    const { sourceFile } = ctx;
    sourceFile.forEachChild(function cb(node) {
        if (ts.isFunctionLike(node)) {
            checkSignature(node);
        }
        node.forEachChild(cb);
    });
    function checkSignature(sig) {
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
function getSoleUse(sig, typeParameterSymbol, checker) {
    const exit = {};
    let soleUse;
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
    }
    catch (err) {
        if (err === exit) {
            return { type: "ok" };
        }
        throw err;
    }
    return soleUse ? { type: "sole", soleUse } : { type: "never" };
    function recur(node) {
        if (ts.isIdentifier(node)) {
            if (checker.getSymbolAtLocation(node) === typeParameterSymbol) {
                if (soleUse === undefined) {
                    soleUse = node;
                }
                else {
                    throw exit;
                }
            }
        }
        else {
            node.forEachChild(recur);
        }
    }
}
function assertDefined(value) {
    if (value === undefined) {
        throw new Error("unreachable");
    }
    return value;
}
function assertNever(_) {
    throw new Error("unreachable");
}
//# sourceMappingURL=noUnnecessaryGenericsRule.js.map