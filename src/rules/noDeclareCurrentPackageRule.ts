import * as Lint from "tslint";
import * as ts from "typescript";

import { failure, getCommonDirectoryName } from "../util";

export class Rule extends Lint.Rules.TypedRule {
    static metadata: Lint.IRuleMetadata = {
        ruleName: "no-declare-current-package",
        description: "Don't use an ambient module declaration of the current package; use a normal module.",
        optionsDescription: "Not configurable.",
        options: null,
        type: "functionality",
        typescriptOnly: true,
    };

    applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        if (!sourceFile.isDeclarationFile) {
            return [];
        }

        const packageName = getCommonDirectoryName(program.getRootFileNames());
        return this.applyWithFunction(sourceFile, ctx => walk(ctx, packageName));
    }
}

function walk(ctx: Lint.WalkContext<void>, packageName: string): void {
    for (const statement of ctx.sourceFile.statements) {
        if (ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)) {
            const { text } = statement.name;
            if (text === packageName || text.startsWith(`${packageName}/`)) {
                const preferred = text === packageName ? '"index.d.ts"' : `"${text}.d.ts" or "${text}/index.d.ts`;
                ctx.addFailureAtNode(statement.name, failure(
                    Rule.metadata.ruleName,
                    `Instead of declaring a module with \`declare module "${text}"\`, ` +
                    `write its contents in directly in ${preferred}.`));
            }
        }
    }
}
