import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import Modal from "react-modal";
import PalletMenu from "./PalletMenu";
import SecureStorage from 'secure-web-storage';
import CryptoJS from 'crypto-js';
import JSZip from 'jszip';
//import compile from "./multiverse-main";

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
    const handleConsoleMessage = (event) => {
      if (event.data.type === "log" || event.data.type === "error") {
        setConsoleOutput((prev) => prev + "\n" + event.data.message);
      }
    };

    window.addEventListener("message", handleConsoleMessage);
    return () => {
      window.removeEventListener("message", handleConsoleMessage);
    };
  }, []);

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
        console.log(`File dropped: ${message.fileName}`, message.content);
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

            setModules((prevModules) => {
              const updatedModules = [
                ...prevModules,
                {
                  prompt: '',
                  'module.html': message.content,
                  'module.css': '',
                  'module.js': '',
                },
              ];

              return updatedModules;
            });
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
          <div
            className="editor-layers"
            style={{ position: "relative" }}
            onClick={closeModule}>
            <div>
              <ul className="editor-actions">
                <li className="editor-home-button">
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
                  className="editor-play-button"
                  onClick={handleOpenModal}>
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
                <li className="editor-settings-button">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    onClick={handleOpenSettingsModal}
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
            <div
              className="editor-tree"
              onClick={(e) => e.stopPropagation()}
            >
              <ul>
                {modules.map((module, index) => (
                  <li key={index}>
                    <span onClick={() => handleModuleClick(index)}>
                      {module.prompt}
                    </span>
                    {selectedModuleIndex === index && (
                      <ul className="sub-menu">
                        <li onClick={() => handleFileClick("module.html")}>
                          module.html
                        </li>
                        <li onClick={() => handleFileClick("module.css")}>
                          module.css
                        </li>
                        <li onClick={() => handleFileClick("module.js")}>
                          module.js
                        </li>
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {selectedModule ? (
            <>
              <div className="editor-file-nav">
                <div className="editor-area-group">
                  <div className="file-navbar">
                    <ul>
                      <li
                        className={
                          selectedFile === "file.extension" ? "active-file" : ""
                        }
                        onClick={() => handleFileClick("module.html")}>
                        fileName
                      </li>
                      {selectedModule['module.html'] != '' ?? (
                        <li
                          className={
                            selectedFile === "module.html" ? "active-file" : ""
                          }
                          onClick={() => handleFileClick("module.html")}>
                          module.html
                        </li>)}

                      {selectedModule['module.css'] != '' ?? (
                        <li
                          className={
                            selectedFile === "module.css" ? "active-file" : ""
                          }
                          onClick={() => handleFileClick("module.css")}>
                          module.css
                        </li>)}
                      {selectedModule['module.js'] != '' ?? (
                        <li
                          className={
                            selectedFile === "module.js" ? "active-file" : ""
                          }
                          onClick={() => handleFileClick("module.js")}>
                          module.js
                        </li>)}
                    </ul>
                  </div>
                  <div className="editor-area">
                    {selectedFile && (
                      <Editor
                        height="90vh"
                        language={selectedFile.split(".").pop()}
                        theme="vs-dark"
                        className="editor-wrapper"
                        value={editorContent}
                        onChange={handleEditorChange}
                      />
                    )}
                  </div>
                </div>
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
              </div>
            </>
          ) : (
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
            </div>
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