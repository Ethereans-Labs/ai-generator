"use strict";
var fs = require('fs');
var { resolve } = require('../utilities');
function getFileAndContent(number) {
    var filePath = resolve(`node_modules/ganache/dist/node/${number}.js`);
    return {
        filePath,
        content: fs.readFileSync(filePath, "utf-8")
    };
}
function saveFile(filePath, content) {
    try {
        fs.unlinkSync(filePath);
    }
    catch (e) { }
    fs.writeFileSync(filePath, content);
}
function instrumentVar(content, search, change) {
    var blockchain = search;
    if (content.indexOf(blockchain) !== -1) {
        content = content.split(blockchain).join(change);
    }
    return content;
}
var changes = {
    blockchain: {
        'd(this,a,A,"f")': 'd(this,a,this.blockchain=A,"f")',
        'd(this,o,T,"f")': 'd(this,o,this.blockchain=T,"f")',
        'h(this,a,T,"f")': 'h(this,a,this.blockchain=T,"f")',
        'f(this,a,T,"f")': 'f(this,a,this.blockchain=T,"f")'
    },
    api: {
        'd(this,n,new y.default': 'd(this,n,this.api=new y.default',
        'h(this,n,new b.default': 'h(this,n,this.api=new b.default',
        'f(this,n,new m.default': 'f(this,n,this.api=new m.default'
    }
};
var functions = {
    1(content) {
        Object.values(changes).forEach(changeValue => Object.entries(changeValue).forEach(entry => content = instrumentVar(content, entry[0], entry[1])));
        return content;
    },
};
var Ganache = (function getInstrumentedGanache() {
    var entries = Object.entries(functions);
    for (var entry of entries) {
        var { filePath, content } = getFileAndContent(entry[0]);
        var editedContent = entry[1](content.toString() + "");
        if (editedContent !== content) {
            saveFile(filePath, editedContent);
        }
    }
    Ganache = require("ganache");
    return Ganache;
})();
module.exports = Ganache;
//# sourceMappingURL=ganache.js.map