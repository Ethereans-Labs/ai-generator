var fs = require('fs');
var path = require('path');

var blockchainConnection = require('../../blockchainConnection');
var transactionDumper = require("../../transactionDumper");
var procedure = require('../../procedure');
var { web3Utils, abi, VOID_ETHEREUM_ADDRESS, sleep, ethers } = require('../../utilities');
var sendBlockchainTransaction = require('../../sendBlockchainTransaction');
var blockchainCall = require('../../blockchainCall');
var compile = require('../../compile');
var { rlphash } = require('ethereumjs-util');

var mintMethod = web3Utils.sha3("mint(address,uint256)").substring(0, 10);
var burnMethod = web3Utils.sha3("burn(address,uint256)").substring(0, 10);

function cleanL2ConfigurationParameter(config, name) {
    delete config[name];
    config[name + '_L2'] && (config[name] = config[name + '_L2']);
}

var transactionDumperInstance;
var l2TransactionDumperInstance;

var l1Configuration = {
    ...process.env
};
var l2Configuration = {
    ...l1Configuration
};
cleanL2ConfigurationParameter(l2Configuration, 'BLOCKCHAIN_CONNECTION_STRING');
cleanL2ConfigurationParameter(l2Configuration, 'FORK_BLOCK_NUMBER');
cleanL2ConfigurationParameter(l2Configuration, 'BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING');
cleanL2ConfigurationParameter(l2Configuration, 'BLOCKCHAIN_SERVER_PORT');
cleanL2ConfigurationParameter(l2Configuration, 'TRANSACTION_HASHES_TO_DUMP');
cleanL2ConfigurationParameter(l2Configuration, 'BLOCKS_TO_JUMP_AT_START');
l2Configuration.HARDFORK = 'berlin';

function loadL2AddressesAndCompiledContracts() {
    var data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'optimismDump.json'), 'UTF-8'));

    global.wellknownAddresses = {
        ...global.wellknownAddresses,
        ...data.wellknownAddresses,
        [web3Utils.toChecksumAddress(l2.currentProvider.knowledgeBase.L1StandardBridge)] : "L1StandardBridge",
        [web3Utils.toChecksumAddress(l2.currentProvider.knowledgeBase.OptimismGateway)] : "Optimism Gateway"
    };

    global.compiledContracts = {
        ...global.compiledContracts,
        ...data.compiledContracts
    };
}

var messagePassing = 0;
var immediate = true;
async function waitForMessagePassing(millis) {
    if(immediate) {
        return;
    }
    await sleep(millis || 750);
    while(messagePassing > 0) {
        await sleep(millis || 750);
    }
}

function listenForEvent(web3, address, topics, callback) {
    var args = {
        address,
        topics : (topics instanceof Array ? topics : [topics]).map(it => it.indexOf("0x") === 0 ? it : web3Utils.sha3(it))
    };
    web3.eth.subscribe('logs', args, async function(error, result) {
        if(error || (result && result.error)) {
            return console.error(error || result.error.message || result.error);
        }
        messagePassing++;
        var cb = callback(result);
        try {
            cb && cb.then && await cb;
        } catch(e) {
            console.error(e);
        }
        messagePassing--;
    });
}

function onETHDeposit(result) {
    var payload = abi.decode(["uint256", "bytes"], result.data);
    var to = abi.decode(["address"], result.topics[2])[0];
    var value = payload[0].toString();
    var data = payload[1];
    return onDeposit(l2.currentProvider.knowledgeBase.OVM_ETH, to, value, data);
}

function onERC20Deposit(result) {
    var payload = abi.decode(["address", "uint256", "bytes"], result.data);
    var l2TokenAddress = abi.decode(["address"], result.topics[1])[0];
    var to = payload[0];
    var value = payload[1].toString();
    var data = payload[2];
    return onDeposit(l2TokenAddress, to, value, data);
}

async function onDeposit(l2TokenAddress, to, value, data) {
    console.log("Deposit", {
        l2TokenAddress,
        to,
        value,
        data
    })
    await editBalance(l2.currentProvider.blockchain.vm.stateManager, l2TokenAddress, to, value, true, l2.currentProvider);
}

