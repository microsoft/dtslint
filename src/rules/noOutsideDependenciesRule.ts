import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.TypedRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-outside-dependencies",
        description: "Don't import things in `DefinitelyTyped/node_modules`.",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    applyWithProgram(_sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        if (seenPrograms.has(program)) {
            return [];
        }
        seenPrograms.add(program);

        const failures: Lint.RuleFailure[] = [];
        for (const sourceFile of program.getSourceFiles()) {
            const { fileName } = sourceFile;
            if (fileName.includes("/DefinitelyTyped/node_modules/") && !program.isSourceFileDefaultLibrary(sourceFile)) {
                const msg = failure(
                    Rule.metadata.ruleName,
                    `File ${fileName} comes from a \`node_modules\` but is not declared in this type's \`package.json\`. `);
                failures.push(new Lint.RuleFailure(sourceFile, 0, 1, msg, Rule.metadata.ruleName));
            }
        }
        return failures;
    }
}

const seenPrograms = new WeakSet<ts.Program>();
