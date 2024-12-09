"use strict";
var transactionDumper = require("../../transactionDumper");
var blockchainConnection = require('../../blockchainConnection');
var procedure = require('../../procedure');
var { web3Utils } = require("../../utilities");
var transactionDumperInstance;
function printKnowledgeBase(knowledgeBase) {
    var clone = { ...knowledgeBase };
    delete clone.from;
    console.log('\n===\n', 'Knowledge Base', JSON.stringify(clone), '\n===\n');
}
function tryDumpTransactions(transactionHashesToDumpString) {
    if (!transactionHashesToDumpString || transactionHashesToDumpString.trim().length === 0) {
        return;
    }
    return transactionHashesToDumpString.split(',').map(it => it.trim());
}
module.exports = {
    async onStart() {
        global.accounts = (global.web3 = (transactionDumperInstance = await transactionDumper(await blockchainConnection(process.env))).web3).currentProvider.accounts;
        await procedure(global.web3);
    },
    async onStop() {
        printKnowledgeBase(web3.currentProvider.knowledgeBase);
        global.accounts && global.accounts.map(web3Utils.toChecksumAddress).forEach((it, i) => (global.wellknownAddresses = global.wellknownAddresses || {})[it] = global.wellknownAddresses[it] || `${(i = parseInt(i)) < 15 ? 'Multiverse' : 'Unlocked'} Account #${i < 15 ? i : (i - 15)}`);
        !process.env.PRODUCTION && await transactionDumperInstance.dumpBlocks(process.env.BLOCKCHAIN_SERVER_PORT, tryDumpTransactions(process.env.TRANSACTION_HASHES_TO_DUMP));
        if (process.env.BLOCKCHAIN_SERVER_PORT) {
            console.log("=== SERVER ===", "Pid:", process.pid, "Ppid:", process.ppid);
            await new Promise(() => { });
        }
    },
    onStep(title, label) {
        transactionDumperInstance.setLabels(title, label);
    }
};
//# sourceMappingURL=traditional.js.map