async function onWithdraw(result) {
    var payload = abi.decode(["address", "uint256", "bytes"], result.data);
    var l1TokenAddress = abi.decode(["address"], result.topics[1])[0];
    var to = payload[0]
    var value = payload[1].toString();
    var data = payload[2];

    console.log("Withdraw", {
        l1TokenAddress,
        to,
        value,
        data
    });

    if(l1TokenAddress === VOID_ETHEREUM_ADDRESS) {
        return await sendBlockchainTransaction(web3.currentProvider, l2.currentProvider.knowledgeBase.OptimismGateway, to, data, value);
    }
    await blockchainCall(await getERC20Token(web3, l1TokenAddress).methods.transfer, to, value, { from : l2.currentProvider.knowledgeBase.OptimismGateway});
}

var FullERC20 = `//SPDX-License-Identifier: MIT
pragma solidity >= 0.7.0;

import "@eth-optimism/contracts/standards/IL2StandardERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface FullERC20 is IL2StandardERC20, IERC20Metadata {}`
var erc20Tokens = {};
async function getERC20Token(web3, tokenAddress) {
    return erc20Tokens[tokenAddress = web3Utils.toChecksumAddress(tokenAddress)] = erc20Tokens[tokenAddress] || new web3.eth.Contract(FullERC20 = FullERC20 instanceof Array ? FullERC20 : (await compile(FullERC20, 'FullERC20', '0.8.9')).abi, tokenAddress);
}

var L2StandardBridge;
async function withdraw(l2TokenAddress, value, from, to) {
    from = from || accounts[0];
    to = to || from;
    try {
        to = new ethers.Wallet(to).address;
    } catch(e) {
    }
    L2StandardBridge = L2StandardBridge || new l2.eth.Contract((await compile("@eth-optimism/contracts/L2/messaging/L2StandardBridge", "L2StandardBridge", '0.8.9')).abi, l2.currentProvider.knowledgeBase.L2StandardBridge);
    await blockchainCall(L2StandardBridge.methods.withdrawTo, l2TokenAddress, value, to, "0", "0x", { from });
    await waitForMessagePassing(900);
}

