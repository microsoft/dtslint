import { join as joinPaths } from "path";
import { ESLint } from "eslint";

import { parseTsconfigFiles } from "./parseTsconfigFiles";

export async function lint(dirPath: string): Promise<string | undefined> {
    const tsconfigPath = joinPaths(dirPath, "tsconfig.json");
    const files = parseTsconfigFiles(dirPath, tsconfigPath);
    if (typeof files === "string") {
        return files;
    }

    const eslint = new ESLint({
        baseConfig: {
            parser: '@typescript-eslint/parser',
            plugins: ['@typescript-eslint/eslint-plugin'],
            root: true,
        }
    });
    const results = await eslint.lintFiles(files);
    const formatter = await eslint.loadFormatter("stylish");

    return formatter.format(results);
}
