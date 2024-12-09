var compile = require('./compile');
var deployContract = require('./deployContract');
var blockchainCall = require('./blockchainCall');

module.exports = async function test(funct, solidityVersion) {

    var functionText = funct.indexOf('function ') !== -1 ? funct : `function test() external {
            ${funct};
        }`
    var code = `
// SPDX-License-Identifier: MIT
pragma solidity ^${solidityVersion || compile.solidityVersion};

contract Contract {

    ${functionText}
}`;
    var Contract = await compile(code, 'Contract', solidityVersion);
    var contract = await deployContract(new web3.eth.Contract(Contract.abi), Contract.bin);
    var functionName = Contract.abi.filter(it => it.type === 'function')[0].name;
    return await blockchainCall(contract.methods[functionName]);
}