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
const credentials_1 = require("./credentials");
async function activate(context) {
    const credentials = new credentials_1.Credentials();
    await credentials.initialize(context);
    console.log('Kaiten extension is now active!');
    // Command to sign in and display user information
    const signInCommand = vscode.commands.registerCommand("extension.getGitHubUser", async () => {
        try {
            const userInfo = await credentials.signIn();
            vscode.window.showInformationMessage(`Kaiten: Signed In as '${userInfo.data.login}'`);
        }
        catch (error) {
            console.error("Sign-in error:", error);
            vscode.window.showErrorMessage("Failed to sign in to GitHub.");
        }
    });
    context.subscriptions.push(signInCommand);
    // Command to preview a URL
    const previewCommand = vscode.commands.registerCommand('extension.preview', async (previewUrl) => {
        try {
            await vscode.env.openExternal(vscode.Uri.parse(previewUrl));
            console.log('Preview URL opened:', previewUrl);
        }
        catch (error) {
            console.error('Error opening preview URL:', error);
            vscode.window.showErrorMessage('Failed to open the preview URL.');
        }
    });
    context.subscriptions.push(previewCommand);
    // Command to create a webview panel
    const webviewCommand = vscode.commands.registerCommand("extension.webview", async () => {
        createWebviewPanel(context);
    });
    context.subscriptions.push(webviewCommand);
    // Register the webview view provider for the sidebar
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("extensionSidebarView", new MyWebviewViewProvider(context)));
}
function createWebviewPanel(context) {
    const panel = vscode.window.createWebviewPanel("webview", "Kaiten", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true, // Keeps the webview state
    });
    const scriptSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "build", "static", "js", "main.38992700.js"));
    const cssSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "build", "static", "css", "main.f3770834.css"));
    panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>React App</title>
          <link href="${cssSrc}" rel="stylesheet" />
      </head>
      <body>
          <noscript>You need to enable JavaScript to run this app.</noscript>
          <div id="root"></div>
          <script src="${scriptSrc}"></script>
         <script>
    window.vscode = acquireVsCodeApi();
</script>
      </body>
  </html>`;
    // Add message listener for incoming messages from the webview
    panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
            case 'openPreview':
                // Use the extension preview command to open the URL
                vscode.commands.executeCommand('extension.preview', message.url);
                break;
            // Additional commands can be added here
        }
    }, undefined, context.subscriptions);
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
        const scriptSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "build", "static", "js", "main.38992700.js"));
        const cssSrc = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "build", "static", "css", "main.f3770834.css"));
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
           <script>
    window.vscode = acquireVsCodeApi();
</script>
        </body>
        </html>`;
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'requestFileList':
                    const fileList = await this.getWorkspaceFileList(webviewView.webview);
                    webviewView.webview.postMessage({ command: 'fileList', fileList });
                    break;
                case 'requestFileContent':
                    const fileContent = await this.getFileContent(message.filePath);
                    webviewView.webview.postMessage({
                        command: 'fileContent',
                        filePath: message.filePath,
                        content: fileContent,
                    });
                    break;
            }
        });
    }
    async getWorkspaceFileList(webview) {
        const filesAndFolders = [];
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            for (const folder of folders) {
                const uri = folder.uri;
                const entries = await this.readDirectoryRecursive(uri, webview);
                filesAndFolders.push(...entries);
            }
        }
        return filesAndFolders;
    }
    async readDirectoryRecursive(uri, webview) {
        const filesAndFolders = [];
        const entries = await vscode.workspace.fs.readDirectory(uri);
        for (const [name, type] of entries) {
            const fileUri = vscode.Uri.joinPath(uri, name);
            const item = {
                path: webview.asWebviewUri(fileUri).toString(),
                fsPath: fileUri.fsPath,
                name,
                type, // 1 for file, 2 for folder
            };
            if (type === vscode.FileType.Directory) {
                const subEntries = await this.readDirectoryRecursive(fileUri, webview);
                item.children = subEntries;
            }
            filesAndFolders.push(item);
        }
        return filesAndFolders;
    }
    async getFileContent(filePath) {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return content.toString();
    }
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map