"use strict";
module.exports = {
    tx: null,
    currentStep: null,
    delegateCall: false,
    errors: [],
    parents: [],
    getFrom(step, currentStep) {
        var from = this.delegateCall ? currentStep.from : step.from;
        this.delegateCall = false;
        return from;
    },
    callbacks: {
        DELEGATECALL() {
            var result = this.callbacks.STATICCALL.apply(this, arguments);
            this.delegateCall = true;
            return result;
        },
        CALLCODE() {
            return this.callbacks.CALL.apply(this, arguments);
        },
        STATICCALL(step, currentStep) {
            var data = step.sliceMemory(parseInt(step.stack[2]), parseInt(step.stack[3]));
            var extractMethodAndParamsResponse = this.extractMethodAndParams(data);
            var method = extractMethodAndParamsResponse.method;
            var params = extractMethodAndParamsResponse.params;
            currentStep.steps.push({
                type: step.op,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: this.getFrom(step, currentStep),
                to: this.decodeAddress(step.stack[1]),
                value: '0',
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            this.parents.push(currentStep);
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CALL(step, currentStep, tx) {
            var data = step.sliceMemory(parseInt(step.stack[3]), parseInt(step.stack[4]));
            var extractMethodAndParamsResponse = this.extractMethodAndParams(data);
            var method = extractMethodAndParamsResponse.method;
            var params = extractMethodAndParamsResponse.params;
            var type = !tx.incomplete && (!data || data === '0x') ? 'TRANSFER' : step.op;
            currentStep.steps.push({
                type,
                gas: this.toNumberString(step.stack[0]),
                gasCost: this.numberToString(step.gasCost),
                from: this.getFrom(step, currentStep),
                to: this.decodeAddress(step.stack[1]),
                value: this.toNumberString(step.stack[2]),
                data,
                steps: [],
                logs: [],
                result: "0x",
                success: true,
                method,
                params
            });
            this.parents.push(currentStep);
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CREATE(step, currentStep) {
            currentStep.steps.push({
                type: step.op,
                gasCost: this.numberToString(step.gasCost),
                from: this.getFrom(step, currentStep),
                value: this.toNumberString(step.stack[0]),
                data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
                steps: [],
                logs: [],
                result: '0x',
                success: true
            });
            this.parents.push(currentStep);
            return currentStep.steps[currentStep.steps.length - 1];
        },
        CREATE2(step, currentStep) {
            currentStep.steps.push({
                type: step.op,
                gasCost: this.numberToString(step.gasCost),
                from: this.getFrom(step, currentStep),
                value: this.toNumberString(step.stack[0]),
                data: step.sliceMemory(parseInt(step.stack[1]), parseInt(step.stack[2])),
                salt: step.stack[3],
                steps: [],
                logs: [],
                result: '0x',
                success: true
            });
            this.parents.push(currentStep);
            return currentStep.steps[currentStep.steps.length - 1];
        },
        LOG0(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: this.getFrom(step, currentStep),
                topics: [],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG1(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: this.getFrom(step, currentStep),
                topics: [
                    step.stack[2]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG2(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: this.getFrom(step, currentStep),
                topics: [
                    step.stack[2],
                    step.stack[3]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG3(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: this.getFrom(step, currentStep),
                topics: [
                    step.stack[2],
                    step.stack[3],
                    step.stack[4]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        LOG4(step, currentStep, tx) {
            currentStep.logs.push({
                blockHash: tx.blockHash,
                transactionHash: tx.transactionHash,
                blockNumber: tx.blockNumber,
                address: this.getFrom(step, currentStep),
                topics: [
                    step.stack[2],
                    step.stack[3],
                    step.stack[4],
                    step.stack[5]
                ],
                data: step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]))
            });
            return currentStep;
        },
        STOP(_, currentStep, tx) {
            currentStep.terminated = true;
            return (this.parents.length > 0 && this.parents.pop()) || tx;
        },
        INVALID(_, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.success = false;
            currentStep.errorData = "INVALID";
            return (this.parents.length > 0 && this.parents.pop()) || tx;
        },
        RETURN(step, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.type !== 'CREATE' && currentStep.type !== 'CREATE2' && (currentStep.result = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1])));
            try {
                (currentStep.type === 'CREATE' || currentStep.type === 'CREATE2') && globalStackTrace[step.i + 1] && (currentStep.to = this.decodeAddress(globalStackTrace[step.i + 1].stack[globalStackTrace[step.i + 1].stack.length - 1]));
            }
            catch (e) { }
            return (this.parents.length > 0 && this.parents.pop()) || tx;
        },
        REVERT(step, currentStep, tx) {
            currentStep.terminated = true;
            currentStep.success = false;
            currentStep.errorData = step.sliceMemory(parseInt(step.stack[0]), parseInt(step.stack[1]));
            return (this.parents.length > 0 && this.parents.pop()) || tx;
        }
    },
    toHexString(subject) {
        return subject.indexOf && subject.indexOf('0x') === 0 ? subject : '0x' + this.uint8ArrayToHexString(subject);
    },
    toNumberString(subject) {
        return this.numberToString(parseInt(this.toHexString(subject)));
    },
    extractMethodAndParams(data) {
        return {
            method: '0x' + (data === '0x' ? '' : data.substring(2, 10)),
            params: '0x' + (data.length > 10 ? data.substring(10) : '')
        };
    },
    fillWithZeroes(x) {
        while (x.length < 64) {
            x = "0" + x;
        }
        return x;
    },
    uint8ArrayToHexString(arr, prefix) {
        var s = prefix || '';
        for (var i = 0; i < arr.length; i++) {
            var x = arr[i].toString(16);
            x = (x.length === 1 ? '0' : '') + x;
            s += x;
        }
        return s;
    },
    decodeAddress(data) {
        var s = "0x";
        for (var i = 26; i < data.length; i++) {
            s += data[i].toString(16);
        }
        return s;
    },
    instrumentStep(step, currentStep) {
        var stp = {};
        var stack = [];
        for (var i = 0; i < step.stack.length(); i++) {
            stack.push("0x" + this.fillWithZeroes(step.stack.peek(i).toString(16)));
        }
        try {
            var newTo = this.uint8ArrayToHexString(step.contract.getAddress(), "0x");
            if (!currentStep.to || currentStep.to.toLowerCase() !== newTo.toLowerCase()) {
                currentStep.to = currentStep.to || newTo;
                currentStep = this.currentStep = (this.parents.length > 0 && this.parents.pop()) || this.tx;
            }
        }
        catch (e) {
        }
        stp.op = step.op.toString();
        stp.from = currentStep.to;
        stp.originalStack = step.stack;
        stp.stack = stack;
        stp.originalMemory = step.memory;
        stp.gasCost = step.getGas();
        stp.memory = step.memory;
        stp.steps = [];
        var uint8ArrayToHexString = this.uint8ArrayToHexString;
        stp.sliceMemory = function sliceMemory(offset, length) {
            if (length === 0) {
                return "0x";
            }
            var arr = stp.memory.slice(offset, offset + length);
            return uint8ArrayToHexString(arr, '0x');
        };
        return stp;
    },
    numberToString(num) {
        if (num === undefined || num === null) {
            num = 0;
        }
        if ((typeof num).toLowerCase() === 'string') {
            return num.split(',').join('');
        }
        var numStr = String(num);
        if (Math.abs(num) < 1.0) {
            var e = parseInt(num.toString().split('e-')[1]);
            if (e) {
                var negative = num < 0;
                if (negative)
                    num *= -1;
                num *= Math.pow(10, e - 1);
                numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
                if (negative)
                    numStr = "-" + numStr;
            }
        }
        else {
            var e = parseInt(num.toString().split('+')[1]);
            if (e > 20) {
                e -= 20;
                num /= Math.pow(10, e);
                numStr = num.toString() + (new Array(e + 1)).join('0');
            }
        }
        return numStr;
    },
    init(transaction, stackTrace) {
        var data = transaction.input || transaction.data;
        this.currentStep = this.tx = {
            blockNumber: transaction.blockNumber,
            blockHash: transaction.blockHash,
            transactionHash: transaction.hash || transaction.transactionHash,
            type: transaction.contractAddress ? 'CREATE' : (data && data != '0x') ? 'CALL' : 'TRANSFER',
            gasLimit: this.numberToString(transaction.gas),
            gasPrice: this.numberToString(transaction.gasPrice),
            gas: this.numberToString(stackTrace.gas),
            from: transaction.from,
            to: transaction.to || transaction.contractAddress,
            data: transaction.contractAddress ? '0x' : data,
            value: this.numberToString(transaction.value),
            result: stackTrace.returnValue || '0x',
            success: true,
            steps: [],
            logs: []
        };
        var extractMethodAndParamsResponse = this.extractMethodAndParams(this.tx.data);
        var method = extractMethodAndParamsResponse.method;
        var params = extractMethodAndParamsResponse.params;
        this.tx.method = method;
        this.tx.params = params;
    },
    step(log) {
        try {
            if (!this.tx) {
                this.init({
                    from: this.uint8ArrayToHexString(log.contract.getCaller(), "0x"),
                    to: this.uint8ArrayToHexString(log.contract.getAddress(), "0x"),
                    data: this.uint8ArrayToHexString(log.contract.getInput(), "0x"),
                    value: this.numberToString(this.uint8ArrayToHexString(log.contract.getValue(), "0x")),
                    result: '0x',
                    success: true,
                    steps: [],
                    logs: []
                }, { gas: '0' });
            }
            var lastTerminatedStep;
            try {
                lastTerminatedStep = this.currentStep.steps[this.currentStep.steps.length - 1];
                if (lastTerminatedStep && (lastTerminatedStep.type === 'CREATE' || lastTerminatedStep.type === 'CREATE2') && lastTerminatedStep.terminated && !lastTerminatedStep.to && log.stack) {
                    try {
                        lastTerminatedStep.to = this.uint8ArrayToHexString(log.stack.peek(0), "0x");
                    }
                    catch (e) { }
                }
            }
            catch (ex) { }
            this.callbacks[log.op.toString()] && (this.currentStep = this.callbacks[log.op.toString()].apply(this, [this.instrumentStep(log, this.currentStep), this.currentStep, this.tx]) || this.currentStep);
        }
        catch (e) {
            this.errors.push(e.stack || e.message || e);
        }
    },
    result(ctx) {
        this.tx = this.tx || {};
        this.tx.result = this.uint8ArrayToHexString(ctx.output, "0x");
        this.tx.errors = this.errors;
        return this.tx;
    },
    fault() {
    }
};
//# sourceMappingURL=transactionTracer.js.map