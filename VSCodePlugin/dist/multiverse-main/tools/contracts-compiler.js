var path = require("path");
var fs = require("fs");
var compile = require("../compile");
var glob = require("glob");
var { resolve } = require("../utilities");

var noBin = process.argv.indexOf('nobin') !== -1;

async function main() {
    var baseLocation = resolve("contracts");
    var files = await new Promise(function(end) {
        glob(baseLocation + '/**/*.sol', {}, (_, files) => end(files.map(it => it.split('\\').join('/').split(baseLocation).join('').substring(1))));
    });
    var abis = [];
    var bins = [];
    var cache = {};
    for(var i in files) {
        var file = files[i = parseInt(i)];
        try {
            var Contracts = await compile(file);
            Contracts = (Contracts.abi ? [Contracts] : Object.values(Contracts)).filter(it => it.abi && it.abi.length > 0)
            for(var Contract of Contracts) {
                var name = Contract.name + 'ABI'
                if(cache[name]) {
                    continue;
                }
                abis.push(`\n    "${name}": ${JSON.stringify(cache[name] = Contract.abi)}`);
                Contract.bin !== '0x' && bins.push(`\n    "${name.substring(0, name.length - 3) + 'BIN'}": "${Contract.bin}"`);
            }
        } catch(e) {
        }
    }
    var data = resolve('build');
    try {
        fs.mkdirSync(data);
    } catch(e) {
    }
    try {
        fs.unlinkSync(path.resolve(data, 'abis.json'));
    } catch(e) {
    }
    try {
        fs.unlinkSync(path.resolve(data, 'compiled.json'));
    } catch(e) {
    }
    fs.writeFileSync(path.resolve(data, noBin ? 'abis.json' : 'compiled.json'), "{" + abis.join(',') + (noBin ? '' : (',' + bins.join(','))) + "\n}");
}

module.exports = main();