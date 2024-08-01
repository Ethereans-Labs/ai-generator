import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "webpackkainext" is now active!'
  );

  // Register the command for the webview
  let webview = vscode.commands.registerCommand(
    "webpackkainext.webview",
    () => {
      let panel = vscode.window.createWebviewPanel(
        "webview",
        "Web View",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );

      let scriptSrc = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "build",
          "static",
          "js",
          "main.45308fd0.js"
        )
      );
      let cssSrc = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "build",
          "static",
          "css",
          "main.5e2ed47f.css"
        )
      );

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
    }
  );

  // Register the webview view provider for the sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "webpackkainextSidebarView",
      new MyWebviewViewProvider(context)
    )
  );

  context.subscriptions.push(webview);
}

class MyWebviewViewProvider implements vscode.WebviewViewProvider {
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };

    let scriptSrc = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "build",
        "static",
        "js",
        "main.45308fd0.js"
      )
    );
    let cssSrc = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._context.extensionUri,
        "media",
        "build",
        "static",
        "css",
        "main.5e2ed47f.css"
      )
    );

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
export function deactivate() {}
