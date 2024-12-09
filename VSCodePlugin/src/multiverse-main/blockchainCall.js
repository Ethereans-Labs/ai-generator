var ethers = require('ethers');
var sendBlockchainTransaction = require('./sendBlockchainTransaction');

var {sendAsync, VOID_ETHEREUM_ADDRESS, web3Utils} = require('./utilities');

function transactionReceiptOrContractDeploy(contract, transactionReceipt) {
    if(!transactionReceipt.contractAddress) {
        return transactionReceipt;
    }
    contract.options.address = web3Utils.toChecksumAddress(transactionReceipt.contractAddress);
    contract.options.receipt = transactionReceipt;
    if(module.exports.onContractDeploy && module.exports.onContractDeploy.length > 0) {
        module.exports.onContractDeploy.forEach(it => it(contract));
    }
    return contract;
}

module.exports = async function blockchainCall() {
    var args = [...arguments];
    var method = args.shift();
    var from = VOID_ETHEREUM_ADDRESS;
    var value = 0;
    var blockNumber = null;
    var data;
    try {
        method = (method.implementation ? method.get : method.new ? method.new : method)(...args);
    } catch(e) {
        data = args[args.length - 1];
        from = data.fromOrPlainPrivateKey || data.from || from;
        value = data.value || value;
        blockNumber = data.blockNumber || blockNumber;
        args = args.slice(0, args.length - 1);
        method = (method.implementation ? method.get : method.new ? method.new : method)(...args);
    }
    var contract = method._parent;
    var provider = contract.currentProvider;
    if(args.length > 1 && args[0].data && args[0].arguments instanceof Array) {
        var data = args.pop();
        if(data) {
            from = data.fromOrPlainPrivateKey || data.from || from;
            value = data.value || value;
            blockNumber = data.blockNumber || blockNumber;
        }
    }
    if(from === VOID_ETHEREUM_ADDRESS) {
        try {
            from = provider.accounts[0];
        } catch(e) {
            try {
                from = (await sendAsync(provider, 'eth_requestAccounts'))[0];
            } catch(e) {
                var data = args.pop();
                if(data) {
                    from = data.fromOrPlainPrivateKey || data.from || from;
                    value = data.value || value;
                    blockNumber = data.blockNumber || blockNumber;
                }
            }
        }
    }
    var fromForSend = from;
    try {
        from = new ethers.Wallet(fromForSend).address;
    } catch(e) {
    }
    var to = contract.options.address;
    var dataInput = data;
    data = method.encodeABI();
    return await (method._method.stateMutability === 'view' || method._method.stateMutability === 'pure' ? method.call({
        from,
        value
    }, blockNumber) : sendBlockchainTransaction(provider, fromForSend, to, data, value, dataInput).then(r => transactionReceiptOrContractDeploy(contract, r)));
};

module.exports.onContractDeploy = [];