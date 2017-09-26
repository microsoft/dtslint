import { basename, dirname } from "path";

import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.TypedRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-self-import",
		description: "Forbids declaration files to import the current package using a global import.",
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: false,
	};

	applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
		if (!sourceFile.isDeclarationFile) {
			return [];
		}

		const name = getCommonDirectoryName(program.getSourceFiles());
		return this.applyWithFunction(sourceFile, ctx => walk(ctx, name));
	}
}

const FAILURE_STRING = failure(
	Rule.metadata.ruleName,
	"Declaration file should not use a global import of itself. Use a relative import.");

function getCommonDirectoryName(files: ReadonlyArray<ts.SourceFile>): string {
	let minLen = 999;
	let minDir = "";
	for (const file of files) {
		const dir = dirname(file.fileName);
		if (dir.length < minLen) {
			minDir = dir;
		}
	}
	return basename(minDir);
}

function walk(ctx: Lint.WalkContext<void>, packageName: string): void {
	for (const i of ctx.sourceFile.imports) {
		if (i.text === packageName || i.text.startsWith(packageName + "/")) {
			ctx.addFailureAtNode(i, FAILURE_STRING);
		}
	}
}
