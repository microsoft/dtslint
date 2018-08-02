import { existsSync, pathExistsSync, readFile, readFileSync } from "fs-extra";
import { basename, dirname, join as joinPath, resolve as resolvePath } from "path";
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

/**
 * @param tsconfigPath
 * @param tsType an implemention of ts i.e. some version of it
 * @param formatDiagnosticHost if provided fails with Diagnostics support otherwise might silently ignore errors
 */
export function readAndParseConfig(
	tsconfigPath: string,
	tsType: typeof ts,
	formatDiagnosticHost?: ts.FormatDiagnosticsHost,
) {
	const dirPath = dirname(tsconfigPath);
	const { config, error } = tsType.readConfigFile(tsconfigPath, tsType.sys.readFile);
	if (error != null && formatDiagnosticHost != null) {
		throw new Error(tsType.formatDiagnostic(error, formatDiagnosticHost));
	}

	const parseConfigHost: ts.ParseConfigHost = {
		fileExists: existsSync,
		readDirectory: tsType.sys.readDirectory,
		readFile: file => readFileSync(file, "utf8"),
		useCaseSensitiveFileNames: true,
	};

	const { errors, ...rest } = tsType.parseJsonConfigFileContent(
		config,
		parseConfigHost,
		resolvePath(dirPath),
	);
	if (errors.length > 0 && formatDiagnosticHost) {
		throw new Error(tsType.formatDiagnostics(errors, formatDiagnosticHost));
	}

	return rest;
}

export function getCompilerOptions(dirPath: string): ts.CompilerOptions {
	const tsconfigPath = joinPath(dirPath, "tsconfig.json");

	const formatDiagnosticHost: ts.FormatDiagnosticsHost = {
		getCanonicalFileName: (fileName: string) => fileName,
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		getNewLine: () => "\n",
	};

	if (!pathExistsSync(tsconfigPath)) {
		throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
	}

	const { options } = readAndParseConfig(tsconfigPath, ts, formatDiagnosticHost);
	return options;
}
