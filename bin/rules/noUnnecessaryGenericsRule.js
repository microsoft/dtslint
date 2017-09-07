"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const util_1 = require("../util");
class Rule extends Lint.Rules.AbstractRule {
    static FAILURE_STRING(typeParameter) {
        return util_1.failure(Rule.metadata.ruleName, `Type parameter ${typeParameter} is used only once.`);
    }
    apply(sourceFile) {
        return this.applyWithFunction(sourceFile, walk);
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
function walk(ctx) {
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
            const soleUse = getSoleUse(sig, typeParameter);
            if (soleUse !== undefined) {
                ctx.addFailureAtNode(soleUse, Rule.FAILURE_STRING(typeParameter));
            }
        }
    }
}
function getSoleUse(sig, typeParameter) {
    const exit = {};
    let soleUse;
    try {
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
            return undefined;
        }
        throw err;
    }
    return soleUse;
    function recur(node) {
        if (ts.isIdentifier(node)) {
            if (node.text === typeParameter) {
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
//# sourceMappingURL=noUnnecessaryGenericsRule.js.map