"use strict";
var path = require('path');
var fs = require('fs');
var { sendAsync, web3Utils } = require('./utilities');
var tracer = fs.readFileSync(path.resolve(__dirname, 'transactionTracer.js'), 'UTF-8');
tracer = tracer.substring(tracer.indexOf('{'));
var bytecodeCache = {};
function fixOpcodes(step) {
    if (!step) {
        return step;
    }
    if (step.type === 'CREATE' || step.type === 'CREATE2') {
        var to = step.to;
        if (step.steps) {
            for (var i in step.steps) {
                var stp = step.steps[i];
                stp.from = to;
                step.steps[i] = stp;
            }
        }
        if (step.logs) {
            for (var i in step.logs) {
                var stp = step.logs[i];
                stp.address = to;
                step.logs[i] = stp;
            }
        }
    }
    if (step.type === 'DELEGATECALL') {
        var from = step.from;
        if (step.steps) {
            for (var i in step.steps) {
                var stp = step.steps[i];
                stp.from = from;
                step.steps[i] = stp;
            }
        }
        if (step.logs) {
            for (var i in step.logs) {
                var stp = step.logs[i];
                stp.address = from;
                step.logs[i] = stp;
            }
        }
    }
    if (step.steps) {
        for (var i in step.steps) {
            step.steps[i] = fixOpcodes(step.steps[i]);
        }
    }
    return step;
}
async function cleanAndGetBytecodes(web3, step, transaction) {
    try {
        if (!step) {
            return "0x";
        }
        if ((typeof step).toLowerCase() === 'string') {
            var bytecodeHash = bytecodeCache[step];
            if (bytecodeHash === undefined) {
                bytecodeCache[step] = bytecodeHash = web3Utils.sha3((await web3.eth.getCode(step)).split(step.toLowerCase()).join('0000000000000000000000000000000000000000'));
            }
            return bytecodeHash || "0x";
        }
        if (!step.parent) {
            step.blockHash = transaction.blockHash;
            step.blockNumber = transaction.blockNumber;
            step.transactionHash = transaction.transactionHash;
            step.type = transaction.contractAddress ? 'CREATE' : step.data === '0x' ? 'TRANSFER' : 'CALL';
            step.gasPrice = transaction.gasPrice;
            step.gas = transaction.gas;
            step.gasUsed = transaction.gasUsed;
            step.success = transaction.status;
        }
        delete step.parent;
        try {
            web3Utils.toChecksumAddress(step.from);
        }
        catch (e) {
            delete step.from;
        }
        try {
            web3Utils.toChecksumAddress(step.to);
        }
        catch (e) {
            delete step.to;
        }
        step.fromCodeHash = await cleanAndGetBytecodes(web3, step.from && (step.from = web3Utils.toChecksumAddress(step.from)), transaction);
        step.toCodeHash = await cleanAndGetBytecodes(web3, step.to && (step.to = web3Utils.toChecksumAddress(step.to)), transaction);
        if (step.logs && step.logs.length > 0) {
            for (var i in step.logs) {
                step.logs[i].blockHash = transaction.blockHash;
                step.logs[i].blockNumber = transaction.blockNumber;
                step.logs[i].transactionHash = transaction.transactionHash;
                try {
                    step.logs[i].addressCodeHash = await cleanAndGetBytecodes(web3, step.logs[i].address = web3Utils.toChecksumAddress(step.logs[i].address || step.to), transaction);
                }
                catch (e) { }
            }
        }
        if (step.steps && step.steps.length > 0) {
            for (var i in step.steps) {
                step.steps[i].parent = true;
                step.steps[i] = await cleanAndGetBytecodes(web3, step.steps[i], transaction);
            }
        }
        return step;
    }
    catch (e) {
        console.error(e);
    }
}
module.exports = {
    async debugTransaction(web3, transactionHash) {
        var result = await Promise.all([
            sendAsync(web3.currentProvider, 'debug_traceTransaction', transactionHash, {
                disableStorage: true,
                disableMemory: true,
                disableStack: true,
                tracer
            }).then(r => {
                if (r.errors && r.errors.length > 0) {
                    throw new Error(r.errors.join('\n'));
                }
                return r;
            }),
            web3.eth.getTransaction(transactionHash),
            web3.eth.getTransactionReceipt(transactionHash)
        ]);
        return cleanAndGetBytecodes(web3, fixOpcodes(result[0]), { ...result[1], ...result[2] });
    },
    async debugBlocks(web3, fromBlock, toBlock) {
        var _this = this;
        var blockArray = [parseInt(fromBlock)];
        if (toBlock) {
            for (var i = parseInt(fromBlock) + 1; i <= parseInt(toBlock); i++) {
                blockArray.push(i);
            }
        }
        var blocks = await Promise.all(blockArray.map(it => web3.eth.getBlock(it)));
        var transactionHashes = blocks.filter(it => it && it.transactions && it.transactions.length > 0).map(it => [...it.transactions].map(txn => ({ hash: txn, blockTimestamp: it.timestamp }))).reduce((acc, it) => [...acc, ...it], []);
        var transactions = [];
        transactions = await Promise.all(transactionHashes.map(it => _this.debugTransaction(web3, it.hash)));
        transactions = transactions || [];
        transactions = transactions.map((it, i) => ({ ...it, blockTimestamp: transactionHashes[i].blockTimestamp }));
        return transactions;
    }
};
//# sourceMappingURL=transactionDebugger.js.map