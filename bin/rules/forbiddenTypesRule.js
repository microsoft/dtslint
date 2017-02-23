"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
class Rule extends Lint.Rules.AbstractRule {
    static upperCaseFailureString(name) {
        return `Avoid using the ${name} type. You probably meant ${name.toLowerCase()}`;
    }
    apply(sourceFile) {
        return this.applyWithWalker(new Walker(sourceFile, this.getOptions()));
    }
}
Rule.metadata = {
    ruleName: "forbidden-types",
    description: "Forbid the Function, Object, Boolean, Number, and String types.",
    rationale: "Certain types are never a good idea.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
Rule.FUNCTION_FAILURE_STRING = "Avoid using the Function type. Prefer a specific function type, like `() => void`.";
Rule.OBJECT_FAILURE_STRING = "Avoid using the Object type. Did you mean `any` or `{}`?";
exports.Rule = Rule;
class Walker extends Lint.RuleWalker {
    visitTypeReference(node) {
        const name = node.typeName.getText();
        const failure = nameFailure(name);
        if (failure) {
            this.addFailureAtNode(node, failure);
        }
        super.visitTypeReference(node);
    }
}
function nameFailure(name) {
    switch (name) {
        case "Function":
            return Rule.FUNCTION_FAILURE_STRING;
        case "Object":
            return Rule.OBJECT_FAILURE_STRING;
        case "Boolean":
        case "Number":
        case "String":
            return Rule.upperCaseFailureString(name);
        default:
            return undefined;
    }
}
//# sourceMappingURL=forbiddenTypesRule.js.map