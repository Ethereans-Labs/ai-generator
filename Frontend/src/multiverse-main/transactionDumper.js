var path = require('path');
var fs = require('fs');

var compile = require('./compile');
var { web3Utils, resolve } = require('./utilities');
var transactionDebugger = require('./transactionDebugger');
var blockchainCall = require('./blockchainCall');

var dumpPath = resolve('dump');
try {
    fs.mkdirSync(dumpPath);
} catch (e) {}

function toABIKey(abi) {
    var key = JSON.stringify(abi);
    key += (abi.name || '' );
    return web3Utils.sha3(key);
}

compile.onCompilations.push(function onCompilation(contract) {
    contract.abi.name = contract.name;
    var key = web3Utils.sha3("0x" + contract['bin-runtime']);
    key = key === undefined || key === null || key === '' || key === 'null' ?  contract.name : key;
    (global.compiledContracts = global.compiledContracts || {})[key] = contract;
    (global.contractsInfo = global.contractsInfo || {})[toABIKey(contract.abi)] = {
        name : contract.name,
        abi : contract.abi
    };
});

blockchainCall.onContractDeploy.push(async function onContractDeploy(contract) {
    (global.wellknownAddresses = global.wellknownAddresses || {})[contract.options.address] = global.wellknownAddresses[contract.options.address] || contract.name;
});

module.exports = async function transactionDumper(web3, startBlockDelayed) {

    var title = undefined;
    var label = undefined;
    var jsonPath;
    var appendTransactions;
    var transactionLabels = {};

    var chainId;
    var startBlock;

    async function init() {
        chainId = parseInt(await web3.eth.getChainId());
        !startBlockDelayed && (startBlock = parseInt(await web3.eth.getBlockNumber()) + 1);
        try {
            fs.unlinkSync(jsonPath = path.resolve(dumpPath, `${chainId}.json`));
        } catch (e) {}
        var provider = web3.currentProvider;
        if(!provider.api) {
            return;
        }
        var old_evm_mine = provider.api.evm_mine;
        provider.api.evm_mine = async function evm_mine() {
            var result = await old_evm_mine.apply(provider.api, arguments);
            if(appendTransactions) {
                await dumpBlocks(true);
            }
            return result;
        }
        function instrumentOnTransaction(provider, functionName) {
            var oldFunction = provider.api[functionName];
            if(!oldFunction) {
                return;
            }
            provider.api[functionName] = async function() {
                var _title = title;
                var _label = label;
                var key = _title + " - " + (_label || "");
                if(!startBlock || (transactionLabels[key] && !appendTransactions)) {
                    return await oldFunction.apply(provider.api, arguments);
                }
                if(!appendTransactions) {
                    transactionLabels[key] = true;
                }
                var result;
                var error;
                try {
                    result = await oldFunction.apply(provider.api, arguments);
                } catch(e) {
                    error = e;
                }

                if(appendTransactions) {
                    await dumpBlocks(true);
                } else if(transactionLabels[key] === true) {
                    var transactionHash;
                    try {
                        transactionHash = "0x" + result.bufferValue.toString('hex');
                    } catch(e) {
                        transactionHash = error?.data?.hash;
                    }
                    transactionLabels[key] = transactionHash;
                }

                if(error) {
                    throw error;
                }
                return result;
            }
        }
        instrumentOnTransaction(provider, 'eth_sendTransaction');
        instrumentOnTransaction(provider, 'eth_sendSignedTransaction');
        instrumentOnTransaction(provider, 'eth_sendRawTransaction');

        var OldContract = web3.eth.Contract;
        web3.eth.Contract = function Contract(abi, address) {
            var contract = (global.contractsInfo = global.contractsInfo || {})[toABIKey(abi)];
            var contractInstance = new OldContract(...arguments);
            try {
                contractInstance.name = contract.name || abi.name;
                contractInstance.abi = contract.abi;
                address && ((global.wellknownAddresses = global.wellknownAddresses || {})[address = web3Utils.toChecksumAddress(address)] = global.wellknownAddresses[address] || contractInstance.name);
                address && web3.eth.getCode(address).then(code => (global.compiledContracts = global.compiledContracts || {})[web3Utils.sha3(code)] = contract);
            } catch (e) {}
            return contractInstance;
        };
    }

    async function dumpBlocks(append, additionalTransactionHashes) {

        var startOrAppendedBlock = startBlock;

        var transactions = [];

        if(additionalTransactionHashes && additionalTransactionHashes.length > 0) {
            transactions.push(...(await Promise.all(additionalTransactionHashes.map(it => transactionDebugger.debugTransaction(web3, it)))));
            transactionLabels = {
                'Dumped Transactions' : additionalTransactionHashes[0],
                ...transactionLabels
            }
        }

        if(append) {
            appendTransactions = true;
            try {
                transactions.push(...JSON.parse(fs.readFileSync(jsonPath, "utf-8")).transactions);
                startOrAppendedBlock = transactions.length === 0 ? startOrAppendedBlock : (parseInt(transactions[transactions.length - 1].blockNumber) + 1);
            } catch(e) {}
        }

        transactions.push(...(await transactionDebugger.debugBlocks(web3, startOrAppendedBlock, await web3.eth.getBlockNumber())));

        try {
            fs.unlinkSync(jsonPath);
        } catch (e) {}

        var wellknownAddresses = Object.entries({... global.wellknownAddresses}).reduce((acc, it) => ({...acc, [web3Utils.toChecksumAddress(it[0])] : it[1]}), {})

        try {
            fs.writeFileSync(jsonPath, JSON.stringify({ transactions, compiledContracts: { ...global.compiledContracts, ...global.contractsInfo }, wellknownAddresses, transactionLabels }));
        } catch (e) {
        }
    }

    await init();

    var result = {
        web3,
        chainId,
        startBlock,
        dumpBlocks,
        setLabels(_title, _label) {
            title = _title;
            label = _label;
            transactionLabels["undefined - "] && (transactionLabels[title + " - "] = transactionLabels["undefined - "]);
            delete transactionLabels["undefined - "];
        }
    }

    startBlockDelayed && (result.setStartBlock = async function setStartBlock() {
        delete result.setStartBlock;
        result.startBlock = startBlock = parseInt(await web3.eth.getBlockNumber()) + 1;
    });

    return result;
}