import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

function formatErrors(diagnostics: ts.Diagnostic[]) {
    return ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: file => file,
        getCurrentDirectory: process.cwd,
        getNewLine: () => "\n",
    });
}

export function parseTsconfigFiles(dirPath: string, configFile: string) {
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    if (config.error) {
        return formatErrors([config.error]);
    }

    const parsed = ts.parseJsonConfigFileContent(
        config.config,
        {
            fileExists: fs.existsSync,
            readDirectory: ts.sys.readDirectory,
            readFile: file => fs.readFileSync(file, "utf8"),
            useCaseSensitiveFileNames: true,
        },
        path.resolve(dirPath),
        { noEmit: true },
    );

    if (parsed.errors) {
        // Ignore warnings and "TS18003: No inputs were found in config file ..."
        const errors = parsed.errors.filter(
            diagnostic => diagnostic.category === ts.DiagnosticCategory.Error && diagnostic.code !== 18003,
        );
        if (errors.length) {
            return formatErrors(errors);
        }
    }

    return parsed.fileNames;
}