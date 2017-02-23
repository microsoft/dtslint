import { readFile } from "fs-promise";
import stripJsonComments = require("strip-json-comments");

export async function readJson(path: string) {
	const text = await readFile(path, "utf-8");
	return JSON.parse(stripJsonComments(text));
}
