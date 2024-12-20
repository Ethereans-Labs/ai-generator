import * as vscode from "vscode";
import { Credentials } from "./credentials";
import path from "path";

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("Activating Kaiten extension");

    const secretStorage: vscode.SecretStorage = context.secrets;

    const credentials = new Credentials();
    await credentials.initialize(context);
    console.log("Credentials initialized successfully");

    const signInCommand = vscode.commands.registerCommand(
      "extension.getGitHubUser",
      async () => {
        try {
          const userInfo = await credentials.signIn(secretStorage);
          
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

    // Command to preview a URL
    const previewCommand = vscode.commands.registerCommand(
      "extension.preview",
      async (previewUrl: string) => {
        try {
          await vscode.env.openExternal(vscode.Uri.parse(previewUrl));
          console.log("Preview URL opened:", previewUrl);
        } catch (error) {
          console.error("Error opening preview URL:", error);
          vscode.window.showErrorMessage("Failed to open the preview URL.");
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
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "kaiten.extensionSidebarView", // Updated to match the unique ID
        new ColorsViewProvider(context)
      )
    );
    console.log(
      "WebviewViewProvider registered for 'kaiten.extensionSidebarView'"
    );
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
      "main.f65d1a75.js"
    )
  );

  const cssSrc = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "build",
      "static",
      "css",
      "main.f3770834.css"
    )
  );

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
                window.vscode = vscode;
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
  panel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.command) {
        case "openPreview":
          // Use the extension preview command to open the URL
          vscode.commands.executeCommand("extension.preview", message.url);
          break;
        // Additional commands can be added here
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
  private _modules: any[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    console.log("calleeed called");
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
                    font-weight: normal;
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
                 <li
                  class="editor-play-button"
                  >

                    <svg width="20px" height="20px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#ffffff" d="M4.6 15c-.9-2.6-.6-4.6-.5-5.4 2.4-1.5 5.3-2 8-1.3.7-.3 1.5-.5 2.3-.6-.1-.3-.2-.5-.3-.8h2l1.2-3.2-.9-.4-1 2.6h-1.8C13 4.8 12.1 4 11.1 3.4l2.1-2.1-.7-.7L10.1 3c-.7 0-1.5 0-2.3.1L5.4.7l-.7.7 2.1 2.1C5.7 4.1 4.9 4.9 4.3 6H2.5l-1-2.6-.9.4L1.8 7h2C3.3 8.3 3 9.6 3 11H1v1h2c0 1 .2 2 .5 3H1.8L.6 18.3l.9.3 1-2.7h1.4c.4.8 2.1 4.5 5.8 3.9-.3-.2-.5-.5-.7-.8-2.9 0-4.4-3.5-4.4-4zM9 3.9c2 0 3.7 1.6 4.4 3.8-2.9-1-6.2-.8-9 .6.7-2.6 2.5-4.4 4.6-4.4zm14.8 19.2l-4.3-4.3c2.1-2.5 1.8-6.3-.7-8.4s-6.3-1.8-8.4.7-1.8 6.3.7 8.4c2.2 1.9 5.4 1.9 7.7 0l4.3 4.3c.2.2.5.2.7 0 .2-.2.2-.5 0-.7zm-8.8-3c-2.8 0-5.1-2.3-5.1-5.1s2.3-5.1 5.1-5.1 5.1 2.3 5.1 5.1-2.3 5.1-5.1 5.1z"/><path fill="none" d="M0 0h24v24H0z"/></svg>
                  </li>
                  <li
                  class="editor-play-button"
                  >

                  <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17 7.82959L18.6965 9.35641C20.239 10.7447 21.0103 11.4389 21.0103 12.3296C21.0103 13.2203 20.239 13.9145 18.6965 15.3028L17 16.8296" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
<path d="M13.9868 5L12.9934 8.70743M11.8432 13L10.0132 19.8297" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
<path d="M7.00005 7.82959L5.30358 9.35641C3.76102 10.7447 2.98975 11.4389 2.98975 12.3296C2.98975 13.2203 3.76102 13.9145 5.30358 15.3028L7.00005 16.8296" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
</svg>

                     </li>
              </ul>
            </div>
            <ul id="file-list"></ul>
            <div class="editor-tree" onClick="event.stopPropagation()">
                
                <ul id="module-list">
                    <!-- Modules will be rendered here -->
                </ul>
            </div>
             <div class="navigation-tree-footer">
              <ul>
                <li>&copy; Copyright 2024 Kaiten</li>
                <li>
                  <svg
                    fill="#000"
                    height="10px"
                    width="10px"
                    version="1.1"
                    id="Capa_1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 490 490">
                    <g>
                      <g>
                        <path d="M245,0C109.5,0,0,109.5,0,245s109.5,245,245,245s245-109.5,245-245S380.5,0,245,0z M245,449.3 c-112.6,0-204.3-91.7-204.3-204.3S132.4,40.7,245,40.7S449.3,132.4,449.3,245S357.6,449.3,245,449.3z" />
                        <path d="M290.9,224.1h-25v-95.9c0-11.5-9.4-20.9-20.9-20.9s-20.9,9.4-20.9,20.9V245c0,11.5,9.4,20.9,20.9,20.9h45.9 c11.5,0,20.9-9.4,20.9-20.9S302.3,224.1,290.9,224.1z" />
                      </g>
                    </g>
                  </svg>
                  20ms
                </li>
                <li>
                  <b>HTML</b>
                </li>
              </ul>
            </div>
          </div>
            <script>
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;


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
                                '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 6.89963C4.5 6.05956 4.5 5.63952 4.66349 5.31865C4.8073 5.0364 5.03677 4.80693 5.31901 4.66312C5.63988 4.49963 6.05992 4.49963 6.9 4.49963H9.47237C9.84808 4.49963 10.0359 4.49963 10.2065 4.55142C10.3574 4.59727 10.4978 4.67243 10.6197 4.77261C10.7574 4.88577 10.8616 5.04208 11.07 5.35471L11.93 6.64496C12.1384 6.95758 12.2426 7.1139 12.3803 7.22706C12.5022 7.32724 12.6426 7.4024 12.7935 7.44825C12.9641 7.50003 13.1519 7.50003 13.5276 7.50003H17.1C17.9401 7.50003 18.3601 7.50003 18.681 7.66353C18.9632 7.80734 19.1927 8.03681 19.3365 8.31905C19.5 8.63992 19.5 9.05996 19.5 9.90003V16.1C19.5 16.9401 19.5 17.3602 19.3365 17.681C19.1927 17.9633 18.9632 18.1927 18.681 18.3365C18.3601 18.5 17.9401 18.5 17.1 18.5H6.9C6.05992 18.5 5.63988 18.5 5.31901 18.3365C5.03677 18.1927 4.8073 17.9633 4.66349 17.681C4.5 17.3602 4.5 16.9401 4.5 16.1V6.89963Z" stroke="#ffffff"/></svg>' +
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
                                '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 6C6.5 5.17157 7.17157 4.5 8 4.5H13.5L17.5 8.5V18C17.5 18.8284 16.8284 19.5 16 19.5H8C7.17157 19.5 6.5 18.8284 6.5 18V6Z" stroke="#ffffff"/><path d="M13 4.5V9H17.5" stroke="#ffffff" stroke-linejoin="round"/></svg>' +
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

    // Ensure files are sent to the webview
    this.sendFilesToWebview();

    this._view.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "openFile":
            this.handleOpenFile(message.filePath);
            break;
          case "openModal":
          case "openSettingsModal":
            let panel = WebviewManager.getInstance().getPanel();
            if (!panel) {
              await vscode.commands.executeCommand("extension.webview");
              panel = WebviewManager.getInstance().getPanel();
              if (!panel) {
                console.error("Failed to create webview panel");
                return;
              }
            }
            panel.webview.postMessage(message);
            break;

          case "requestModules":
            // Send modules to webview
            this.sendModulesToWebview(this._modules);
            break;
          // Handle other commands if needed
        }
      },
      undefined,
      this._context.subscriptions
    );
  }

  public sendModulesToWebview(modules: any[]) {
    this._modules = modules;
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateModules",
        modules: modules,
      });
    }
  }

  private async handleOpenFile(filePath: string) {
    try {
      const fileUri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileContent).toString("utf8");

      // Get the webview panel for the React app
      let panel = WebviewManager.getInstance().getPanel();

      // If the panel doesn't exist, create it
      if (!panel) {
        await vscode.commands.executeCommand("extension.webview");
        panel = WebviewManager.getInstance().getPanel();
        if (!panel) {
          console.error("Failed to create webview panel");
          return;
        }
      }

      // Send the file name and content to the React app
      panel.webview.postMessage({
        command: "fileDropped",
        fileName: path.basename(filePath),
        content: content,
      });
    } catch (error) {
      console.error("Error opening file:", error);
      vscode.window.showErrorMessage("Failed to open the selected file.");
    }
  }

  /**
   * Retrieves the list of files in the workspace and sends them to the webview.
   */
  private async sendFilesToWebview() {
    if (!this._view) {
      return;
    }

    /**
     * Convert a flat list of files into a tree structure.
     * @param files Array of `vscode.Uri` objects representing files.
     * @returns A nested tree structure.
     */
    const getTreeStructure = (files: vscode.Uri[]) => {
      const root: any = {};

      files.forEach((fileUri) => {
        const parts = vscode.workspace
          .asRelativePath(fileUri.fsPath)
          .split("/");
        let current = root;

        parts.forEach((part, index) => {
          if (!current[part]) {
            current[part] =
              index === parts.length - 1
                ? { path: fileUri.fsPath, type: "file" }
                : { type: "directory", children: {} };
          }
          current = current[part].children || current[part];
        });
      });

      const convertToArray = (node: any): FileNode[] =>
        Object.entries(node).map(([name, value]: [string, any]) => ({
          name,
          type: value.type,
          path: value.path || null,
          children:
            value.type === "directory" ? convertToArray(value.children) : [],
        }));

      return convertToArray(root);
    };

    try {
      // Retrieve all files and directories, excluding `node_modules`.
      const files = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**",
        1000
      );

      // Convert the list of files into a tree structure.
      const fileTree = getTreeStructure(files);

      // Send the tree structure to the webview.
      this._view.webview.postMessage({
        command: "setFiles",
        files: fileTree,
      });
    } catch (error) {
      console.error("Error retrieving workspace files:", error);
      // Notify the webview of the error.
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
  private async openFile(filePath: string) {
    try {
      const fileUri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(fileUri);
    } catch (error) {
      console.error("Error opening file:", error);
      vscode.window.showErrorMessage("Failed to open the selected file.");
    }
  }
}

class WebviewManager {
  private static instance: WebviewManager;
  private panel: vscode.WebviewPanel | undefined;
  private colorsViewProvider: ColorsViewProvider | undefined;

  private constructor() {}

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
}

// This method is called when your extension is deactivated
export function deactivate() {}
