import fs = require("fs");
import os = require("os");
import path = require("path");
import { WalkContext } from "tslint";

const suggestionsDir = path.join(os.homedir(), ".dts", "suggestions");

export interface Suggestion {
    fileName: string;
    ruleName: string;
    message: string;
    start?: number;
    width?: number;
}

// Packages for which suggestions were already added in this run of dtslint.
const existingPackages = new Set();

/**
 *  A rule should call this function to provide a suggestion instead of a lint failure.
 */
export function addSuggestion<T>(ctx: WalkContext<T>, message: string, start?: number, width?: number) {
    const suggestion: Suggestion = {
        fileName: ctx.sourceFile.fileName,
        ruleName: ctx.ruleName,
        message,
        start,
        width,
    };

    const packageName = dtPackageName(ctx.sourceFile.fileName);
    if (!packageName) {
        return;
    }
    let flag = "a";
    if (!existingPackages.has(packageName)) {
        flag = "w";
        existingPackages.add(packageName);
    }
    try {
        if (!fs.existsSync(suggestionsDir)) {
            fs.mkdirSync(suggestionsDir, { recursive: true });
        }
        fs.writeFileSync(
            path.join(suggestionsDir, packageName + ".txt"),
            flag === "a" ? "\n" + formatSuggestion(suggestion) : formatSuggestion(suggestion),
            { flag, encoding: "utf8" });
    } catch (e) {
        console.log(`Could not write suggestions for package ${packageName}. ${e.message || ""}`);
    }
}

const dtPath = path.join("DefinitelyTyped", "types");

function dtPackageName(filePath: string): string | undefined {
    const dtIndex = filePath.indexOf(dtPath);
    if (dtIndex === -1) {
        return undefined;
    }
    const basePath = filePath.substr(dtIndex + dtPath.length);
    const dirs = basePath.split(path.sep).filter(dir => dir !== "");
    if (dirs.length === 0) {
        return undefined;
    }
    const packageName = dirs[0];
    // Check if this is an old version of a package.
    if (dirs.length > 1 && /^v\d+(\.\d+)?$/.test(dirs[1])) {
        return packageName + dirs[1];
    }
    return packageName;
}

function formatSuggestion(suggestion: Suggestion): string {
    return JSON.stringify(suggestion, /*replacer*/ undefined, 0);
}
