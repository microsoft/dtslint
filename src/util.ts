import { readFile } from "fs-promise";
import stripJsonComments = require("strip-json-comments");

export async function readJson(path: string) {
	const text = await readFile(path, "utf-8");
	return JSON.parse(stripJsonComments(text));
}

export function failure(ruleName: string, s: string): string {
	return `${s} See: https://github.com/Microsoft/dtslint/blob/master/docs/${ruleName}.md`;
}
