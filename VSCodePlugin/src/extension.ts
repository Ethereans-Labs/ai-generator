import * as vscode from "vscode";
import { Credentials } from "./credentials";
import path from "path";
import { CompileResult } from "multiverse-main";
const multiverse = require('./multiverse-main');

type ModuleFile = "module.html" | "module.css" | "module.js";

interface Module {
    prompt: string;
    "module.html": string;
    "module.css": string;
    "module.js": string;
}

interface ExtensionState {
    modules: Module[];
    selectedModuleIndex: number | null;
    selectedFile: ModuleFile | null;
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        console.log("Activating Kaiten extension");
        const credentials = new Credentials();
        await credentials.initialize(context);
        console.log("Credentials initialized successfully");

        // Attempt compilation on activation, optional
        const contractFileName = "code.sol";
        const files = await vscode.workspace.findFiles(`**/${contractFileName}`, "**/node_modules/**", 1);

        if (files.length === 0) {
            console.warn(`${contractFileName} not found in the workspace. Skipping compilation test.`);
        } else {
            const contractUri = files[0];
            const contractPath = contractUri.fsPath;
            console.log(`Found "${contractFileName}" at: ${contractPath}`);
            try {
                const compiledContract: CompileResult = await multiverse.compile(
                    contractPath,
                    "MyContract",
                    "0.8.0",
                    false
                );
                console.log("Compilation successful:", compiledContract);
            } catch (error) {
                console.error("Compilation failed:", error);
            }
        }

        const signInCommand = vscode.commands.registerCommand(
            "extension.getGitHubUser",
            async () => {
                try {
                    const userInfo = await credentials.signIn();
                    vscode.window.showInformationMessage(
                        `Kaiten: Signed In as '${userInfo.data.login}'`
                    );
                } catch (error) {
                    console.error("Sign-in error:", error);
                    vscode.window.showErrorMessage("Failed to sign in to GitHub.");
                }
            }
        );
        context.subscriptions.push(signInCommand);
        console.log("Sign-in command registered");

        const previewCommand = vscode.commands.registerCommand(
            'extension.preview',
            async (previewUrl: string) => {
                try {
                    await vscode.env.openExternal(vscode.Uri.parse(previewUrl));
                    console.log('Preview URL opened:', previewUrl);
                } catch (error) {
                    console.error('Error opening preview URL:', error);
                    vscode.window.showErrorMessage('Failed to open the preview URL.');
                }
            }
        );
        context.subscriptions.push(previewCommand);
        console.log("Preview command registered");

        // Command to create a webview panel
        const webviewCommand = vscode.commands.registerCommand(
            "extension.webview",
            async () => {
                createWebviewPanel(context);
                console.log("Webview command executed");
            }
        );
        context.subscriptions.push(webviewCommand);
        console.log("Webview command registered");

        // Register the webview view provider for the sidebar
        const colorsProvider = new ColorsViewProvider(context);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                "kaiten.extensionSidebarView",
                colorsProvider
            )
        );
        console.log("WebviewViewProvider registered for 'kaiten.extensionSidebarView'");

        // Also store state in the WebviewManager so we can share with App webview
        WebviewManager.getInstance().setExtensionState({
            modules: [],
            selectedModuleIndex: null,
            selectedFile: null
        });

        WebviewManager.getInstance().setColorsViewProvider(colorsProvider);

    } catch (error) {
        console.error("Error during extension activation:", error);
        vscode.window.showErrorMessage("Kaiten: Failed to activate the extension.");
    }
}

function createWebviewPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        "webview",
        "Kaiten",
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true, // Keeps the webview state
        }
    );

    WebviewManager.getInstance().setPanel(panel);

    const scriptSrc = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
            context.extensionUri,
            "media",
            "build",
            "static",
            "js",
            "main.js" // Adjust to your actual build file name
        )
    );

    const cssSrc = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
            context.extensionUri,
            "media",
            "build",
            "static",
            "css",
            "main.css" // Adjust to your actual build file name
        )
    );

    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kaiten</title>
            <link href="${cssSrc}" rel="stylesheet" />
        </head>
        <body>
            <div id="root"></div>
            <script>
                const vscode = acquireVsCodeApi();
            </script>
            <script src="${scriptSrc}"></script>
        </body>
    </html>`;

    // Listen to messages from the React app
    panel.webview.onDidReceiveMessage(
        async (message) => {
            const state = WebviewManager.getInstance().getExtensionState();

            switch (message.command) {
                case 'requestModules':
                    // Send current modules and selection back
                    panel.webview.postMessage({
                        command: 'updateState',
                        state: state
                    });
                    break;

                case 'moduleClicked':
                    // Update selectedModuleIndex and default selectedFile
                    state.selectedModuleIndex = message.moduleIndex;
                    state.selectedFile = 'module.html';
                    WebviewManager.getInstance().setExtensionState(state);
                    panel.webview.postMessage({
                        command: 'updateState',
                        state: state
                    });
                    break;

                case 'fileClicked':
                    // Update selectedFile
                    state.selectedModuleIndex = message.moduleIndex;
                    state.selectedFile = message.fileName;
                    WebviewManager.getInstance().setExtensionState(state);
                    panel.webview.postMessage({
                        command: 'updateState',
                        state: state
                    });
                    break;

                case 'openModal':
                    // Forward to sidebar or just handle inside same panel?
                    // In this example we just show a message in the same panel
                    panel.webview.postMessage({
                        command: 'openModal'
                    });
                    break;

                case 'openSettingsModal':
                    panel.webview.postMessage({
                        command: 'openSettingsModal'
                    });
                    break;

                case 'createModule':
                    // message.prompt and message.fileContent will be provided
                    const newModule: Module = {
                        prompt: message.prompt,
                        "module.html": message.generated.html,
                        "module.css": message.generated.css,
                        "module.js": message.generated.javascript
                    };
                    state.modules.push(newModule);
                    WebviewManager.getInstance().setExtensionState(state);
                    panel.webview.postMessage({
                        command: 'updateState',
                        state: state
                    });
                    break;

                case 'updateFileContent':
                    // Update file content in selected module
                    if (state.selectedModuleIndex !== null && state.selectedFile) {
                        state.modules[state.selectedModuleIndex][state.selectedFile] = message.value;
                        WebviewManager.getInstance().setExtensionState(state);
                        panel.webview.postMessage({
                            command: 'updateState',
                            state: state
                        });
                    }
                    break;

                case 'importModule':
                    // message.content will be the JSON of the module
                    try {
                        const importedModule: Module = JSON.parse(message.content);
                        state.modules.push(importedModule);
                        WebviewManager.getInstance().setExtensionState(state);
                        panel.webview.postMessage({
                            command: 'updateState',
                            state: state,
                            notification: "Module imported successfully!"
                        });
                    } catch (error) {
                        panel.webview.postMessage({
                            command: 'showNotification',
                            message: "Failed to import module. Invalid JSON."
                        });
                    }
                    break;

                case 'exportModule':
                    // Export selected module as JSON and send content back
                    if (state.selectedModuleIndex !== null) {
                        const moduleToExport = state.modules[state.selectedModuleIndex];
                        const jsonString = JSON.stringify(moduleToExport);
                        panel.webview.postMessage({
                            command: 'exportModule',
                            content: jsonString
                        });
                    } else {
                        panel.webview.postMessage({
                            command: 'showNotification',
                            message: "No module selected."
                        });
                    }
                    break;

                case 'fileDropped':
                    // A file dropped from sidebar
                    const droppedModule: Module = {
                        prompt: '',
                        "module.html": message.content,
                        "module.css": '',
                        "module.js": ''
                    };
                    state.modules.push(droppedModule);
                    WebviewManager.getInstance().setExtensionState(state);
                    panel.webview.postMessage({
                        command: 'updateState',
                        state: state
                    });
                    break;

                case 'openPreview':
                    // message.url
                    vscode.commands.executeCommand('extension.preview', message.url);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

interface FileNode {
    name: string;
    type: "file" | "directory";
    path: string | null;
    children?: FileNode[];
}

class ColorsViewProvider implements vscode.WebviewViewProvider {
    private _context: vscode.ExtensionContext;
    private _view?: vscode.WebviewView;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        console.log("ColorsViewProvider constructor called");
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
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
                    border-bottom: 1px solid #303030;
                }

                .editor-actions li {
                    display: flex;
                    text-align: center;
                    cursor: pointer;
                }

                .size-6 {
                    width:20px;
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
                .sub-menu li {
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"
                    style="width:20px;">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504
                      1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125
                      1.125-1.125h2.25c.621 0 1.125.504
                      1.125 1.125V21h4.125c.621 0 1.125-.504
                      1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </li>
                <li class="editor-play-button">
                  <svg class="size-6" style="width:20px;"
                    viewBox="0 0 510 513"
                    fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M251.5 228.5L267.486 231.818C273.845 233.138
                    278.776 238.172 279.964 244.557L282 255.5M251.5
                    228.5L205.56 219.935C201.024 219.089 199.993
                    213.163 204.031 210.932C225.753 198.93 256.357
                    183.555 266.268 178.609C268.207 177.641
                    269.285 175.547 268.969 173.403L258.61 103.281C257.916
                    98.5861 263.542 95.6567 266.991 98.9171L317.992
                    147.13C319.502 148.556 321.736 148.902 323.606
                    147.997L386.207 117.693C390.457 115.636 394.928
                    120.073 392.902 124.339L362.462 188.421C361.58
                    190.279 361.925 192.486 363.331 193.986L411.241
                    245.09C414.474 248.539 411.557 254.135 406.877
                    253.458L341.349 243.984C339.326 243.692 337.329
                    244.66 336.305 246.429L299.174 310.601C296.803
                    314.698 290.594 313.512 289.901 308.829L282
                    255.5M251.5 228.5L19 465.5L14.6727 470.499C1.51211
                    485.704 16.8038 508.565 35.8814 502.206C36.2884 502.071
                    36.6593 501.844 36.9657 501.544L162.5 378.5M282
                    255.5L218 323M347.5 12.5L342.5 43.5M461.5 49.5L427
                    85M216.5 10L239 54.5M161.5 111L185.5 123M496 163L469.5
                    167M500 296.5L456 273.5M401 351.5L388.5
                    327" stroke="white" stroke-width="19" stroke-linecap="round" />
                  </svg>
                </li>
                <li class="editor-settings-button">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                    viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
                    style="width:20px;"
                    class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M10.343 3.94c.09-.542.56-.94
                      1.11-.94h1.093c.55 0 1.02.398
                      1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142
                      1.205-.108l.737-.527a1.125 1.125
                      0 0 1 1.45.12l.773.774c.39.389.44
                      1.002.12 1.45l-.527.737c-.25.35-.272.806-.107
                      1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94
                      1.109v1.094c0 .55-.397 1.02-.94
                      1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107
                      1.204l.527.738c.32.447.269
                      1.06-.12 1.45l-.774.773a1.125 1.125
                      0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55
                      0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125
                      1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125
                      1.125 0 0 1 .12-1.45l.773-.773a1.125
                      1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272
                      1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M15 12a3 3 0 1 1-6 0
                      3 3 0 0 1 6 0Z" />
                  </svg>
                </li>
              </ul>
            </div>
            <div class="editor-tree" onClick="event.stopPropagation()">
                <ul id="module-list"></ul>
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                function renderModules(state) {
                    const moduleList = document.getElementById('module-list');
                    moduleList.innerHTML = '';
                    state.modules.forEach((module, index) => {
                        const li = document.createElement('li');
                        const span = document.createElement('span');
                        span.textContent = module.prompt || "Untitled Module";
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
                                renderModules({modules: message.modules});
                                break;
                            case 'updateState':
                                renderModules(message.state);
                                break;
                        }
                    }
                });

                // Home
                document.querySelector('.editor-home-button').addEventListener('click', () => {
                    // Could be used to reset state or show something else
                    // Up to your logic
                });

                // Create new module (open modal in main webview)
                document.querySelector('.editor-play-button').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openModal' });
                });

                // Open settings
                document.querySelector('.editor-settings-button').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openSettingsModal' });
                });

            </script>
        </body>
        </html>`;

        // Send initial request for modules
        this._view.webview.postMessage({ command: 'requestModules' });
    }
}

class WebviewManager {
    private static instance: WebviewManager;
    private panel: vscode.WebviewPanel | undefined;
    private colorsViewProvider: ColorsViewProvider | undefined;
    private extensionState: ExtensionState = {
        modules: [],
        selectedModuleIndex: null,
        selectedFile: null
    };

    private constructor() { }

    public static getInstance(): WebviewManager {
        if (!WebviewManager.instance) {
            WebviewManager.instance = new WebviewManager();
        }
        return WebviewManager.instance;
    }

    public setPanel(panel: vscode.WebviewPanel) {
        this.panel = panel;
    }

    public getPanel(): vscode.WebviewPanel | undefined {
        return this.panel;
    }

    public setColorsViewProvider(provider: ColorsViewProvider) {
        this.colorsViewProvider = provider;
    }

    public getColorsViewProvider(): ColorsViewProvider | undefined {
        return this.colorsViewProvider;
    }

    public setExtensionState(state: ExtensionState) {
        this.extensionState = state;
    }

    public getExtensionState(): ExtensionState {
        return this.extensionState;
    }
}

// This method is called when your extension is deactivated
export function deactivate() { }
