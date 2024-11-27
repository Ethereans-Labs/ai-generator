var gasCalculator = require('./gasCalculator');
var { FeeMarketEIP1559Transaction } = require('@ethereumjs/tx');
var ethers = require('ethers');
var { web3Utils, sendAsync, getEtherscanAddress, numberToString, sleep } = require('./utilities');

module.exports = function sendBlockchainTransaction(provider, fromOrPlainPrivateKey, to, data, value, additionalData) {
    additionalData = additionalData || {};
    var address = fromOrPlainPrivateKey;
    var privateKey;
    try {
        address = new ethers.Wallet(fromOrPlainPrivateKey).address;
        privateKey = fromOrPlainPrivateKey;
    } catch (e) {}
    return new Promise(async (ok, ko) => {
        try {

            var chainId = provider.chainId = parseInt(provider.chainId || await sendAsync(provider, 'eth_chainId'));

            var tx = {};
            tx.from = address;
            tx.to = to || null;
            tx.data = data || '0x';
            tx.value = web3Utils.toHex(value || '0');
            (additionalData.gasLimit || provider.gasLimit) && (tx.gas = tx.gasLimit = web3Utils.toHex(additionalData.gasLimit || provider.gasLimit));

            var lastBlock = (await sendAsync(provider.web3Forked?.currentProvider || provider, 'eth_getBlockByNumber', 'latest', false));

            var gasPrice = additionalData.gasPrice || (provider.accounts && (provider.gasPrice || provider.knowledgeBase?.gasPrice)) || (lastBlock.baseFeePerGas && parseFloat(web3Utils.fromWei(numberToString(parseInt(lastBlock.baseFeePerGas)), 'gwei')));
            while(!gasPrice) {
                try {
                    gasPrice = await gasCalculator();
                    if(gasPrice) {
                        break;
                    }
                } catch(e) {
                }
                await sleep(5000);
            }
            gasPrice = gasPrice && numberToString(gasPrice);
            gasPrice && console.log("gasPrice", gasPrice, "GWEI");
            gasPrice = web3Utils.toWei(gasPrice, 'gwei');
            tx.gasPrice = web3Utils.toHex(gasPrice);

            if (provider.accounts && !privateKey) {
                try {
                    provider.accounts.indexOf(tx.from) === -1 && await provider.unlockAccounts(tx.from);
                } catch (e) {}
                return ok(await sendAsync(provider, 'eth_getTransactionReceipt', await sendAsync(provider, 'eth_sendTransaction', tx)));
            }

            tx.nonce = web3Utils.toHex(await sendAsync(provider, 'eth_getTransactionCount', address, "latest"));

            if(lastBlock.baseFeePerGas) {
                tx.chainId = web3Utils.numberToHex(chainId);
                tx.type = '0x2';
                tx.maxPriorityFeePerGas = web3Utils.toHex(numberToString(parseInt(tx.maxFeePerGas = web3Utils.toHex(numberToString(parseInt(tx.baseFeePerGas = tx.gasPrice) * 1.3).split('.')[0])) * 0.3).split('.')[0]);
                delete tx.gasPrice;
            }

            if(!tx.gasLimit) {
                tx.gas = tx.gasLimit = web3Utils.toHex(lastBlock.gasLimit);
                try {
                    tx.gas = tx.gasLimit = web3Utils.toHex(numberToString(parseInt(await sendAsync(provider, 'eth_estimateGas', tx))));
                } catch(e) {
                    console.log("Gas estimation failed");
                }
            }

            (tx.gas || tx.gasLimit) && !additionalData.bypassGasEstimation && !provider.bypassGasEstimation && await sendAsync(provider, 'eth_estimateGas', tx);
            delete tx.gas;

            var sendTransaction;
            if (privateKey) {
                var serializedTx;
                if(tx.baseFeePerGas) {
                    var transaction = FeeMarketEIP1559Transaction.fromTxData(tx, {
                        chain: chainId
                    });
                    var signedTransaction = transaction.sign(Buffer.from(privateKey, 'hex'));
                    serializedTx = '0x' + signedTransaction.serialize().toString('hex');
                } else {
                    serializedTx = await new ethers.Wallet(privateKey).signTransaction(tx);
                }
                sendTransaction = sendAsync(provider, 'eth_sendRawTransaction', serializedTx);
            } else {
                sendTransaction = sendAsync(provider, 'eth_sendTransaction', tx);
            }
            var transactionHash = await sendTransaction;
            console.log(new Date().toUTCString(), "Transaction!", getEtherscanAddress('tx/' + transactionHash, chainId));
            var timeout = async function() {
                var receipt = await sendAsync(provider, 'eth_getTransactionReceipt', transactionHash);
                return receipt && receipt.blockNumber ? ok(receipt) : setTimeout(timeout, 3000);
            };
            setTimeout(timeout);
        } catch (e) {
            return ko(e);
        }
    });
}