var L1StandardBridge;
async function deposit(l1TokenAddress, value, from, to) {
    from = from || accounts[0];
    to = to || from;
    try {
        to = new ethers.Wallet(to).address;
    } catch(e) {
    }

    L1StandardBridge = L1StandardBridge || new web3.eth.Contract((await compile("@eth-optimism/contracts/L1/messaging/L1StandardBridge", "L1StandardBridge", '0.8.9')).abi, l2.currentProvider.knowledgeBase.OptimismGateway);
    var args = [
        8_000_000,
        "0x",
        {
            from
        }
    ];
    if(l1TokenAddress === VOID_ETHEREUM_ADDRESS) {
        args.unshift(to);
        args.unshift(L1StandardBridge.methods.depositETHTo);
        args[args.length - 1].value = value;
    } else {
        var fromAddress = from;
        try {
            fromAddress = new ethers.Wallet(fromAddress).address;
        } catch(e) {
        }
        var ERC20 = await getERC20Token(web3, l1TokenAddress);
        var allowance = await blockchainCall(ERC20.methods.allowance, fromAddress, l2.currentProvider.knowledgeBase.OptimismGateway);
        if(parseInt(value) > parseInt(allowance)) {
            await blockchainCall(ERC20.methods.approve, l2.currentProvider.knowledgeBase.OptimismGateway, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", { from });
        }
        args.unshift(value);
        args.unshift(to);
        args.unshift(await getOrCreateL2TokenAddress(l1TokenAddress));
        args.unshift(l1TokenAddress);
        args.unshift(L1StandardBridge.methods.depositERC20To);
    }
    await blockchainCall.apply(this, args);
    await waitForMessagePassing(900);
}

var tokensMap = {};
async function searchForStandardL2Tokens(topics) {
    var args = {
        address : l2.currentProvider.knowledgeBase.L2StandardTokenFactory,
        topics : [
            web3Utils.sha3('StandardL2TokenCreated(address,address)'),
            ...topics.map(it => it instanceof Array ? it : abi.encode(["address"], [it]))
        ],
        fromBlock : '0',
        toBlock : 'latest'
    };
    var logs = l2.eth.getPastLogs(args);
    if(logs && logs.length > 0) {
        var l1 = web3Utils.toChecksumAddress(abi.decode(["address"], logs[0].topics[1])[0]);
        var l2 = web3Utils.toChecksumAddress(abi.decode(["address"], logs[0].topics[2])[0]);
        tokensMap[l1] = l2;
        tokensMap[l2] = l1;
    }
}

async function getL1TokenAddress(l2TokenAddress) {
    return await blockchainCall((await getERC20Token(l2, l2TokenAddress)).methods.l1Token);
}

async function getOrCreateL2TokenAddress(l1TokenAddress) {
    l1TokenAddress = web3Utils.toChecksumAddress(l1TokenAddress);
    if(!tokensMap[l1TokenAddress]) {
        await searchForStandardL2Tokens([l1TokenAddress]);
    }
    if(!tokensMap[l1TokenAddress]) {
        await createL2Token(l1TokenAddress);
        await searchForStandardL2Tokens([l1TokenAddress]);
    }
    return tokensMap[l1TokenAddress];
}

var L2StandardTokenFactory;
async function createL2Token(l1TokenAddress) {
    L2StandardTokenFactory = L2StandardTokenFactory || new l2.eth.Contract((await compile("@eth-optimism/contracts/L2/messaging/L2StandardTokenFactory", "L2StandardTokenFactory", '0.8.9')).abi, l2.currentProvider.knowledgeBase.L2StandardTokenFactory);
    var token = await getERC20Token(web3, l1TokenAddress);
    var name = await blockchainCall(token.methods.name);
    var symbol = await blockchainCall(token.methods.symbol);
    await blockchainCall(L2StandardTokenFactory.methods.createStandardL2Token, l1TokenAddress, name, symbol);
}

function getSlot(value, type) {
    return Buffer.from(web3Utils.sha3(abi.encode([type || "address"], [value]) + (abi.encode(["uint256"], ["0"]).substring(2))).substring(2), 'hex');
}

function setBalance(stateManager, address, subject, balance, provider, tokenOnly) {

    if(!subject) {
        return;
    }

    var balanceBuffer = web3Utils.toBN(balance).toBuffer();

    var promise;

    if(address === VOID_ETHEREUM_ADDRESS || (address === l2.currentProvider.knowledgeBase.OVM_ETH && !tokenOnly)) {
        var subjectBuffer = { buf: Buffer.from(subject.substring(2), 'hex') };
        promise = stateManager.getAccount(subjectBuffer).then(account => {
            account.balance = {
                toArrayLike: () => balanceBuffer
            };
            return stateManager.putAccount(subjectBuffer, account);
        });
    }

    if(address !== VOID_ETHEREUM_ADDRESS) {
        var pr = stateManager.putContractStorage(
            { buf: Buffer.from(address.substring(2), 'hex') },
            getSlot(subject),
            balanceBuffer
        );
        promise = promise ? promise.then(async () => await pr) : pr;
    }

    return provider ? promise.then(async () => await provider.blockchain.mine(0)) : promise;
}

async function getBalance(stateManager, address, subject) {
    if(!subject) {
        return;
    }

    var balance;

    if(address === VOID_ETHEREUM_ADDRESS) {
        balance = (await stateManager.getAccount( { buf: Buffer.from(subject.substring(2), 'hex') } )).balance;
    } else {
        balance = await stateManager.getContractStorage(
            { buf: Buffer.from(address.substring(2), 'hex') },
            getSlot(subject)
        );
    }

    balance = '0x' + balance.toString('hex').split('0x').join('');
    balance = balance === '0x' ? '0' : web3Utils.toBN(balance).toString();

    return balance;
}

async function editBalance(stateManager, address, subject, value, add, provider, tokenOnly) {

    if(!subject) {
        return;
    }

    var balance = await getBalance(stateManager, address, subject);
    balance = balance[`ethereansos${add ? 'Add' : 'Sub'}`](value);
    await setBalance(stateManager, address, subject, balance, provider, tokenOnly);
}

var iOVM_L1BlockNumber_address = { buf: Buffer.from('4200000000000000000000000000000000000013', 'hex') };
async function setL1BlockNumber(stateManager, l2BlockNumber, provider) {
    var l2BlockNumberSlot = getSlot(l2BlockNumber, "uint256");

    var l1BlockNumber = await stateManager.getContractStorage(
        iOVM_L1BlockNumber_address,
        l2BlockNumberSlot
    );
    l1BlockNumber = '0x' + l1BlockNumber.toString('hex').split('0x').join('');
    l1BlockNumber = l1BlockNumber === '0x' ? '0' : web3Utils.toBN(l1BlockNumber).toString();

    if(l1BlockNumber !== '0') {
        return
    }

    l1BlockNumber = parseInt(l2BlockNumber) >= l2.currentProvider.forkBlock
        ? (await web3.currentProvider.blockchain.blocks.latest.header.number).toNumber()
        : abi.decode(["uint256"], await l2.currentProvider.web3Forked.eth.call({
            to : "0x" + iOVM_L1BlockNumber_address.buf.toString('hex').split('0x').join(''),
            data : web3Utils.sha3('getL1BlockNumber()').substring(0, 10)
        }, l2BlockNumber))[0].toString();

    await stateManager.putContractStorage(
        iOVM_L1BlockNumber_address,
        l2BlockNumberSlot,
        web3Utils.toBN(l1BlockNumber).toBuffer()
    );
    provider && await provider.blockchain.mine(0);
}

async function onVMStep(step, bool) {

    if(bool === false) {
        return;
    }

    if(step.opcode && ['CALL', 'CALLCODE', 'CREATE', 'CREATE2'].indexOf(step.opcode.name) === -1) {
        return;
    }

    var tokenAddress = l2.currentProvider.knowledgeBase.OVM_ETH;
    var from = step.address || step.getSenderAddress();
    var to = step.to;
    var value = step.value;
    var data = to && web3Utils.toChecksumAddress("0x" + (to.buf || to).toString('hex').split('0x').join('')) === l2.currentProvider.knowledgeBase.OVM_ETH && step.data;

    if((!step.opcode && !step.to) || step.opcode?.name.indexOf('CREATE') === 0) {
        value = value || step.stack[(step.stack.length - 1) - 0];
        if(step.opcode?.name === 'CREATE2') {
            var start = step.stack[(step.stack.length - 1) - 1];
            start = parseInt("0x" + (start.buf || start).toString('hex').split('0x').join(''));
            var offset = step.stack[(step.stack.length - 1) - 2];
            offset = parseInt("0x" + (offset.buf || offset).toString('hex').split('0x').join(''));
            var payload = step.memory.slice(start, start + offset);
            payload = payload && "0x" + (payload.buf || payload).toString('hex').split('0x').join('');

            var salt = step.stack[(step.stack.length - 1) - 3];
            salt = salt && "0x" + (salt.buf || salt).toString('hex').split('0x').join('');

            var hash = web3Utils.sha3("0x" + [
                "0xff",
                web3Utils.toChecksumAddress("0x" + (from.buf || from).toString('hex').split('0x').join('')),
                salt,
                web3Utils.sha3(payload)
            ].join('').split('0x').join(''));

            to = Buffer.from(hash.substring(26), 'hex');
        } else {
            var nonce = step.nonce || (await this.stateManager.getAccount( { buf: from.buf || from } )).nonce;
            nonce = parseInt("0x" + (nonce.buf || nonce).toString('hex').split('0x').join(''));
            to = Buffer.from(rlphash([web3Utils.toChecksumAddress("0x" + (from.buf || from).toString('hex').split('0x').join('')), nonce]).toString('hex').substring(24), 'hex');
        }
    }

    if(step.opcode?.name.indexOf('CALL') === 0) {
        to = step.stack[(step.stack.length - 1) - 1];
        value = step.stack[(step.stack.length - 1) - 2];
        if(web3Utils.toChecksumAddress("0x" + (to.buf || to).toString('hex').split('0x').join('')) === l2.currentProvider.knowledgeBase.OVM_ETH) {
            var start = step.stack[(step.stack.length - 1) - 3];
            start = parseInt("0x" + (start.buf || start).toString('hex').split('0x').join(''));
            var offset = step.stack[(step.stack.length - 1) - 4];
            offset = parseInt("0x" + (offset.buf || offset).toString('hex').split('0x').join(''));
            data = step.memory.slice(start, start + offset);
        }
    }

    data = data && "0x" + (data.buf || data).toString('hex').split('0x').join('');
    if(data) {
        var method = data.substring(0, 10);

        if(method === mintMethod || method === burnMethod) {
            var decoded = abi.decode(["address", "uint256"], "0x" + data.substring(10));
            tokenAddress = VOID_ETHEREUM_ADDRESS;
            value = web3Utils.toBN(decoded[1].toString()).toBuffer();
            from = Buffer.from(decoded[0].substring(2), 'hex');
            to = method === burnMethod ? undefined : from;
            from = method === burnMethod ? from : undefined;
        }
    }

    from = from && web3Utils.toChecksumAddress("0x" + (from.buf || from).toString('hex').split('0x').join(''));
    to = to && web3Utils.toChecksumAddress("0x" + (to.buf || to).toString('hex').split('0x').join(''));
    value = value && web3Utils.toBN("0x" + (value.buf || value).toString('hex').split('0x').join('')).toString();

    if(!value || value === '0') {
        return;
    }

    await Promise.all([
        editBalance(this.stateManager, tokenAddress, from, value, false, undefined, true),
        editBalance(this.stateManager, tokenAddress, to, value, true, undefined, true)
    ]);
}

var OVM_L1BlockNumber_Code = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OVM_L1BlockNumber {

    mapping(uint256 => uint256) private _blockNumbers;

    function getL1BlockNumber() external view returns (uint256) {
        return _blockNumbers[block.number];
    }
}`;

async function EVMtoOVM(provider) {

    var code = Buffer.from((await compile(OVM_L1BlockNumber_Code, 'OVM_L1BlockNumber'))['bin-runtime'], 'hex');

    var codeHashBuffer = Buffer.from(web3Utils.sha3("0x" + code.toString('hex')).substring(2), 'hex');

    provider.blockchain.vm.stateManager.__proto__._modifyContractStorage = async function _modifyContractStorage(address, modifyTrie) {
        var _this = this;
        return new Promise(async (resolve) => {
            const storageTrie = await _this._getStorageTrie(address);
            modifyTrie(storageTrie, async () => {
                const addressHex = address.buf.toString('hex');
                _this._storageTries[addressHex] = storageTrie;
                const contract = _this._cache.get(address);
                contract.stateRoot = storageTrie.root;
                addressHex === iOVM_L1BlockNumber_address.buf.toString('hex') && contract.codeHash.toString('hex') !== codeHashBuffer.toString('hex') && await _this._trie.db.put(contract.codeHash = codeHashBuffer, code);
                await _this.putAccount(address, contract);
                _this.touchAccount(address);
                resolve();
            });
        });
    }

    function _emit(name, value) {
        return Promise.all([
            this.old_emit.apply(this, arguments),
            (name === 'step' || name === 'beforeTx' || name === 'afterTx') && onVMStep.apply(this, [value, name === 'step' ? undefined : name === 'beforeTx'])
        ]);
    }

    var oldRunTx = provider.blockchain.vm.__proto__.runTx;
    provider.blockchain.vm.__proto__.runTx = function runTx() {
        var args = arguments;
        var vm = this;
        vm.old_emit = vm.old_emit || vm._emit;
        vm._emit = _emit;
        return setL1BlockNumber(vm.stateManager, arguments[0].block.header.number.toNumber()).then(() => oldRunTx.apply(vm, args));
    };

    var oldCreateVmFromStateTrie = provider.blockchain.createVmFromStateTrie;
    provider.blockchain.createVmFromStateTrie = async function createVmFromStateTrie() {
        var vm = await oldCreateVmFromStateTrie.apply(this, arguments);
        vm.old_emit = vm.old_emit || vm._emit;
        vm._emit = _emit;
        await setL1BlockNumber(vm.stateManager, arguments[0].blockNumber.toNumber());
        return vm;
    };
}

async function setAccountsBalance(accountsInput, balances) {
    var balance = "0x" + (999999999999999*1e18).toString(16);
    accountsInput = (accountsInput instanceof Array ? accountsInput : [accountsInput]).map(web3Utils.toChecksumAddress);
    balances = balances || accountsInput.map(() => balance);
    balances = (balances instanceof Array ? balances : [balances]).map(it => "0x" + web3Utils.toBN(it || 0).toBuffer().toString('hex')).map(it => it === '0x0' ? balance : it);

    for(var i in accountsInput) {
        var account = accountsInput[i];
        var bal = balances[i] || balance;
        await Promise.all([
            setBalance(web3.currentProvider.blockchain.vm.stateManager, VOID_ETHEREUM_ADDRESS, account, bal),
            setBalance(l2.currentProvider.blockchain.vm.stateManager, l2.currentProvider.knowledgeBase.OVM_ETH, account, bal)
        ]);
    }
    await Promise.all([
        web3.currentProvider.blockchain.mine(0),
        l2.currentProvider.blockchain.mine(0)
    ]);
};

module.exports = {
    async onStart() {
        var delayStartBlock = true;
        [
            transactionDumperInstance,
            l2TransactionDumperInstance
        ] = await Promise.all([
            transactionDumper(await blockchainConnection(l1Configuration), delayStartBlock),
            transactionDumper(await blockchainConnection(l2Configuration), delayStartBlock)
        ]);
        global.web3 = transactionDumperInstance.web3;
        global.l2 = l2TransactionDumperInstance.web3;
        global.accounts = l2.currentProvider.accounts = web3.currentProvider.accounts;
        l2.currentProvider.gasPrice = "0.001";

        await procedure(web3);
        await procedure(l2);
        loadL2AddressesAndCompiledContracts();

        try {
            await EVMtoOVM(l2TransactionDumperInstance.web3.currentProvider);

            web3.currentProvider.waitForMessagePassing = l2.currentProvider.waitForMessagePassing = waitForMessagePassing;
            web3.currentProvider.setAccountsBalance = l2.currentProvider.setAccountsBalance = setAccountsBalance;
            web3.currentProvider.deposit = deposit;
            l2.currentProvider.withdraw = withdraw;

            listenForEvent(web3, l2.currentProvider.knowledgeBase.OptimismGateway, 'ETHDepositInitiated(address,address,uint256,bytes)', onETHDeposit);
            listenForEvent(web3, l2.currentProvider.knowledgeBase.OptimismGateway, 'ERC20DepositInitiated(address,address,address,address,uint256,bytes)', onERC20Deposit);
            listenForEvent(l2, l2.currentProvider.knowledgeBase.L2StandardBridge, 'WithdrawalInitiated(address,address,address,address,uint256,bytes)', onWithdraw);

            await l2.currentProvider.unlockAccounts(accounts, true);
            var balances = (await Promise.all(accounts.map(account => web3.currentProvider.api.eth_getBalance(account)))).map(it => web3Utils.toBN("0x" + it.toString('hex').split('0x').join('')).toString());
            for(var i in accounts) {
                await setBalance(l2.currentProvider.blockchain.vm.stateManager, l2.currentProvider.knowledgeBase.OVM_ETH, accounts[i], balances[i], parseInt(i) === accounts.length -1 && l2.currentProvider);
            }
            await web3.currentProvider.unlockAccounts(l2.currentProvider.knowledgeBase.OptimismGateway, true);

            immediate = false;
            await waitForMessagePassing();
        } catch(e) {
            console.error(e);
        }

        if(delayStartBlock) {
            await Promise.all([
                transactionDumperInstance.setStartBlock(),
                l2TransactionDumperInstance.setStartBlock()
            ]);
        }
    },
    async onStop() {
        await waitForMessagePassing();
        printKnowledgeBase(web3.currentProvider.knowledgeBase);
        printKnowledgeBase(l2.currentProvider.knowledgeBase);
        global.accounts && global.accounts.map(web3Utils.toChecksumAddress).forEach((it, i) => (global.wellknownAddresses = global.wellknownAddresses || {})[it] = global.wellknownAddresses[it] || `${(i = parseInt(i)) < 15 ? 'Multiverse' : 'Unlocked'} Account #${i < 15 ? i : (i - 15)}`);
        await Promise.all([
            !l1Configuration.PRODUCTION && transactionDumperInstance.dumpBlocks(l1Configuration.BLOCKCHAIN_SERVER_PORT, tryDumpTransactions(l1Configuration.TRANSACTION_HASHES_TO_DUMP)),
            !l2Configuration.PRODUCTION && l2TransactionDumperInstance.dumpBlocks(l2Configuration.BLOCKCHAIN_SERVER_PORT, tryDumpTransactions(l2Configuration.TRANSACTION_HASHES_TO_DUMP))
        ]);
        if(l1Configuration.BLOCKCHAIN_SERVER_PORT || l2Configuration.BLOCKCHAIN_SERVER_PORT) {
            console.log("=== SERVER ===", "Pid:", process.pid, "Ppid:", process.ppid);
            await new Promise(() => {});
        }
    },
    onStep(title, label) {
        transactionDumperInstance.setLabels(title, label);
        l2TransactionDumperInstance.setLabels(title, label);
    }
};

function printKnowledgeBase(knowledgeBase) {
    var clone = { ...knowledgeBase };
    delete clone.from;
    console.log('\n===\n', 'Knowledge Base', JSON.stringify(clone), '\n===\n');
}

function tryDumpTransactions(transactionHashesToDumpString) {
    if(!transactionHashesToDumpString || transactionHashesToDumpString.trim().length === 0) {
        return;
    }
    return transactionHashesToDumpString.split(',').map(it => it.trim());
}