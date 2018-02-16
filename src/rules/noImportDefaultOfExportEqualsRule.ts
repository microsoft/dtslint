import * as Lint from "tslint";
import * as ts from "typescript";

import { eachModuleStatement, failure, getModuleDeclarationStatements } from "../util";

export class Rule extends Lint.Rules.TypedRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-import-default-of-export-equals",
		description: "Forbid a default import to reference an `export =` module.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static FAILURE_STRING(importName: string, moduleName: string): string {
		return failure(
			Rule.metadata.ruleName,
			`The module ${moduleName} uses \`export = \`. Import with \`import ${importName} = require(${moduleName})\`.`);
	}

	applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, ctx => walk(ctx, program.getTypeChecker()));
	}
}

function walk(ctx: Lint.WalkContext<void>, checker: ts.TypeChecker): void {
	eachModuleStatement(ctx.sourceFile, statement => {
		if (!ts.isImportDeclaration(statement)) {
			return;
		}
		const defaultName = statement.importClause && statement.importClause.name;
		if (!defaultName) {
			return;
		}
		const sym = checker.getSymbolAtLocation(statement.moduleSpecifier);
		if (sym && sym.declarations && sym.declarations.some(d => {
			const statements = getStatements(d);
			return statements !== undefined && statements.some(s => ts.isExportAssignment(s) && !!s.isExportEquals);
		})) {
			ctx.addFailureAtNode(defaultName, Rule.FAILURE_STRING(defaultName.text, statement.moduleSpecifier.getText()));
		}
	});
}

function getStatements(decl: ts.Declaration): ReadonlyArray<ts.Statement> | undefined {
	return ts.isSourceFile(decl) ? decl.statements
		: ts.isModuleDeclaration(decl) ? getModuleDeclarationStatements(decl)
		: undefined;
}
