// https://github.com/palantir/tslint/pull/2229
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright 2013 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ts = require("typescript");
const Lint = require("tslint");
const OPTION_ALLOW_DECLARATIONS = "allow-declarations";
const OPTION_ALLOW_NAMED_FUNCTIONS = "allow-named-functions";
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new OnlyArrowFunctionsWalker(sourceFile, this.getOptions()));
    }
}
/* tslint:disable:object-literal-sort-keys */
Rule.metadata = {
    ruleName: "only-arrow-functions-2",
    description: "Disallows traditional (non-arrow) function expressions.",
    rationale: "Traditional functions don't bind lexical scope, which can lead to unexpected behavior when accessing 'this'.",
    optionsDescription: Lint.Utils.dedent `
			Two arguments may be optionally provided:

			* \`"${OPTION_ALLOW_DECLARATIONS}"\` allows standalone function declarations.
			* \`"${OPTION_ALLOW_NAMED_FUNCTIONS}"\` allows the expression \`function foo() {}\` but not \`function() {}\`.
		`,
    options: {
        type: "array",
        items: {
            type: "string",
            enum: [OPTION_ALLOW_DECLARATIONS, OPTION_ALLOW_NAMED_FUNCTIONS],
        },
        minLength: 0,
        maxLength: 1,
    },
    optionExamples: ["true", `[true, "${OPTION_ALLOW_DECLARATIONS}", "${OPTION_ALLOW_NAMED_FUNCTIONS}"]`],
    type: "typescript",
    typescriptOnly: false,
};
/* tslint:enable:object-literal-sort-keys */
Rule.FAILURE_STRING = "non-arrow functions are forbidden";
exports.Rule = Rule;
class OnlyArrowFunctionsWalker extends Lint.RuleWalker {
    constructor(sourceFile, options) {
        super(sourceFile, options);
        this.allowDeclarations = this.hasOption(OPTION_ALLOW_DECLARATIONS);
        this.allowNamedFunctions = this.hasOption(OPTION_ALLOW_NAMED_FUNCTIONS);
    }
    visitFunctionDeclaration(node) {
        if (!this.allowDeclarations && !this.allowNamedFunctions) {
            this.failUnlessExempt(node);
        }
        super.visitFunctionDeclaration(node);
    }
    visitFunctionExpression(node) {
        if (node.name === undefined || !this.allowNamedFunctions) {
            this.failUnlessExempt(node);
        }
        super.visitFunctionExpression(node);
    }
    failUnlessExempt(node) {
        if (!functionIsExempt(node)) {
            this.addFailureAtNode(Lint.childOfKind(node, ts.SyntaxKind.FunctionKeyword), Rule.FAILURE_STRING);
        }
    }
}
/** Generator functions and functions explicitly declaring `this` are allowed. */
function functionIsExempt(node) {
    return node.asteriskToken || hasThisParameter(node) || node.body && usesThisInBody(node.body);
}
function hasThisParameter(node) {
    const first = node.parameters[0];
    return first && first.name.kind === ts.SyntaxKind.Identifier &&
        first.name.originalKeywordKind === ts.SyntaxKind.ThisKeyword;
}
function usesThisInBody(node) {
    if (node.kind === ts.SyntaxKind.ThisKeyword ||
        node.kind === ts.SyntaxKind.Identifier && node.text === "arguments") {
        return true;
    }
    if (hasNewThis(node)) {
        return false;
    }
    return ts.forEachChild(node, usesThisInBody);
}
function hasNewThis(node) {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=onlyArrowFunctions2Rule.js.map