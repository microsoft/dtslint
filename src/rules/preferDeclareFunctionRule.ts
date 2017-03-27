import * as Lint from "tslint";
import * as ts from "typescript";

export class Rule extends Lint.Rules.AbstractRule {
	public static metadata: Lint.IRuleMetadata = {
		ruleName: "prefer-declare-function",
		description: "Forbids `export const x = () => void`.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "style",
		typescriptOnly: true,
	};

    public static FAILURE_STRING = "Use a function declaration instead of a variable of function type.";

	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
    eachModuleStatement(ctx.sourceFile, (statement) => {
        if (isVariableStatement(statement)) {
            for (const varDecl of statement.declarationList.declarations) {
                if (varDecl.type !== undefined && varDecl.type.kind === ts.SyntaxKind.FunctionType) {
                    ctx.addFailureAtNode(varDecl, Rule.FAILURE_STRING);
                }
            }
        }
    });
}

function isVariableStatement(node: ts.Node): node is ts.VariableStatement {
    return node.kind === ts.SyntaxKind.VariableStatement;
}

function eachModuleStatement(sourceFile: ts.SourceFile, action: (statement: ts.Statement) => void): void{
	if (!sourceFile.isDeclarationFile) {
		return;
	}

	for (const node of sourceFile.statements) {
		if (isModuleDeclaration(node)) {
			let { body } = node;
			if (!body) {
				return;
			}

			while (body.kind === ts.SyntaxKind.ModuleDeclaration) {
				body = body.body;
			}

			if (body.kind === ts.SyntaxKind.ModuleBlock) {
				for (const statement of body.statements) {
					action(statement);
				}
			}
		} else {
			action(node);
		}
	}
}

function isModuleDeclaration(node: ts.Node): node is ts.ModuleDeclaration {
	return node.kind === ts.SyntaxKind.ModuleDeclaration;
}
