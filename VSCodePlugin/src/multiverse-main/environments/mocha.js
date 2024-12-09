var consume = require('./consumer');

(global.assert = require('assert')).catchCall = async function catchCall(funct, message, print) {
    var done = false;
    try {
        var f = funct
        while(f && (f.then || f instanceof Function)) {
            f = f.then ? await f : f();
        }
        done = true;
    } catch (e) {
        print && console.error(e);
        (!message || message.toLowerCase() === 'revert') && global.assert.strictEqual((e.message || e).indexOf('revert'), (e.message || e).length - ('revert'.length), e.message || e);
        message && message.toLowerCase() !== 'revert' && global.assert.notStrictEqual((e.message || e).toLowerCase().indexOf(message.toLowerCase()), -1, e.message || e);
        return e.receipt;
    }
    global.assert(!done, "This shouldn't happen");
};
global.assert.equals = global.assert.strictEqual;

module.exports = exports.mochaHooks = {
    beforeAll : () => consume('onStart'),
    async beforeEach() {
        return consume('onStep', this?.currentTest?.parent?.title, this?.currentTest?.title);
    },
    afterAll : () => consume('onStop'),
    afterEach() {
        return consume('afterStep', this?.currentTest?.parent?.title, this?.currentTest?.title);
    }
};