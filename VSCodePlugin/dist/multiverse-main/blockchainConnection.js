var Web3 = require('web3');
var gasCalculator = require("./gasCalculator");
var Ganache = require('./tools/ganache');
var ganache_debug_traceTransaction = require('./ganache-debug_traceTransaction');
var { web3Utils, sendAsync, sleep } = require('./utilities');

var providerCalls = {
    async fastForward(blocks) {
        var blockNumber = parseInt((await this.blockchain.blocks.latest.header.number).toNumber()) + (blocks = (blocks && parseInt(blocks)) || 1);
        console.log(`=== CHAIN ${this.chainId}, jumping ${blocks} blocks from ${blockNumber - blocks} to ${blockNumber}`);
        for(var i = 0; i < blocks; i++) {
            await this.blockchain.mine(0);
        }
        while (parseInt((await this.blockchain.blocks.latest.header.number).toNumber()) < blockNumber) {
            await sleep(1000);
        }
    },
    async jumpToBlock(block, notIncluded) {
        var currentBlock = parseInt((await this.blockchain.blocks.latest.header.number).toNumber());
        var blocks = parseInt(block || currentBlock) - currentBlock;
        notIncluded && blocks--;
        blocks > 0 && await this.fastForward(blocks);
    },
    async setNextBlockTime(time) {
        await this.blockchain.mine(0, null, time);
    },
    unlockAccounts(accountsInput, noMoney) {
        var _this = this;
        accountsInput = (accountsInput instanceof Array ? accountsInput : [accountsInput]).map(web3Utils.toChecksumAddress);
        return Promise.all(accountsInput.map(it => _this.api.old_evm_addAccount(it, "").then(() => _this.api.personal_unlockAccount(it, "", 0)))).then(() => {
            _this.accounts && _this.accounts.push(...accountsInput.filter(it => _this.accounts.indexOf(it) === -1));
            return !noMoney && _this.setAccountsBalance(accountsInput);
        });
    },
    setAccountsBalance(accountsInput, balances) {
        var _this = this;
        accountsInput = (accountsInput instanceof Array ? accountsInput : [accountsInput]).map(web3Utils.toChecksumAddress);
        var balance = "0x" + (999999999999999*1e18).toString(16);
        balances = balances || accountsInput.map(() => balance);
        balances = (balances instanceof Array ? balances : [balances]).map(it => "0x" + parseInt(it || 0).toString(16)).map(it => it === '0x0' ? balance : it);
        return Promise.all(accountsInput.map((account, i) => _this.api.evm_setAccountBalance(account, balances[i] || balance)));
    }
}

