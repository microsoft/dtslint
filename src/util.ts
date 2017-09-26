import { readFile } from "fs-promise";
import { basename, dirname } from "path";
import stripJsonComments = require("strip-json-comments");

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
