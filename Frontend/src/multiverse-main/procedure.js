var fs = require('fs');
var path = require('path');
const sendBlockchainTransaction = require('./sendBlockchainTransaction');
var { web3Utils, sendAsync, abi, resolve } = require('./utilities');

var providerCalls = {
    async unlockERC20Tokens(keys, to) {
        keys = keys instanceof Array ? keys : [keys];
        var _this = this;
        to = to || this.accounts[0];
        var realKeys = keys.map(realKey => realKey.indexOf('0x') === 0 ? Object.entries(_this.knowledgeBase.ERC20Tokens).filter(it => web3Utils.toChecksumAddress(it[1].address) === web3Utils.toChecksumAddress(realKey))[0][0] : realKey).filter((it, i, arr) => arr.indexOf(it) === i)
        var tokens = realKeys.map(it => ({
            ..._this.knowledgeBase.ERC20Tokens[it],
            label : it
        }));

        var accounts = tokens.reduce((acc, it) => [...acc, ...(it.holders || [])], []).map(web3Utils.toChecksumAddress).filter((it, i, arr) => arr.indexOf(it) === i);
        await this.unlockAccounts(accounts);

        for(var token of tokens) {
            var tokenAddress = web3Utils.toChecksumAddress(token.address);
            (global.wellknownAddresses = global.wellknownAddresses || {})[tokenAddress] = `${token.label} Token`;
            for(var i in token.holders) {
                var holder = web3Utils.toChecksumAddress(token.holders[i]);
                (global.wellknownAddresses = global.wellknownAddresses || {})[holder] = `${token.label} Token Holder #${parseInt(i) + 1}`;
                var balance = await sendAsync(this, 'eth_call', {
                    to : tokenAddress,
                    data : web3Utils.sha3('balanceOf(address)').substring(0, 10) + abi.encode(["address"], [holder]).substring(2)
                });
                balance = abi.decode(["uint256"], balance)[0].toString();
                var data = web3Utils.sha3('transfer(address,uint256)').substring(0, 10) + abi.encode(["address", "uint256"], [to, balance]).substring(2);
                await sendBlockchainTransaction(this, holder, tokenAddress, data);
            }
        }
    }
}

function retrieveKnowledgeBasesPath() {

    var defaultValue = 'resources/knowledgeBases';

    try {
        return resolve(JSON.parse(fs.readFileSync(resolve('package.json'), 'UTF-8')).multiverse.knowledgeBase || defaultValue);
    } catch(e) {
        return resolve(defaultValue);
    }
}

module.exports = async function procedure(web3) {

    var chainId = parseInt(await web3.eth.getChainId());

    var knowledgeBase = {};
    try {
        var dirname = retrieveKnowledgeBasesPath();
        var dumpPath = path.resolve(dirname, `${chainId}.json`);
        knowledgeBase = {...knowledgeBase, ...JSON.parse(fs.readFileSync(dumpPath, 'utf-8'))};
        knowledgeBase.from = knowledgeBase.fromAddress;
        if(process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.indexOf(',') === -1) {
            knowledgeBase = {...knowledgeBase, fromAddress : web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address, from : process.env.PRIVATE_KEY};
        }
        if(process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.indexOf(',') !== -1) {
            delete knowledgeBase.fromAddress
            knowledgeBase.from = process.env.PRIVATE_KEY.split(',').map(privateKey => ({
                address : web3.eth.accounts.privateKeyToAccount(privateKey).address,
                privateKey
            }))
        }
    } catch(e) {
    }
    console.log("Chain ID", chainId);
    if(knowledgeBase.fromAddress || knowledgeBase.from) {
        if(knowledgeBase.fromAddress) {
            try {
                console.log("Main Address", knowledgeBase.fromAddress);
                global.accounts && await web3.currentProvider.unlockAccounts(knowledgeBase.fromAddress);
                (global.wellknownAddresses = global.wellknownAddresses || {})[web3Utils.toChecksumAddress(knowledgeBase.fromAddress)] = ("Main Address #" + chainId);
            } catch(e) {
            }
        } else {
            try {
                knowledgeBase.from.forEach((it, i) => console.log("Main Address #" + i, it.address));
                global.accounts && await web3.currentProvider.unlockAccounts(knowledgeBase.from.map(it => it.address));
                knowledgeBase.from.forEach((it, i) => (global.wellknownAddresses = global.wellknownAddresses || {})[web3Utils.toChecksumAddress(it.address)] = ("Main Address #" + chainId + "_" + i));
            } catch(e) {
            }
        }
        Object.entries(providerCalls).forEach(it => web3.currentProvider[it[0]] = it[1] instanceof Function ? it[1].bind(web3.currentProvider) : it[1]);
    }

    web3.currentProvider.knowledgeBase = knowledgeBase;
}