module.exports = async function blockchainConnection(configuration) {
    if(configuration.PRODUCTION) {
        console.log('=== PRODUCTION MODE ===');
        var secondsToWait = parseFloat(configuration.SECONDS_TO_WAIT);
        if(!isNaN(secondsToWait) && secondsToWait) {
            console.log(`Sleep ${secondsToWait} secs...`);
            await sleep(secondsToWait * 1000);
        }
        return new Web3(configuration.BLOCKCHAIN_CONNECTION_STRING);
    }
    return await new Promise(async function(ok, ko) {
        try {
            var options = {
                miner : {
                    blockGasLimit : 10000000
                },
                chain : {
                    asyncRequestProcessing : true,
                    vmErrorsOnRPCResponse : true
                },
                wallet : {
                    totalAccounts : 15,
                    defaultBalance: 999999999999999
                },
                database : {
                    db: require('memdown')()
                }
            };
            configuration.HARDFORK && (options.chain.hardfork = configuration.HARDFORK);
            var web3Forked;
            if (configuration.BLOCKCHAIN_CONNECTION_STRING) {
                web3Forked = new Web3(configuration.BLOCKCHAIN_CONNECTION_STRING);
                options.chain.chainId = await web3Forked.eth.getChainId();
                var block = await web3Forked.eth.getBlock(!configuration.FORK_BLOCK_NUMBER ? "latest" : parseInt(configuration.FORK_BLOCK_NUMBER) || 'latest');
                options.miner.blockGasLimit = parseInt(block.gasLimit);
                options.fork = {
                    url : configuration.BLOCKCHAIN_CONNECTION_STRING,
                    blockNumber : parseInt(block.number)
                }
            }
            var onProvider = async function onProvider(provider) {
                try {
                    provider.chainId = parseInt(options?.chain?.chainId || await sendAsync(provider, 'eth_chainId'));

                    var old_debug_traceTransaction = provider.api.debug_traceTransaction;
                    provider.api.debug_traceTransaction = function debug_traceTransaction() {
                        return ganache_debug_traceTransaction.apply(provider.api, [
                            provider,
                            old_debug_traceTransaction,
                            ...arguments
                        ]);
                    };
                    provider.api.old_evm_addAccount = provider.api.evm_addAccount;
                    provider.api.evm_addAccount = function evm_addAccount() {
                        return provider.unlockAccounts.apply(provider, arguments)
                    };
                    if(provider.web3Forked = web3Forked) {

                        var forkBlock = provider.forkBlock = (parseInt(options.fork.blockNumber) + 1);

                        var web3ForLogs = !configuration.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING ? provider.web3Forked : new Web3(configuration.BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING);
                        var normalizeBlockNumber = (n, latestBlock) => n === undefined || n === null || n instanceof Number ? n : n === 'latest' || n === 'pending' ? latestBlock : parseInt(n);
                        var old_eth_getLogs = provider.api.eth_getLogs;
                        var getCachedPastLogs = function getCachedPastLogs(args) {
                            var key = web3Utils.sha3(JSON.stringify(args));
                            if((getCachedPastLogs.cache = getCachedPastLogs.cache || {})[key]) {
                                return getCachedPastLogs.cache[key];
                            }
                            return (getCachedPastLogs.cache[key] = web3ForLogs.eth.getPastLogs(args));
                        };
                        provider.api.eth_getLogs = async function eth_getLogs(args) {
                            var latestBlock = (await provider.blockchain.blocks.latest.header.number).toNumber();
                            var startBlock = normalizeBlockNumber(args.fromBlock, latestBlock) || 0;
                            var endBlock = normalizeBlockNumber(args.toBlock, latestBlock) || latestBlock;
                            startBlock = startBlock > endBlock ? 0 : startBlock;
                            endBlock = startBlock > endBlock ? latestBlock : endBlock;
                            var promises = [];
                            startBlock < forkBlock && (promises.push(getCachedPastLogs({
                                ...args,
                                fromBlock : startBlock,
                                toBlock : endBlock >= forkBlock ? (forkBlock - 1) : endBlock
                            })));
                            if(endBlock >= forkBlock) {
                                var localArgs = {
                                    ...args,
                                    fromBlock : startBlock < forkBlock ? forkBlock : startBlock,
                                    toBlock : endBlock
                                }
                                promises.push(old_eth_getLogs.apply(provider.api, [localArgs]))
                            }
                            promises = await Promise.all(promises);
                            promises = promises.reduce((acc, it) => ([...acc, ...it]), []);
                            return promises;
                        };
                    }
                    Object.entries(providerCalls).forEach(it => provider[it[0]] = it[1] instanceof Function ? it[1].bind(provider) : it[1]);
                    var accounts = (await sendAsync(provider, 'eth_accounts')).map(web3Utils.toChecksumAddress);
                    if(!configuration.SIMULATE) {
                        if(configuration.ACCOUNTS) {
                            try {
                                var acc = configuration.ACCOUNTS.split(',').map(it => web3Utils.toChecksumAddress(it.trim()));
                                await provider.unlockAccounts(acc);
                                accounts = [...accounts, ...acc];
                            } catch(e) {
                            }
                        }
                        provider.accounts = accounts;
                        provider.gasLimit = options.miner.blockGasLimit;
                        configuration.BYPASS_GAS_PRICE && console.log('GasPrice', provider.gasPrice = await gasCalculator(), 'GWEI');
                    }
                    var web3 = new Web3(provider, null, { transactionConfirmationBlocks: 1 });
                    var blocksToJump = parseInt(configuration.BLOCKS_TO_JUMP || 0);
                    blocksToJump && await provider.fastForward(blocksToJump);
                    return ok(web3);
                } catch(e) {
                    return ko(e);
                }
            };
            if(configuration.BLOCKCHAIN_SERVER_PORT) {
                var server = Ganache.server(options);
                return server.listen(parseInt(configuration.BLOCKCHAIN_SERVER_PORT), err => err ? ko(err) : onProvider(server.provider));
            }
            return onProvider(Ganache.provider(options));
        } catch (e) {
            return ko(e);
        }
    }).catch(console.error)
}