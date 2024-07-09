const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    let disposable = vscode.commands.registerCommand('defiset.openViewer', function () {
        const panel = vscode.window.createWebviewPanel(
            'defisetViewer',
            'Defiset Viewer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))]
            }
        );

        const webviewPath = path.join(context.extensionPath, 'webview.html');
        panel.webview.html = getWebviewContent(webviewPath);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'generate':
                        const response = await generateCode(message.text);
                        panel.webview.postMessage({ command: 'setGeneratedCode', html: response.html, js: response.js });
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

async function generateCode(prompt) {
    const apiKey = 'YOUR_OPENAI_API_KEY';
    const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            prompt: `PROMPT DI PROVA - RISPONDI SEMPRE con un JSON {html:"HTML", js:"JS"}`,
            max_tokens: 150
        })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].text.trim());
}

function getWebviewContent(webviewPath) {
    return fs.readFileSync(webviewPath, 'utf8');
}

exports.activate = activate;

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
