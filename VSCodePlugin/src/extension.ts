// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "webpackkainext" is now active!'
  );

  let webview = vscode.commands.registerCommand(
    "webpackkainext.webview",
    () => {
      let panel = vscode.window.createWebviewPanel(
        "webview",
        "Web View",
        {
          viewColumn: vscode.ViewColumn.One,
        },
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

      console.log(cssSrc, scriptSrc);
      panel.webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>React App</title>
    <link
      href="${cssSrc}"
      rel="stylesheet" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
	<script src="${scriptSrc}"></script>
  </body>
</html>
        `;
    }
  );

  //   // The command has been defined in the package.json file
  //   // Now provide the implementation of the command with registerCommand
  //   // The commandId parameter must match the command field in package.json
  //   const disposable = vscode.commands.registerCommand(
  //     "webpackkainext.helloWorld",
  //     () => {
  //       // The code you place here will be executed every time your command is executed
  //       // Display a message box to the user
  //       vscode.window.showInformationMessage("Hello World from webpackkainext!");
  //     }
  //   );

  context.subscriptions.push(webview);
}

// This method is called when your extension is deactivated
export function deactivate() {}
