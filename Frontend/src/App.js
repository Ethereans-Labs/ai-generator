import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import Modal from "react-modal";
import PalletMenu from "./PalletMenu";
import SecureStorage from 'secure-web-storage';
import CryptoJS from 'crypto-js';
import JSZip from 'jszip';

Modal.setAppElement("#root");

function App() {
  const [palletColor, setPalletColor] = useState("pallet2");
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [currentFileType, setCurrentFileType] = useState("HTML");
  const [consoleOutput, setConsoleOutput] = useState("");
  const iframeRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [promptValue, setPromptValue] = useState("");
  const [newModuleFile, setNewModuleFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(null);
  const [notification, setNotification] = useState({ message: "", isOpen: false });
  const key = 'KSI-93-JJD23-JDPP-JD';
  const serviceUrl = "http://0.0.0.0:8000/api/code";
  var vscode = null;


  const [currentFile, setCurrentFile] = useState(null);


  useEffect(() => {
    if(!window.vscode){
      vscode = window.acquireVsCodeApi();
    } else {
      vscode = window.vscode;
    }


    window.addEventListener("message", handleMessageFromExtension);

    return () => {
      window.removeEventListener("message", handleMessageFromExtension);
    };


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


  const showNotification = (message) => {
    setNotification({ message, isOpen: true });
    setTimeout(() => {
      setNotification({ message: "", isOpen: false });
    }, 3000);
  };

  const secureStorage = new SecureStorage(localStorage, {
    hash: function (key) {
      return CryptoJS.SHA256(key, key).toString();
    },
    encrypt: function (data) {
      return CryptoJS.AES.encrypt(data, key).toString();
    },
    decrypt: function (data) {
      return CryptoJS.AES.decrypt(data, key).toString(CryptoJS.enc.Utf8);
    }
  });

  const [openAiApiKey, setOpenAiApiKey] = useState(secureStorage.getItem('openAiApiKey') || '');
  const [pinataApiKey, setPinataApiKey] = useState(secureStorage.getItem('pinataApiKey') || '');

  const handleOpenAiApiKeyChange = (e) => {
    setOpenAiApiKey(e.target.value);
  };

  const handlePinataApiKeyChange = (e) => {
    setPinataApiKey(e.target.value);
  };

  const handleSettingsSubmit = (e) => {
    e.preventDefault();
    secureStorage.setItem('openAiApiKey', openAiApiKey);
    secureStorage.setItem('pinataApiKey', pinataApiKey);

    handleCloseSettingsModal();
  };
  const applyModuleToPreview = () => {
    const module = modules[selectedModuleIndex];
    const iframe = iframeRef.current;

    if (iframe) {
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
          </body>
        </html>
      `);
      iframeDoc.close();
    }
  };

  const handleModuleClick = (moduleIndex) => {
    setSelectedModule(modules[moduleIndex]);
    setSelectedFile("module.html");
    setEditorContent(modules[moduleIndex]["module.html"]);
    setCurrentFileType("HTML");
    setSelectedModuleIndex(moduleIndex);
    applyModuleToPreview();
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setEditorContent(modules[selectedModuleIndex][file]);
    setCurrentFileType(file.split(".").pop().toUpperCase());
  };

  const handleCurrentFileClick = () => {
    console.log('currentFile');
    console.log(currentFile);
    setSelectedFile(currentFile.fileName);
    setEditorContent(currentFile.content);
    setCurrentFileType('test');
  };

  const handleExportClick = () => {
    const activeModule = modules[selectedModuleIndex];
    const zip = new JSZip();
    const jsonString = JSON.stringify(activeModule);
    zip.file("module.json", jsonString);

    zip.generateAsync({ type: "blob" }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "module.zip";
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handlePreviewClick = () => {
    const selectedModule = modules[selectedModuleIndex];
    const contentObject = {
      html: selectedModule['module.html'],
      css: selectedModule['module.css'],
      script: selectedModule['module.js'],
    };
    const jsonString = JSON.stringify(contentObject);
    const base64Content = btoa(jsonString);
    const previewUrl = `http://127.0.0.1:3000/#/defiset/${base64Content}`;
    window.open(previewUrl, '_blank');
  };

  const handleEditorChange = (value) => {

    setEditorContent(value);

    const updatedModules = modules.map((module, index) => {
      if (index === selectedModuleIndex) {
        return {
          ...module,
          [selectedFile]: value,
        };
      }
      return module;
    });

    setModules(updatedModules);
    vscode.postMessage({ command: 'updateModules', modules: updatedModules });

    const iframe = iframeRef.current;
    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (selectedFile === "module.html") {
        iframeDoc.body.innerHTML = value;
      } else if (selectedFile === "module.css") {
        const styleElement = iframeDoc.querySelector("style");
        if (styleElement) {
          styleElement.innerHTML = value;
        }
      } else if (selectedFile === "module.js") {
        try {
          iframe.contentWindow.eval(value);
        } catch (e) {
          setConsoleOutput("Error: " + e.message);
        }
      }
    }
  };

  const handlePalletClick = (color) => {
    setPalletColor(color);
  };

 

  useEffect(() => {
    if (selectedFile) {
      applyModuleToPreview();
    }
  }, [editorContent, selectedFile]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message && message.command) {
        switch (message.command) {
          case 'moduleClicked':
            handleModuleClick(message.moduleIndex);
            break;
          case 'fileClicked':
            setSelectedModuleIndex(message.moduleIndex);
            handleFileClick(message.fileName);
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [modules, selectedModuleIndex]);

  const closeModule = () => {
    setSelectedModule(null);
    setSelectedModuleIndex(null);
    setSelectedFile(null);
    setEditorContent("");
    setConsoleOutput("");
  };


  const handleImportChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(event.target.result);
          const jsonContent = await zipContent.file("module.json").async("string");
          const importedModule = JSON.parse(jsonContent);
          const updatedModules = [...modules];
          updatedModules.push(importedModule);
          setModules(updatedModules);
          showNotification("Module imported successfully!");
        } catch (error) {
          console.error("Error importing module:", error);
          alert("Failed to import the module. Please ensure it's a valid zip file containing module.json.");
        }
      };

      reader.readAsArrayBuffer(file);
    }
  };

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
      case 'fileDropped':
        setCurrentFile({
          name: message.fileName,
          content: message.content
        });
        setSelectedFile(message.fileName);
        setEditorContent(message.content);
        setCurrentFileType('test');
        break;
    }
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;
      if (message && message.command) {
        switch (message.command) {
          case 'homeButtonClick':
            break;
          case 'openModal':
            handleOpenModal();
            break;
          case 'openSettingsModal':
            handleOpenSettingsModal();
            break;
          case 'fileDropped':
            console.log(`File dropped: ${message.fileName}`, message.content);
            setSelectedFile(message.fileName);
            setEditorContent(message.content);
           
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleOpenModal, handleOpenSettingsModal, setModules]);

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

        const response = await fetch(serviceUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "openai-api-key": openAiApiKey
          },
          body: JSON.stringify({
            smart_contract_code: fileContent,
            custom_instructions: promptValue
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setModules([
            ...modules,
            {
              "prompt": promptValue,
              "module.html": result.html,
              "module.css": result.css,
              "module.js": result.javascript,
            },
          ]);

          handleCloseModal();
        } else {
          const result = await response.json();
          showNotification(result.detail + '!');
        }
        setIsLoading(false);
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

  return (
    <div className="App">
      <div className="top-bar"></div>
      <div className="editor-group">
        <div className="editor">
            <>
              <div className="editor-file-nav">
                <div className="editor-area-group">
                  <div className="file-navbar">
                    <ul>
                    {selectedFile != null && (
                        <li
                            className={
                                selectedFile === "file.extension" ? "active-file" : ""
                            }
                            onClick={() => handleCurrentFileClick()}>
                            { selectedFile }
                        </li>
                    )}
                    {selectedModule != null && (
                      <>
                        {selectedModule["module.html"] !== "" && (
                          <li
                            className={selectedFile === "module.html" ? "active-file" : ""}
                            onClick={() => handleFileClick("module.html")}
                          >
                            module.html
                          </li>
                        )}
                        {selectedModule["module.css"] !== "" && (
                          <li
                            className={selectedFile === "module.css" ? "active-file" : ""}
                            onClick={() => handleFileClick("module.css")}
                          >
                            module.css
                          </li>
                        )}
                        {selectedModule["module.js"] !== "" && (
                          <li
                            className={selectedFile === "module.js" ? "active-file" : ""}
                            onClick={() => handleFileClick("module.js")}
                          >
                            module.js
                          </li>
                        )}
                      </>
                    )}



                    </ul>
                  </div>
                  <div className="editor-area">
                    {selectedFile && (
                      <Editor
                        height="90vh"
                        //language={selectedFile.split(".").pop()}
                        theme="vs-dark"
                        className="editor-wrapper"
                        value={editorContent}
                        onChange={handleEditorChange}
                      />
                    )}
                  </div>
                </div>

                {selectedModule != null && (
                  <>
                {(selectedModule['module.html'] != '' && selectedModule['module.css'] != '' && selectedModule['module.js'] != '') ?? (
                  <div className="preview-area-group">
                    <div className="preview-area-group-header">
                      <div class="left">
                        <h3>Preview</h3>
                        <button className="preview-export-button" onClick={() => handleExportClick()}>Export</button>
                        <button className="preview-export-button" onClick={() => handlePreviewClick()}>Preview</button>
                        <button className="preview-upload-button">
                          Upload to IPFS
                        </button>
                      </div>
                      <div class="right">
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
                      <pre>{consoleOutput}</pre>
                    </div>
                  </div>
                )}
                </>
                )}



              </div>
            </>
              { /*
            <div className="no-module-message">
              <h2>Import a module or Create a new one!</h2>
              <button onClick={handleOpenModal}>Create New Module</button>
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
            </div>*/}
          
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