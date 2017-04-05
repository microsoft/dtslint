#! /usr/bin/env node
const { join: joinPaths } = require("path");
const { consoleTestResultHandler, runTest } = require("tslint/lib/test");
const { existsSync, readdirSync } = require("fs");

const rulesDirectory = joinPaths(__dirname, "..", "bin", "rules");
const testDir = __dirname;

const tests = readdirSync(testDir).filter(x => x !== "test.js");

for (const testName of tests) {
    const testDirectory = joinPaths(testDir, testName);
    if (existsSync(joinPaths(testDirectory, "tslint.json"))) {
        doTest(testDirectory);
    } else {
        for (const subTestName of readdirSync(testDirectory)) {
            doTest(joinPaths(testDirectory, subTestName));
        }
    }
}

function doTest(testDirectory) {
    const result = runTest(testDirectory, rulesDirectory);
    if (!consoleTestResultHandler(result)) {
        process.exit(1);
    }
}
