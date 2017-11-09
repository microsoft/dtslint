"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const util_1 = require("../util");
class Rule extends Lint.Rules.TypedRule {
    applyWithProgram(_sourceFile, program) {
        if (seenPrograms.has(program)) {
            return [];
        }
        seenPrograms.add(program);
        const failures = [];
        for (const sourceFile of program.getSourceFiles()) {
            const { fileName } = sourceFile;
            if (fileName.includes("/DefinitelyTyped/node_modules/")) {
                const msg = util_1.failure(Rule.metadata.ruleName, `File ${fileName} comes from a \`node_modules\` but is not declared in this type's \`package.json\`. `);
                failures.push(new Lint.RuleFailure(sourceFile, 0, 1, msg, Rule.metadata.ruleName));
            }
        }
        return failures;
    }
}
Rule.metadata = {
    ruleName: "no-outside-dependencies",
    description: "Don't import things in `DefinitelyTyped/node_modules`.",
    optionsDescription: "Not configurable.",
    options: null,
    type: "functionality",
    typescriptOnly: true,
};
exports.Rule = Rule;
const seenPrograms = new WeakSet();
//# sourceMappingURL=noOutsideDependenciesRule.js.map