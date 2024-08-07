"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
function activate(context) {
    console.log('Congratulations, your extension "webpackkainext" is now active!');
    // Register the command for the webview
    let webview = vscode.commands.registerCommand("webpackkainext.webview", () => {
        let panel = vscode.window.createWebviewPanel("webview", "Web View", vscode.ViewColumn.One, {
            enableScripts: true,
        });
        let scriptSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "build", "static", "js", "main.0538bf69.js"));
        let cssSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "build", "static", "css", "main.885137a7.css"));
        console.log("CSS Source:", cssSrc.toString());
        console.log("Script Source:", scriptSrc.toString());
        panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>React App</title>
    <link href="${cssSrc}" rel="stylesheet" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="${scriptSrc}"></script>
  </body>
</html>`;
    });
    // Register the webview view provider for the sidebar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("webpackkainextSidebarView", new MyWebviewViewProvider(context)));
    context.subscriptions.push(webview);
}
class MyWebviewViewProvider {
    _context;
    constructor(context) {
        this._context = context;
    }
    resolveWebviewView(webviewView, context, token) {
        webviewView.webview.options = {
            enableScripts: true,
        };
        let scriptSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "build", "static", "js", "main.0538bf69.js"));
        let cssSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "build", "static", "css", "main.885137a7.css"));
        console.log("Sidebar CSS Source:", cssSrc.toString());
        console.log("Sidebar Script Source:", scriptSrc.toString());
        webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <title>React App</title>
    <link href="${cssSrc}" rel="stylesheet" />
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="${scriptSrc}"></script>
</body>
</html>`;
    }
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map