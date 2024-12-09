var { BN } = require('ethereumjs-util');

var queue = [];

function enqueue(data) {
    queue.push(data);
    queue.length === 1 && exec(queue[0]);
}

function dequeue() {
    queue.shift();
    queue.length > 0 && exec(queue[0]);
}

async function exec(data) {
    var { caller, args, ok, ko } = data;
    try {
        return ok(await debug_traceTransaction.apply(caller, args));
    } catch(e) {
        return ko(e);
    }
}

function editLogContract(log, start, stop, val) {
    var contractValue = val ? log.stack.peek(2) : 0;
    var inputStart = parseInt("0x" + (log.stack.peek(start).toString(16)));
    var inputStop = inputStart + parseInt("0x" + (log.stack.peek(stop).toString(16)));
    var contractInput = log.memory.slice(inputStart, inputStop);
    log.contract.getInput = () => contractInput;
    log.contract.getValue = () => contractValue;
}

var logDB = {
    getBalance(address) {
        return web3.eth.getBalance(address);
    },
    getNonce(address) {
        return web3.eth.getTransactionCount(address);
    },
    getCode(address) {
        return web3.eth.getCode(address);
    },
    getState(address, hash) {
        return web3.eth.getStorageAt(address, hash);
    },
    exists(address) {
        var _this = this;
        return new Promise(async function(ok, ko) {
            try {
                if(new BN(await _this.getBalance(address)) > 0) {
                    return ok(true);
                }
                if(new BN(await _this.getNonce(address)) > 0) {
                    return ok(true);
                }
                if((await _this.getCode(address)).length > 0) {
                    return ok(true);
                }
                return ok(false);
            } catch(e) {
                return ko(e);
            }
        });
    }
};

var logContractEditor = {
    CALL(log) {
        editLogContract(log, 3, 4, true);
    },
    STATICCALL(log) {
        editLogContract(log, 2, 3);
    },
    CALLCODE(log) {
        this.CALL.apply(this, arguments);
    },
    DELEGATECALL() {
        this.STATICCALL.apply(this, arguments);
    },
    RETURN(log, logCTX) {
        var returnStart = parseInt("0x" + (log.stack.peek(0).toString(16)));
        var returnStop = parseInt("0x" + (log.stack.peek(1).toString(16)));
        logCTX.output = log.memory.slice(returnStart, returnStart + returnStop);
    }
};

function step(event, logCTX, tracer) {

    if(!tracer) {
        return;
    }

    var logObject = {
        op : {
            isPush : () => event.opcode.name.indexOf('PUSH') === 0,
            toString : () => event.opcode.name,
            toNumber : () => 0
        },
        memory : {
            slice : (start, stop) => {
                var sliced = event.memory.slice(start, stop);
                var result = [];
                for(var it of sliced) {
                    result.push(it);
                }
                return result;
            },
            getUint : offset => new BN(event.memory[offset]).toString('hex')
        },
        stack : {
            peek(idx) {
                var elem = event.stack[(event.stack.length - 1) - idx];
                if(!elem.oldToString) {
                    var ts = elem.oldToString = elem.toString;
                    elem.toString = function toString() {
                        var args = [...arguments];
                        args[0] = args[0] === 16 ? 'hex' : args[0];
                        return ts.apply(elem, args);
                    };
                }
                return elem;
            },
            length : () => event.stack.length
        },
        contract : {
            getCaller : () => typeof event.address === 'string' ? Buffer.from(event.address.substring(2), 'hex') : event.address,
            getAddress : () => typeof event.codeAddress === 'string' ? Buffer.from(event.codeAddress.substring(2), 'hex') : event.codeAddress,
            getValue : () => event.value || Buffer.from('0', 'hex'),
            getInput : () => event.input || Buffer.from('', 'hex')
        },
        getPC : () => event.pc,
        getGas : () => new BN(event.gasLeft).toString(),
        getCost : () => event.opcode.fee,
        getRefund : () => event.refund || 0,
        getError : () => event.error || undefined
    };

    logContractEditor[event.opcode.name] && logContractEditor[event.opcode.name](logObject, logCTX);

    tracer.step && tracer.step.apply(tracer, [logObject, logDB]);
}

module.exports = function schedule() {
    var caller = this;
    var args = [...arguments];
    return new Promise(function(ok, ko) {
        enqueue({
            caller,
            args,
            ok,
            ko
        });
    });
}

async function debug_traceTransaction(provider, old_debug_traceTransaction, transactionHash, options) {

    var tracer;
    if(options && options.tracer) {
        try {
            tracer = Function(options.tracer)();
        } catch(e) {
            try {
                tracer = Function("return " + options.tracer)();
            } catch(ex) {
                throw e;
            }
        }

        if(!tracer) {
            throw new Error('Could not find tracer');
        }

        //void(delete require.cache[require.resolve('./transactionTracer')], tracer=require('./transactionTracer'));//Uncomment to debug transactionTracer
    }

    var receipt = {
        ...(await provider.api.eth_getTransactionReceipt.apply(provider.api, [transactionHash])),
        ...(await provider.api.eth_getTransactionByHash.apply(provider.api, [transactionHash]))
    };

    Object.entries(receipt).forEach(it => receipt[it[0]] = it[1] ? it[1].bufferValue || it[1].toString() : null);

    var contractCaller = receipt.from;
    var contractAddress = receipt.contractAddress || receipt.to;
    var contractValue = receipt.value === '0x' || receipt.value === '0x0' ? [] : receipt.value;
    var contractInput = receipt.input === '0x' ? [] : receipt.input;

    var logCTX = {
        type : receipt.contractAddress ? 'CREATE' : 'CALL',
        from : contractCaller,
        to : contractAddress,
        input : contractInput,
        gas : new BN(receipt.gas).toString(),
        value : contractValue,
        block : new BN(receipt.blockNumber).toString(),
        output : [],
        gasUsed : new BN(receipt.gasUsed).toString(),
        time : new Date().getTime()
    };

    var _context;
    var firstStepDone = false;

    function internalStep(event) {
        if(event.context !== _context) {
            return;
        }
        firstStepDone = true;
        step(event.data, logCTX, tracer);
    }

    function before(event) {
        provider.off("ganache:vm:tx:before", before);
        internalStep({
            context : (_context = _context || event.context || {}),
            data : {
                opcode : {name : 'FAKE_INIT'},
                address : contractCaller,
                codeAddress : contractAddress,
                input : contractInput,
                value : contractValue
            }
        });
        tracer && provider.on("ganache:vm:tx:step", internalStep);
        setTimeout(dequeue);
    }
    provider.on("ganache:vm:tx:before", before);

    var result;
    var error;
    try {
        result = await old_debug_traceTransaction.apply(provider.api, [transactionHash, options]);
        if(!tracer) {
            return result;
        }
    } catch(e) {
        error = e;
    }

    tracer && provider.off("ganache:vm:tx:step", internalStep);
    logCTX.time = ((new Date().getTime() - logCTX.time) / 1000) + '';

    if(error) {
        throw error;
    }

    tracer && (!firstStepDone || !_context) && internalStep({
        context : (_context = _context || {}),
        data : {
            opcode : {name : 'FAKE_INIT'},
            address : contractCaller,
            codeAddress : contractAddress,
            input : contractInput,
            value : contractValue
        }
    });

    result = (tracer.result && tracer.result.apply(tracer, [logCTX, logDB])) || null;

    return result;
};