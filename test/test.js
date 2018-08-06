#! /usr/bin/env node
const { join: joinPaths } = require("path");
const { consoleTestResultHandler, runTest } = require("tslint/lib/test");
const { existsSync, readdirSync } = require("fs");

const testDir = __dirname;

const tests = readdirSync(testDir).filter(x => x !== "test.js");

for (const testName of tests) {
    const testDirectory = joinPaths(testDir, testName);
    if (existsSync(joinPaths(testDirectory, "tslint.json"))) {
        testSingle(testDirectory);
    } else {
        for (const subTestName of readdirSync(testDirectory)) {
            testSingle(joinPaths(testDirectory, subTestName));
        }
    }
}

function testSingle(testDirectory) {
    const result = runTest(testDirectory);
    if (!consoleTestResultHandler(result, /*logger*/ console)) {
        process.exit(1);
    }
}
