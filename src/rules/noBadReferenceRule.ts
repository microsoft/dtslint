import assert = require("assert");
import { basename, dirname } from "path";
import * as Lint from "tslint";
import * as ts from "typescript";

import { failure } from "../util";

export class Rule extends Lint.Rules.AbstractRule {
	static metadata: Lint.IRuleMetadata = {
		ruleName: "no-bad-reference",
		description: 'Forbid <reference path="../etc"/> in any file, and forbid <reference path> in test files.',
		optionsDescription: "Not configurable.",
		options: null,
		type: "functionality",
		typescriptOnly: true,
	};

	static FAILURE_STRING = failure(
		Rule.metadata.ruleName,
		"Don't use <reference path> to reference another package. Use an import or <reference types> instead.");
	static FAILURE_STRING_REFERENCE_IN_TEST = failure(
		Rule.metadata.ruleName,
		"Don't use <reference path> in test files. " +
		"Use <reference types> for external dependencies. " +
		"To reference a file in this package, include it in 'tsconfig.json'.");
	static FAILURE_STRING_TYPE_REFERENCE_TO_SELF(packageName: string): string {
		return failure(
			Rule.metadata.ruleName,
			`Type reference to ${packageName} refers to the current package.\n` +
			"normally this can simply be removed, or you should use a '<reference path>' instead.");
	}

	apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithFunction(sourceFile, walk);
	}
}

function walk(ctx: Lint.WalkContext<void>): void {
	const { sourceFile } = ctx;

	for (const ref of sourceFile.typeReferenceDirectives) {
		const packageName = getCurrentPackageName(sourceFile.fileName);
		if (ref.fileName === packageName) {
			ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING_TYPE_REFERENCE_TO_SELF(basename(packageName)));
		}
	}

	for (const ref of sourceFile.referencedFiles) {
		if (sourceFile.isDeclarationFile) {
			if (ref.fileName.startsWith("..")) {
				ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING);
			}
		} else {
			ctx.addFailure(ref.pos, ref.end, Rule.FAILURE_STRING_REFERENCE_IN_TEST);
		}
	}
}

function getCurrentPackageName(fileName: string): string {
	let dir = dirname(fileName);
	while (basename(dirname(dir)) !== "types") {
		assert(dir !== "");
		dir = dirname(dir);
	}
	return basename(dir);
}
