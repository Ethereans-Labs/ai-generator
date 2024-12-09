require('dotenv').config();

var environmentName = process.env.ENVIRONMENT || 'traditional';

var environment = require('./verticalizations/' + (environmentName));

function onError(hookName, e) {
    var message = `Error in environment ${environmentName} while calling ${hookName} hook`;
    var cause = e.stack || e.message || e || '<no error message provided>';
    console.error(message + ':');
    console.error(cause);
    throw new Error(message + ':\n' + cause);
}

async function consume() {
    var args = [...arguments];
    var hookName = args.shift();
    var hook = environment[hookName];
    if(!hook) {
        return;
    }
    try {
        var res = hook.apply(this, args);
        return res && res.then ? await res : res;
    } catch(e) {
        return onError(hookName, e);
    }
}

consume.start = async function run() {
    await consume('onStart');
    await consume('onStep');
    await require('./runner')();
    await consume('afterStep');
    await consume('onStop');
};

module.exports = consume;