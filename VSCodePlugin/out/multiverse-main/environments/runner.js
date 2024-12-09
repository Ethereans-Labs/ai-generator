"use strict";
var { resolve } = require('../utilities');
module.exports = async function run() {
    var procedures = process.env.PROCEDURES || null;
    try {
        procedures = JSON.parse(procedures);
    }
    catch (e) {
    }
    try {
        procedures = procedures.split(',');
    }
    catch (e) {
    }
    procedures = procedures && (procedures instanceof Array ? procedures : [procedures]) || [];
    console.log('Procedures', JSON.stringify(procedures));
    var tests = [];
    for (var procedure of procedures) {
        console.log('Running procedure', procedure);
        var procedureEngine = require(resolve('procedures/' + procedure, true));
        var run = procedureEngine.run || procedureEngine;
        run instanceof Function && await run();
        var test = procedureEngine.test || run.test;
        if (global.accounts && test) {
            tests.push({
                procedure,
                test
            });
        }
        console.log('\n===', 'Procedure', procedure, 'END', '===\n');
    }
    for (entry of tests) {
        console.log('Running tests of', entry.procedure);
        await entry.test();
        console.log('\n===', 'Test of procedure', procedure, 'TERMINATED', '===\n');
    }
};
//# sourceMappingURL=runner.js.map