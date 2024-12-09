import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import Modal from "react-modal";
import PalletMenu from "./PalletMenu";
import JSZip from 'jszip';

Modal.setAppElement("#root");

function App() {
  const [palletColor, setPalletColor] = useState("pallet2");
  const [modules, setModules] = useState([]);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [notification, setNotification] = useState({ message: "", isOpen: false });
  const iframeRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [newModuleFile, setNewModuleFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [pinataApiKey, setPinataApiKey] = useState('');

  const vscode = window.acquireVsCodeApi();

  useEffect(() => {
    // Request initial state from extension
    vscode.postMessage({ command: 'requestModules' });

    window.addEventListener("message", handleMessageFromExtension);

    return () => {
      window.removeEventListener("message", handleMessageFromExtension);
    };
    // eslint-disable-next-line
  }, []);

  const handleMessageFromExtension = (event) => {
    const message = event.data;

    switch (message.command) {
      case 'updateState':
        // State from extension
        const state = message.state;
        setModules(state.modules);
        setSelectedModuleIndex(state.selectedModuleIndex);
        setSelectedFile(state.selectedFile);

        // Update editor content if selectedFile changed
        if (state.selectedModuleIndex !== null && state.selectedFile) {
          setEditorContent(state.modules[state.selectedModuleIndex][state.selectedFile]);
        } else {
          setEditorContent("");
        }

        break;

      case 'openModal':
        setIsModalOpen(true);
        break;

      case 'openSettingsModal':
        setIsSettingsModalOpen(true);
        break;

      case 'showNotification':
        showNotification(message.message);
        break;

      case 'exportModule':
        // Export the received content as a zip
        handleExportContent(message.content);
        break;

      case 'notification':
        showNotification(message.message);
        break;

      default:
        break;
    }
  };

  const showNotification = (message) => {
    setNotification({ message, isOpen: true });
    setTimeout(() => {
      setNotification({ message: "", isOpen: false });
    }, 3000);
  };

  const applyModuleToPreview = () => {
    if (selectedModuleIndex === null) return;
    const module = modules[selectedModuleIndex];
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <style>${module["module.css"]}</style>
        </head>
        <body>
          ${module["module.html"]}
          <script src="https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js"></script>
          <script>${module["module.js"]}</script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  useEffect(() => {
    applyModuleToPreview();
    // eslint-disable-next-line
  }, [editorContent, selectedFile, selectedModuleIndex]);

  const handleEditorChange = (value) => {
    setEditorContent(value);
    vscode.postMessage({
      command: 'updateFileContent',
      value: value
    });
  };

  const handleExportClick = () => {
    vscode.postMessage({ command: 'exportModule' });
  };

  const handleExportContent = async (jsonString) => {
    const activeModule = JSON.parse(jsonString);
    const zip = new JSZip();
    zip.file("module.json", JSON.stringify(activeModule));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "module.zip";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewClick = () => {
    if (selectedModuleIndex === null) return;
    const selectedModule = modules[selectedModuleIndex];
    const contentObject = {
      html: selectedModule['module.html'],
      css: selectedModule['module.css'],
      script: selectedModule['module.js'],
    };
    const jsonString = JSON.stringify(contentObject);
    const base64Content = btoa(jsonString);
    const previewUrl = `http://127.0.0.1:3000/#/defiset/${base64Content}`;
    vscode.postMessage({ command: 'openPreview', url: previewUrl });
  };

  const handleImportChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(event.target.result);
        const jsonContent = await zipContent.file("module.json").async("string");
        vscode.postMessage({
          command: 'importModule',
          content: jsonContent
        });
      } catch (error) {
        showNotification("Failed to import the module. Invalid zip file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenAiApiKeyChange = (e) => {
    setOpenAiApiKey(e.target.value);
  };

  const handlePinataApiKeyChange = (e) => {
    setPinataApiKey(e.target.value);
  };

  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    // Here you could store keys somewhere safe or send to extension if needed
    handleCloseSettingsModal();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setPromptValue("");
    setNewModuleFile(null);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const handleModuleNameChange = (e) => {
    setPromptValue(e.target.value);
  };

  const handleFileChange = (e) => {
    setNewModuleFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (promptValue && newModuleFile) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target.result;
        // Simulate service call or do a fetch here. For now, we just send a message to extension
        // After processing (like calling an API), you'd send a "createModule" command.
        // In practice, you'd call your backend API from here and get generated files:
        // Just simulating generated code:
        const generated = {
          html: "<h1>Hello World</h1>",
          css: "body { background: #eee; }",
          javascript: "console.log('Hello from module.js');"
        };

        vscode.postMessage({
          command: 'createModule',
          prompt: promptValue,
          generated: generated
        });
        setIsLoading(false);
        handleCloseModal();
      };
      reader.readAsText(newModuleFile);
    }
  };

  const pallets = [
    "pallet1",
    "pallet2",
    "pallet3",
    "pallet4",
    "pallet5",
    "pallet6",
    "pallet7",
    "pallet8",
    "pallet9",
  ];

  const [selectedPallet, setSelectedPallet] = useState(pallets[0]);

  const handlePalletChange = (pallet) => {
    setSelectedPallet(pallet);
    setPalletColor(pallet);
  };

  const selectedModule = selectedModuleIndex !== null ? modules[selectedModuleIndex] : null;

  return (
    <div className="App">
      <div className="top-bar"></div>
      <div className="editor-group">
        <div className="editor">
          {!selectedModule ? (
            <div className="no-module-message">
              <h2>Import a module or Create a new one!</h2>
              <button onClick={() => setIsModalOpen(true)}>Create New Module</button>
              <div className="home-area-separator">or</div>
              <button className="import-module" onClick={() => document.getElementById('importHomeModule').click()}>
                Import Module
              </button>
              <input
                type="file"
                id="importHomeModule"
                accept="application/zip"
                style={{ display: 'none' }}
                onChange={handleImportChange}
              />
            </div>
          ) : (
            <>
              <div className="editor-file-nav">
                <div className="editor-area-group">
                  <div className="file-navbar">
                    <ul>
                      {selectedModule['module.html'] !== undefined && (
                        <li className={selectedFile === "module.html" ? "active-file" : ""} onClick={() => setSelectedFile("module.html")}>module.html</li>
                      )}
                      {selectedModule['module.css'] !== undefined && (
                        <li className={selectedFile === "module.css" ? "active-file" : ""} onClick={() => setSelectedFile("module.css")}>module.css</li>
                      )}
                      {selectedModule['module.js'] !== undefined && (
                        <li className={selectedFile === "module.js" ? "active-file" : ""} onClick={() => setSelectedFile("module.js")}>module.js</li>
                      )}
                    </ul>
                  </div>
                  <div className="editor-area">
                    {selectedFile && (
                      <Editor
                        height="90vh"
                        language={selectedFile === "module.js" ? "javascript" : selectedFile === "module.css" ? "css" : "html"}
                        theme="vs-dark"
                        className="editor-wrapper"
                        value={editorContent}
                        onChange={handleEditorChange}
                      />
                    )}
                  </div>
                </div>
                {(selectedModule['module.html'] !== '' &&
                  selectedModule['module.css'] !== '' &&
                  selectedModule['module.js'] !== '') && (
                  <div className="preview-area-group">
                    <div className="preview-area-group-header">
                      <div className="left">
                        <h3>Preview</h3>
                        <button className="preview-export-button" onClick={handleExportClick}>Export</button>
                        <button className="preview-export-button" onClick={handlePreviewClick}>Preview</button>
                        <button className="preview-upload-button">
                          Upload to IPFS
                        </button>
                      </div>
                      <div className="right">
                        <PalletMenu pallets={pallets} selectedPallet={selectedPallet} onPalletChange={handlePalletChange} />
                      </div>
                    </div>
                    <iframe
                      ref={iframeRef}
                      title="Preview"
                      className={`preview-area-output ${palletColor}`}
                    />
                    <div className="console-output">
                      <h3>Console Output</h3>
                      {/* Could display console output if extension sends logs */}
                      <pre></pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={isSettingsModalOpen}
        onRequestClose={handleCloseSettingsModal}
        contentLabel="Settings"
        className="modal"
        overlayClassName="overlay"
      >
        {!isLoading && (
          <>
            <h4 className="margin-top-0">Settings</h4>
            <form onSubmit={handleSettingsSubmit}>
              <label>Open AI API Key</label>
              <input
                type="text"
                placeholder="Insert your Open AI API Key"
                value={openAiApiKey}
                onChange={handleOpenAiApiKeyChange}

              />
              <br />
              <label>Pinata IPFS API Key</label>
              <input
                type="text"
                placeholder="Insert your Pinata IPFS API Key"
                value={pinataApiKey}
                onChange={handlePinataApiKeyChange}

              />
              <br />
              <div className="modal-buttons">
                <button type="button" onClick={handleCloseSettingsModal}>Cancel</button>
                <button type="submit">Save Settings</button>
              </div>
            </form>
          </>
        )}
        {isLoading && (
          <div className="loader" style={{ textAlign: "center", paddingBottom: "20px" }}>
            <h4><b>Processing</b></h4>
            Please wait...
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={handleCloseModal}
        contentLabel="Create New Module"
        className="modal"
        overlayClassName="overlay">
        {!isLoading && (
          <>
            <h4 className={"margin-top-0"}>Create New Module</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}>
              <label>
                <input
                  type="text"
                  placeholder="Add custom instructions*"
                  value={promptValue}
                  onChange={handleModuleNameChange}
                  required
                />
              </label>
              <label className={"margin-top-10"}>
                Smart contract SOL file*
                <input
                  type="file"
                  onChange={handleFileChange}
                  required
                />
              </label>
              <div className={"modal-buttons"}>
                <button
                  type="button"
                  onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit">Submit</button>
              </div>
            </form>
          </>
        )}
        {isLoading && (
          <div
            className="loader"
            style={{ textAlign: "center", paddingBottom: "20px" }}>
            <h4>
              <b>Processing</b>
            </h4>
            Please wait...
          </div>
        )}
      </Modal>
      {notification.isOpen && (
        <div className="notification-popup">
          <p>{notification.message}</p>
        </div>
      )}

    </div>
  );
}

export default App;
