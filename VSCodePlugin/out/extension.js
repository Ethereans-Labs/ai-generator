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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const credentials_1 = require("./credentials");
const path_1 = __importDefault(require("path"));
const multiverse = require('./multiverse-main');
async function activate(context) {
    try {
        console.log("Activating Kaiten extension");
        const credentials = new credentials_1.Credentials();
        await credentials.initialize(context);
        console.log("Credentials initialized successfully");
        try {
            const compile = multiverse.compile;
            // Usage
            const compiledContract = await compile("contracts/MyContract.sol", "MyContract", "0.8.0", false);
            console.log("Compilation successful:", compiledContract);
        }
        catch (error) {
            console.error("Compilation failed:", error);
        }
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
        console.log("Sign-in command registered");
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
        console.log("Preview command registered");
        // Command to create a webview panel
        const webviewCommand = vscode.commands.registerCommand("extension.webview", async () => {
            createWebviewPanel(context);
            console.log("Webview command executed");
        });
        context.subscriptions.push(webviewCommand);
        console.log("Webview command registered");
        // Register the webview view provider for the sidebar
        context.subscriptions.push(vscode.window.registerWebviewViewProvider("kaiten.extensionSidebarView", // Updated to match the unique ID
        new ColorsViewProvider(context)));
        console.log("WebviewViewProvider registered for 'kaiten.extensionSidebarView'");
    }
    catch (error) {
        console.error("Error during extension activation:", error);
        vscode.window.showErrorMessage("Kaiten: Failed to activate the extension.");
    }
}
function createWebviewPanel(context) {
    const panel = vscode.window.createWebviewPanel("webview", "Kaiten", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true, // Keeps the webview state
    });
    WebviewManager.getInstance().setPanel(panel);
    const scriptSrc = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "build", "static", "js", "main.e32c8ff2.js"));
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
                // Ensure VS Code API is available
                const vscode = acquireVsCodeApi();

                // Function to handle opening a preview
                const handlePreviewClick = (url) => {
                    vscode.postMessage({ command: 'openPreview', url: url });
                };

                // Example of triggering handlePreviewClick
                window.onload = () => {
                    console.log('VS Code API available:', vscode);
                    // You can call handlePreviewClick with a sample URL for testing
                    // handlePreviewClick('http://127.0.0.1:3000/sample');
                };

                // Your other event listeners or functions can go here
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
class ColorsViewProvider {
    _context;
    _view;
    _modules = [];
    constructor(context) {
        this._context = context;
        console.log("calleeed called");
    }
    resolveWebviewView(webviewView, context, token) {
        console.log("resolveWebviewView called");
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };
        webviewView.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kaiten Explorer</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0px;
                    padding-top:0px;
                }
                ul {
                    list-style: none;
                    padding-left: 20px;
                }
                li {
                    margin: 5px 0;
                    display: flex;
                    align-items: center;
                }
                li span {
                    cursor: pointer;
                    margin-left: 5px;
                }
                .folder {
                    font-weight: bold;
                }
                .icon {
                    width: 16px;
                    height: 16px;
                    margin-right: 5px;
                }
                .editor-actions {
                    display: flex;
                    justify-content: space-around;
                    padding: 0px;
                    margin: 0px 0px 10px 0px;
                    padding: 11px 0px 11px 0px;
                    border-bottom: 1px solid #303030;
                }

                .editor-actions li {
                    display: flex;
                    
                    text-align: center;
                }

                .editor-play-button img {
                    width: 25px;
                    height: 25px;
                    padding: 0px;
                    margin: 0px;
                    filter: invert(1);
                    cursor: pointer;
                }
                
                .editor-play-button img:hover {
                    filter: invert(0.3);
                }
                
                .editor-home-button img {
                    width: 25px;
                    height: 25px;
                    padding: 0px;
                    margin: 0px;
                    filter: invert(1);
                    cursor: pointer;
                }
                
                .editor-home-button img:hover {
                    filter: invert(0.3);
                }
                
                .editor-settings-button img {
                    width: 25px;
                    height: 25px;
                    padding: 0px;
                    margin: 0px;
                    filter: invert(1);
                    cursor: pointer;
                }
                
                .editor-settings-button img:hover {
                    filter: invert(0.3);
                }
                .size-6{
                    width:20px
                }
                .navigation-tree-footer {
                    position: absolute;
                    bottom: 0px;
                    width: calc(100% - 40px);
                    background-color: #FDC740;
                    padding: 10px 20px;
                    color: #000;
                }
                
                .navigation-tree-footer ul {
                    margin: 0px;
                    padding: 0px;
                    display: flex;
                    justify-content: space-between;
                }
                
                .navigation-tree-footer ul li {
                    display: inline-block;
                    font-size: 10px;
                }

                .editor-tree ul {
                    list-style: none;
                    margin-top: 0px;
                    padding-left: 0px;
                }
                
                .editor-tree>ul>li {
                    margin-bottom: 10px;
                }
                
                .editor-tree>ul>li>span {
                    font-weight: bold;
                    font-size: 12px;
                    padding: 10px !important;
                    display: block;
                }
                
                .editor-tree ul li {
                    cursor: pointer;
                    background: #303030;
                    padding: 10px 0px 10px 10px;
                    margin-bottom: 6px;
                }

                .sub-menu{
                    margin-top: 5px!important;
                }
                .sub-menu li{
                    padding: 3px 0px 3px 10px!important;
                    margin:0px!important;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div>
              <ul class="editor-actions">
                <li class="editor-home-button">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="size-6"
                    style={{
                      width: "20px",
                    }}>
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                    />
                  </svg>
                </li>
                <li
                  class="editor-play-button"
                  >
                  <svg
                    class="size-6"
                    style={{
                      width: "20px",
                    }}
                    viewBox="0 0 510 513"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M251.5 228.5L267.486 231.818C273.845 233.138 278.776 238.172 279.964 244.557L282 255.5M251.5 228.5L205.56 219.935C201.024 219.089 199.993 213.163 204.031 210.932C225.753 198.93 256.357 183.555 266.268 178.609C268.207 177.641 269.285 175.547 268.969 173.403L258.61 103.281C257.916 98.5861 263.542 95.6567 266.991 98.9171L317.992 147.13C319.502 148.556 321.736 148.902 323.606 147.997L386.207 117.693C390.457 115.636 394.928 120.073 392.902 124.339L362.462 188.421C361.58 190.279 361.925 192.486 363.331 193.986L411.241 245.09C414.474 248.539 411.557 254.135 406.877 253.458L341.349 243.984C339.326 243.692 337.329 244.66 336.305 246.429L299.174 310.601C296.803 314.698 290.594 313.512 289.901 308.829L282 255.5M251.5 228.5L19 465.5L14.6727 470.499C1.51211 485.704 16.8038 508.565 35.8814 502.206C36.2884 502.071 36.6593 501.844 36.9657 501.544L162.5 378.5M282 255.5L218 323M347.5 12.5L342.5 43.5M461.5 49.5L427 85M216.5 10L239 54.5M161.5 111L185.5 123M496 163L469.5 167M500 296.5L456 273.5M401 351.5L388.5 327"
                      stroke="white"
                      stroke-width="19"
                      stroke-linecap="round"
                    />
                  </svg>
                </li>
                <li class="editor-settings-button">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    style={{
                      width: "20px",
                    }}
                    class="size-6">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                  </svg>
                </li>
              </ul>
            </div>
            <ul id="file-list"></ul>
            <div class="editor-tree" onClick="event.stopPropagation()">
                <ul id="module-list"></ul>
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                 function renderModules(modules) {
                    const moduleList = document.getElementById('module-list');
                    moduleList.innerHTML = '';
                    modules.forEach((module, index) => {
                        const li = document.createElement('li');
                        const span = document.createElement('span');
                        span.textContent = module.prompt;
                        span.addEventListener('click', () => {
                            vscode.postMessage({ command: 'moduleClicked', moduleIndex: index });
                        });

                        const subMenu = document.createElement('ul');
                        subMenu.classList.add('sub-menu');

                        const files = ['module.html', 'module.css', 'module.js'];
                        files.forEach((fileName) => {
                            const fileLi = document.createElement('li');
                            fileLi.textContent = fileName;
                            fileLi.addEventListener('click', (e) => {
                                e.stopPropagation();
                                vscode.postMessage({ command: 'fileClicked', moduleIndex: index, fileName: fileName });
                            });
                            subMenu.appendChild(fileLi);
                        });

                        li.appendChild(span);
                        li.appendChild(subMenu);
                        moduleList.appendChild(li);
                    });
                }

                window.addEventListener('message', (event) => {
                    const message = event.data;
                    if (message && message.command) {
                        switch (message.command) {
                            case 'updateModules':
                                renderModules(message.modules);
                                break;
                            default:
                                break;
                        }
                    }
                });

                window.onload = () => {
                    document.querySelector('.editor-play-button svg').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openModal' });
                    });

                    document.querySelector('.editor-settings-button svg').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openSettingsModal' });
                    });
                };
    
                const toggleDirectory = (element) => {
                    const children = element.parentElement.querySelector("ul");
                    if (children) {
                        children.style.display = children.style.display === "none" ? "block" : "none";
                    }
                };
    
                const addFiles = (files, parent) => {
                    files.forEach((fileNode) => {
                        const li = document.createElement("li");
    
                        if (fileNode.type === "directory") {
                            li.innerHTML = 
                                '<img class="icon" src="https://cdn-icons-png.flaticon.com/512/716/716784.png" alt="folder icon" />' +
                                '<span class="folder">' + fileNode.name + '</span>';
                            const ul = document.createElement("ul");
                            ul.style.display = "none"; 
                            li.appendChild(ul);
                            li.querySelector("span").addEventListener("click", () => {
                                toggleDirectory(li.querySelector("span"));
                            });
                            addFiles(fileNode.children, ul);
                        } else {
                            li.innerHTML = 
                                '<img class="icon" src="https://cdn-icons-png.flaticon.com/512/716/716781.png" alt="file icon" />' +
                                '<span class="file">' + fileNode.name + '</span>';
                            li.querySelector("span").addEventListener("click", () => {
                                vscode.postMessage({ command: "openFile", filePath: fileNode.path });
                            });
                        }
                        parent.appendChild(li);
                    });
                };
    
                window.addEventListener("message", (event) => {
                    const message = event.data;
                    if (message.command === "setFiles") {
                        const fileList = document.getElementById("file-list");
                        fileList.innerHTML = ""; 
                        addFiles(message.files, fileList);
                    }
                });
            </script>
        </body>
        </html>`;
        this.sendFilesToWebview();
        this._view.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "openFile":
                    this.handleOpenFile(message.filePath);
                    break;
                case 'openModal':
                case 'openSettingsModal':
                    let panel = WebviewManager.getInstance().getPanel();
                    if (!panel) {
                        await vscode.commands.executeCommand('extension.webview');
                        panel = WebviewManager.getInstance().getPanel();
                        if (!panel) {
                            console.error('Failed to create webview panel');
                            return;
                        }
                    }
                    panel.webview.postMessage(message);
                    break;
                case 'requestModules':
                    // Send modules to webview
                    this.sendModulesToWebview(this._modules);
                    break;
            }
        }, undefined, this._context.subscriptions);
    }
    sendModulesToWebview(modules) {
        this._modules = modules;
        if (this._view) {
            this._view.webview.postMessage({ command: 'updateModules', modules: modules });
        }
    }
    async handleOpenFile(filePath) {
        try {
            const fileUri = vscode.Uri.file(filePath);
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(fileContent).toString('utf8');
            // Get the webview panel for the React app
            let panel = WebviewManager.getInstance().getPanel();
            if (!panel) {
                await vscode.commands.executeCommand('extension.webview');
                panel = WebviewManager.getInstance().getPanel();
                if (!panel) {
                    console.error('Failed to create webview panel');
                    return;
                }
            }
            panel.webview.postMessage({
                command: 'fileDropped',
                fileName: path_1.default.basename(filePath),
                content: content
            });
        }
        catch (error) {
            console.error("Error opening file:", error);
            vscode.window.showErrorMessage("Failed to open the selected file.");
        }
    }
    async sendFilesToWebview() {
        if (!this._view) {
            return;
        }
        /**
         * Convert a flat list of files into a tree structure.
         * @param files Array of `vscode.Uri` objects representing files.
         * @returns A nested tree structure.
         */
        const getTreeStructure = (files) => {
            const root = {};
            files.forEach((fileUri) => {
                const parts = vscode.workspace.asRelativePath(fileUri.fsPath).split("/");
                let current = root;
                parts.forEach((part, index) => {
                    if (!current[part]) {
                        current[part] = index === parts.length - 1
                            ? { path: fileUri.fsPath, type: "file" }
                            : { type: "directory", children: {} };
                    }
                    current = current[part].children || current[part];
                });
            });
            const convertToArray = (node) => Object.entries(node).map(([name, value]) => ({
                name,
                type: value.type,
                path: value.path || null,
                children: value.type === "directory" ? convertToArray(value.children) : [],
            }));
            return convertToArray(root);
        };
        try {
            const files = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 1000);
            const fileTree = getTreeStructure(files);
            this._view.webview.postMessage({
                command: "setFiles",
                files: fileTree,
            });
        }
        catch (error) {
            console.error("Error retrieving workspace files:", error);
            this._view.webview.postMessage({
                command: "error",
                message: "Failed to retrieve workspace files.",
            });
        }
    }
    /**
     * Opens a file in the editor based on the provided file path.
     * @param filePath The absolute path of the file to open.
     */
    async openFile(filePath) {
        try {
            const fileUri = vscode.Uri.file(filePath);
            await vscode.window.showTextDocument(fileUri);
        }
        catch (error) {
            console.error("Error opening file:", error);
            vscode.window.showErrorMessage("Failed to open the selected file.");
        }
    }
}
class WebviewManager {
    static instance;
    panel;
    colorsViewProvider;
    constructor() { }
    static getInstance() {
        if (!WebviewManager.instance) {
            WebviewManager.instance = new WebviewManager();
        }
        return WebviewManager.instance;
    }
    setPanel(panel) {
        this.panel = panel;
    }
    getPanel() {
        return this.panel;
    }
    setColorsViewProvider(provider) {
        this.colorsViewProvider = provider;
    }
    getColorsViewProvider() {
        return this.colorsViewProvider;
    }
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map