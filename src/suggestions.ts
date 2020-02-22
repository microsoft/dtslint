import { WalkContext } from "tslint";

export interface Suggestion {
    fileName: string,
    ruleName: string,
    message: string,
    start?: number,
    width?: number,
}

const suggestions: Suggestion[] = [];

/**
 *  A rule should call this function to provide a suggestion instead of a lint failure.
*/
export function addSuggestion<T>(ctx: WalkContext<T>, message: string, start?: number, width?: number) {
    const suggestion: Suggestion = {
        fileName: ctx.sourceFile.fileName,
        ruleName: ctx.ruleName,
        message,
        start,
        width
    };

    suggestions.push(suggestion);
}

export function printSuggestions(): void {
    console.log(`Suggestions: ${JSON.stringify(suggestions, /*replacer*/ undefined, 0)}`);
}