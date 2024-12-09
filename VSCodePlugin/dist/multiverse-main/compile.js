var path = require("path");
var os = require('os');
var fs = require("fs");
var solidityManager = require('solc-vm/solc-manager');
var solidityDownloader = require('solc-vm/solc-downloader');
var parser = require('@solidity-parser/parser');
var glob = require("glob");
var { spawn } = require('child_process');
var { resolve } = require('./utilities');

var baseLocation = resolve("contracts");

async function parseOutput(text) {
    var json = JSON.parse(text);
    var output = {};
    for(var entry of Object.entries(json.contracts)) {
        var location = entry[0].split('\\').join('/');
        var name = location.split('\\').join('/').split('/');
        name = name[name.length - 1].split(':')[1];
        location = location.substring(0, location.lastIndexOf(':'));
        var Contract = {
            ...entry[1],
            name,
        };
        json.sources[location] && (Contract.ast = json.sources[location].AST);
        Contract.abi = typeof Contract.abi === 'string' ? JSON.parse(Contract.abi) : Contract.abi;
        Contract = await onCompilation(Contract);
        (output[location] = output[location] || {})[name] = Contract;
    }
    return output;
}

async function onCompilation(Contract) {
    if(!module.exports.onCompilations || module.exports.onCompilations.length === 0) {
        return Contract;
    }
    for(var callback of module.exports.onCompilations) {
        Contract = (await callback(Contract)) || Contract;
    }
    return Contract;
}

var location = resolve("package.json");
while(!fs.existsSync(location)) {
    location = path.resolve(path.dirname(location), "..", "package.json");
}
console.log(location);
//var solidityVersion = JSON.parse(fs.readFileSync(location, "UTF-8")).multiverse.solidityVersion;
var solidityVersion = '0.8.0'

var nodeModulesLocation = resolve("node_modules");
while(!fs.existsSync(nodeModulesLocation)) {
    nodeModulesLocation = path.resolve(path.dirname(nodeModulesLocation), "..", "node_modules");
}
nodeModulesLocation = nodeModulesLocation.split("\\").join("/");

var importedNodeModulesContracts = new Promise(async function(ok) {
    var locations = {};
    await new Promise(function(end) {
        glob(nodeModulesLocation + '/**/*.sol', {}, (err, files) => {
            files.forEach(it => {
                var name = it.split('\\').join('/').split(nodeModulesLocation).join('');
                locations[name.substring(1, name.indexOf('/', 1) + 1)] = true;
            });
            end();
        });
    });
    return ok(Object.keys(locations).map(it => `${it}=${nodeModulesLocation}/${it}`));
});

module.exports = async function compile(file, contractName, solcVersion, noOptimize) {
    if (!solidityManager.hasBinaryVersion(solcVersion = solcVersion || solidityVersion)) {
        await new Promise(ok => solidityDownloader.downloadBinary(solcVersion, ok));
    }
    var fileLocation = (file + (file.indexOf(".sol") === -1 ? ".sol" : "")).split("\\").join("/");

    var location = path.resolve(baseLocation, fileLocation).split("\\").join("/");

    if(!fs.existsSync(location)) {
        location = path.resolve(baseLocation, '../node_modules', fileLocation).split("\\").join("/");
    }

    var removeAtEnd = !fs.existsSync(location);

    contractName = contractName ? contractName : !fs.existsSync(location) ? "Contract" : location.substring(location.lastIndexOf("/") + 1).split(".sol").join("");

    removeAtEnd && fs.writeFileSync(location = path.join(os.tmpdir(), `${contractName}_${new Date().getTime()}.sol`).split('\\').join('/'), file);

    return await new Promise(async function(ok, ko) {
        var exeFile = solidityManager.getBinary(solcVersion);
        var args = [
            ...(await importedNodeModulesContracts),
            '--optimize',
            '--combined-json',
            'abi,ast,bin,bin-runtime,srcmap,srcmap-runtime',
            '--allow-paths',
            baseLocation,
            location
        ];
        if(noOptimize) {
            args.splice(args.indexOf('--optimize'), 1);
        }
        var child;
        try {
            child = spawn(exeFile, args);
        } catch(e) {
            return ko(e);
        }

        var stderr  = '';
        var stdout = '';

        child.stdout.on('data', function (data) {
            stdout += data;
        });

        child.stderr.on('data', function (data) {
            stderr += data;
        });

        child.on('close', async function () {
            var output;
            try {
                output = await parseOutput(stdout);
                output = output[location] || output[location.substring(2)] || output[location.split(path.resolve(baseLocation, '..').split('\\').join('/')).join('').substring(1)];
                output = (output && output[contractName]) || output;
            } catch(e) {
                !stderr && console.error(e);
            }

            try {
                output && (output.parsed = parser.parse(fs.readFileSync(location, 'UTF-8')));
            } catch(e) {
            }

            try {
                removeAtEnd && fs.unlinkSync(location);
            } catch(e) {
            }
            if (stderr && stderr.toLowerCase().indexOf('warning: ') === -1) {
                return ko(new Error(`${removeAtEnd ? '' : `\nContract ${contractName} (${location}):\n`}${stderr}`));
            }
            if(!output) {
                return ko(new Error((stderr ? (stderr + '\n') : '') + "No output for contract " + contractName + " at location " + location + "."));
            }
            stderr && (output.warning = stderr);
            return ok(output);
        });
    });
};

module.exports.solidityVersion = solidityVersion;
module.exports.onCompilations = [];