"use strict";
exports.mochaHooks = require('./environments/mocha');
var fs = require('fs');
var dirname = __dirname.split('\\').join('/');
var files = fs.readdirSync(dirname);
files = files.filter(it => it.endsWith('.js')).map(it => it.split('\\').join('//'));
var all = files.reduce((acc, it) => {
    var key = it.split(dirname).join('').split('.js').join('');
    var mod = require('./' + key);
    return {
        ...acc,
        [key]: mod,
        ...mod
    };
}, {});
module.exports = all;
//# sourceMappingURL=index.js.map