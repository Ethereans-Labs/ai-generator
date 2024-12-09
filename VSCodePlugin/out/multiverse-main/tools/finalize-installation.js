"use strict";
require("./ganache");
var fs = require('fs');
var path = require('path');
var { resolve } = require("../utilities");
var solidityManager = require('solc-vm/solc-manager');
var solidityDownloader = require('solc-vm/solc-downloader');
var packageJsonPath = resolve('package.json');
var packageContent = JSON.parse(fs.readFileSync(packageJsonPath, 'UTF-8'));
function retrieveLastSolidityVersion() {
    return new Promise(ok => solidityDownloader.getVersionList(versionLit => ok(versionLit.latestRelease)));
}
function readLine(question) {
    var line;
    return new Promise((ok, ko) => {
        var readline = require('readline');
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question.trim() + ' ', function (data) {
            line = (data || '').split(' ').join('');
            rl.close();
        });
        rl.on('close', function () {
            return ok(line);
        });
        rl.on('error', ko);
    });
}
async function retrieveSolidityVersion() {
    var defaultValue;
    var value;
    try {
        value = packageContent.multiverse.solidityVersion;
    }
    catch (e) { }
    while (true) {
        try {
            defaultValue = defaultValue ? defaultValue : value ? defaultValue : await retrieveLastSolidityVersion();
            if (!solidityManager.hasBinaryVersion(value = (value || (await readLine('What Solidity version you want to use? (default is ' + defaultValue + ')')) || defaultValue))) {
                await new Promise(ok => solidityDownloader.downloadBinary(value, ok));
            }
            return value;
        }
        catch (e) {
            value = undefined;
            console.error(e);
        }
    }
}
async function retrieveKnowledgeBaseFolder() {
    var defaultValue = 'resources/knowledgeBase';
    var value;
    try {
        value = packageContent.multiverse.knowledgeBase;
    }
    catch (e) {
    }
    return value || (await readLine('Where the knoledgeBases are located? (default is ' + defaultValue + ')')) || defaultValue;
}
function instrumentProceduresTest() {
    var testDir = resolve('test');
    try {
        fs.mkdirSync(testDir);
    }
    catch (e) {
    }
    fs.writeFileSync(path.resolve(testDir, 'multiverse-procedures.js'), 'describe("Multiverse", () => it("Procedures", require("@ethereansos/multiverse/environments/runner")));');
    var testName = "test";
    try {
        if (packageContent.scripts.test && packageContent.scripts.test !== 'mocha') {
            testName = 'multiverse-test';
        }
    }
    catch (e) { }
    return testName;
}
async function start() {
    packageContent = {
        ...packageContent,
        scripts: {
            ...packageContent.scripts,
            [instrumentProceduresTest()]: "mocha"
        },
        multiverse: {
            ...packageContent.multiverse,
            knowledgeBase: await retrieveKnowledgeBaseFolder(),
            solidityVersion: await retrieveSolidityVersion()
        },
        mocha: {
            ...packageContent.mocha,
            "timeout": false,
            "require": "@ethereansos/multiverse"
        }
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageContent, null, 4));
}
module.exports = start();
//# sourceMappingURL=finalize-installation.js.map