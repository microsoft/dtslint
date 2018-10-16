import assert = require("assert");
import { pathExists, readFile } from "fs-extra";
import { basename, dirname, join } from "path";
import stripJsonComments = require("strip-json-comments");
import * as ts from "typescript";

export async function readJson(path: string) {
	const text = await readFile(path, "utf-8");
	return JSON.parse(stripJsonComments(text));
}

export function failure(ruleName: string, s: string): string {
	return `${s} See: https://github.com/Microsoft/dtslint/blob/master/docs/${ruleName}.md`;
}

export function getCommonDirectoryName(files: ReadonlyArray<string>): string {
	let minLen = 999;
	let minDir = "";
	for (const file of files) {
		const dir = dirname(file);
		if (dir.length < minLen) {
			minDir = dir;
			minLen = dir.length;
		}
	}
	return basename(minDir);
}

export function eachModuleStatement(sourceFile: ts.SourceFile, action: (statement: ts.Statement) => void): void {
	if (!sourceFile.isDeclarationFile) {
		return;
	}

	for (const node of sourceFile.statements) {
		if (ts.isModuleDeclaration(node)) {
			const statements = getModuleDeclarationStatements(node);
			if (statements) {
				for (const statement of statements) {
					action(statement);
				}
			}
		} else {
			action(node);
		}
	}
}

export function getModuleDeclarationStatements(node: ts.ModuleDeclaration): ReadonlyArray<ts.Statement> | undefined {
	let { body } = node;
	while (body && body.kind === ts.SyntaxKind.ModuleDeclaration) {
		body = body.body;
	}
	return body && ts.isModuleBlock(body) ? body.statements : undefined;
}

export async function getCompilerOptions(dirPath: string): Promise<ts.CompilerOptions> {
	const tsconfigPath = join(dirPath, "tsconfig.json");
	if (!await pathExists(tsconfigPath)) {
		throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
	}
	return (await readJson(tsconfigPath)).compilerOptions;
}

export function withoutPrefix(s: string, prefix: string): string | undefined {
	return s.startsWith(prefix) ? s.slice(prefix.length) : undefined;
}

export function last<T>(a: ReadonlyArray<T>): T {
	assert(a.length !== 0);
	return a[a.length - 1];
}

export function assertDefined<T>(a: T | undefined): T {
	if (a === undefined) { throw new Error(); }
	return a;
}

export async function mapDefinedAsync<T, U>(arr: Iterable<T>, mapper: (t: T) => Promise<U | undefined>): Promise<U[]> {
	const out = [];
	for (const a of arr) {
		const res = await mapper(a);
		if (res !== undefined) {
			out.push(res);
		}
	}
	return out;
}
