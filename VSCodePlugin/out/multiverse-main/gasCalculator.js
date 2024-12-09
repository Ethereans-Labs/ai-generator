"use strict";
var { numberToString, web3Utils } = require('./utilities');
var url = "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice&apikey=9D13ZE7XSBTJ94N9BNJ2MA33VMAY2YPIRB";
var request = require('http' + (url.indexOf('https') === 0 ? 's' : ''));
module.exports = function calculate() {
    return new Promise(function (ok) {
        var backup = function backup() {
            return ok(null);
        };
        request.get(url, res => {
            res.setEncoding("utf8");
            let body = "";
            res.on("data", data => {
                body += data;
            });
            res.on("end", () => {
                try {
                    var bodyJSON = JSON.parse(body);
                    var gas = numberToString(parseInt(bodyJSON.result));
                    gas = parseFloat(web3Utils.fromWei(gas, "gwei"));
                    return ok(numberToString(parseInt(numberToString(gas * 1.3))));
                }
                catch (e) {
                    console.error(e);
                    backup();
                }
            });
            res.on("error", function (e) {
                console.error(e);
                backup();
            });
        });
    });
};
//# sourceMappingURL=gasCalculator.js.map