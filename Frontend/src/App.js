import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import Modal from 'react-modal';

Modal.setAppElement('#root');

function App() {
  const [palletColor, setPalletColor] = useState('pallet2');
  const [modules, setModules] = useState({});
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [currentFileType, setCurrentFileType] = useState('HTML');
  const [consoleOutput, setConsoleOutput] = useState('');
  const iframeRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleFile, setNewModuleFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const serviceUrl = 'http://0.0.0.0:8000/api/code';

  const applyModuleToPreview = (moduleName) => {
    const module = modules[moduleName];
    const iframe = iframeRef.current;

    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head>
            <style>${module['module.css']}</style>
          </head>
          <body>
            ${module['module.html']}
            <script>
              (function() {
                var console = {
                  log: function(message) {
                    window.parent.postMessage({ type: 'log', message: message }, '*');
                  },
                  error: function(message) {
                    window.parent.postMessage({ type: 'error', message: message }, '*');
                  }
                };
                try {
                  ${module['module.js']}
                } catch (e) {
                  window.parent.postMessage({ type: 'error', message: e.message }, '*');
                }
              })();
            </script>
          </body>
        </html>
      `);
      iframeDoc.close();
    }
  };

  const handleModuleClick = (moduleName) => {
    setSelectedModule(moduleName);
    setSelectedFile('module.html');
    setEditorContent(modules[moduleName]['module.html']);
    setCurrentFileType('HTML');
    applyModuleToPreview(moduleName);
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setEditorContent(modules[selectedModule][file]);
    setCurrentFileType(file.split('.').pop().toUpperCase());
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);
    setModules({
      ...modules,
      [selectedModule]: {
        ...modules[selectedModule],
        [selectedFile]: value
      }
    });

    const iframe = iframeRef.current;
    if (iframe) {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (selectedFile === 'module.html') {
        iframeDoc.body.innerHTML = value;
      } else if (selectedFile === 'module.css') {
        const styleElement = iframeDoc.querySelector('style');
        if (styleElement) {
          styleElement.innerHTML = value;
        }
      } else if (selectedFile === 'module.js') {
        try {
          iframe.contentWindow.eval(value);
        } catch (e) {
          setConsoleOutput('Error: ' + e.message);
        }
      }
    }
  };

  const handlePalletClick = (color) => {
    setPalletColor(color);
  };

  useEffect(() => {
    const handleConsoleMessage = (event) => {
      if (event.data.type === 'log' || event.data.type === 'error') {
        setConsoleOutput((prev) => prev + '\n' + event.data.message);
      }
    };

    window.addEventListener('message', handleConsoleMessage);
    return () => {
      window.removeEventListener('message', handleConsoleMessage);
    };
  }, []);

  useEffect(() => {
    if (selectedFile) {
      applyModuleToPreview(selectedModule);
    }
  }, [editorContent, selectedFile]);

  const closeModule = () => {
    setSelectedModule(null);
    setSelectedFile(null);
    setEditorContent('');
    setConsoleOutput('');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewModuleName('');
    setNewModuleFile(null);
  };

  const handleModuleNameChange = (e) => {
    setNewModuleName(e.target.value);
  };

  const handleFileChange = (e) => {
    setNewModuleFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (newModuleName && newModuleFile) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileContent = e.target.result;

        const response = await fetch(serviceUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            smart_contract_code: fileContent,
            custom_instructions: newModuleName
          })
        });

        if (response.ok) {
          const result = await response.json();
          setModules({
            ...modules,
            [newModuleName]: {
              "module.html": result.html,
              "module.css": result.css,
              "module.js": result.javascript
            }
          });
          //handleModuleClick(newModuleName);
          handleCloseModal(); 
          
        } else {
          console.error('Error:', response.statusText);
        }
        setIsLoading(false);
      };
      reader.readAsText(newModuleFile);
    }
  };

  const pallets = ['pallet1', 'pallet2', 'pallet3', 'pallet4', 'pallet5', 'pallet6', 'pallet7', 'pallet8', 'pallet9'];

  return (
    <div className="App">
      <div className='top-bar'></div>
      <div className='editor-group'>
        <div className='editor'>
          <div className='editor-layers' style={{ position: 'relative' }} onClick={closeModule}>
            <div>
              <ul className='editor-actions'>
                <li className='editor-home-button'><img src='home.png' alt="Home" /></li>
                <li className='editor-play-button' onClick={handleOpenModal}><img src='wand.png' alt="Play" /></li>
                <li className='editor-settings-button'><img src='settings.png' alt="Settings" /></li>
              </ul>
            </div>
            <div className='editor-tree' onClick={(e) => e.stopPropagation()}>
              <ul>
                {Object.keys(modules).map((moduleName) => (
                  <li key={moduleName}>
                    <span onClick={() => handleModuleClick(moduleName)}>{moduleName}</span>
                    {selectedModule === moduleName && (
                      <ul className={'sub-menu'}>
                        <li onClick={() => handleFileClick('module.html')}>module.html</li>
                        <li onClick={() => handleFileClick('module.css')}>module.css</li>
                        <li onClick={() => handleFileClick('module.js')}>module.js</li>
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className='navigation-tree-footer'>
              <ul>
                <li>&copy; Copyright 2024 Kaiten</li>
                <li>
                  <svg fill="#000" height="10px" width="10px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 490 490" >
                    <g>
                      <g>
                        <path d="M245,0C109.5,0,0,109.5,0,245s109.5,245,245,245s245-109.5,245-245S380.5,0,245,0z M245,449.3 c-112.6,0-204.3-91.7-204.3-204.3S132.4,40.7,245,40.7S449.3,132.4,449.3,245S357.6,449.3,245,449.3z" />
                        <path d="M290.9,224.1h-25v-95.9c0-11.5-9.4-20.9-20.9-20.9s-20.9,9.4-20.9,20.9V245c0,11.5,9.4,20.9,20.9,20.9h45.9 c11.5,0,20.9-9.4,20.9-20.9S302.3,224.1,290.9,224.1z" />
                      </g>
                    </g>
                  </svg> 20ms</li>
                <li><b>{currentFileType}</b></li>
              </ul>
            </div>
          </div>
          {selectedModule ? (
            <>
              <div className='editor-file-nav'>
                <div className='editor-area-group'>
                  <div className='file-navbar'>
                    <ul>
                      <li className={selectedFile === 'module.html' ? 'active-file' : ''} onClick={() => handleFileClick('module.html')}>module.html</li>
                      <li className={selectedFile === 'module.css' ? 'active-file' : ''} onClick={() => handleFileClick('module.css')}>module.css</li>
                      <li className={selectedFile === 'module.js' ? 'active-file' : ''} onClick={() => handleFileClick('module.js')}>module.js</li>
                    </ul>
                  </div>
                  <div className='editor-area'>
                    {selectedFile && (
                      <Editor
                        height="90vh"
                        language={selectedFile.split('.').pop()}
                        theme="vs-dark"
                        className='editor-wrapper'
                        value={editorContent}
                        onChange={handleEditorChange}
                      />
                    )}
                  </div>
                </div>
                <div className='preview-area-group'>
                  <div className='preview-area-group-header'>
                    <h3>Preview</h3>
                    <button className='preview-export-button'>Export</button>
                    <button className='preview-upload-button'>Upload to IPFS</button>
                    <ul className='preview-background-color-pallet'>
                      {pallets.map((pallet) => (
                        <li
                          key={pallet}
                          className={`${pallet} ${palletColor === pallet ? 'selected' : ''}`}
                          onClick={() => handlePalletClick(pallet)}
                        ></li>
                      ))}
                    </ul>
                  </div>
                  <iframe
                    ref={iframeRef}
                    title="Preview"
                    className={`preview-area-output ${palletColor}`}
                  />
                  <div className='console-output'>
                    <h3>Console Output</h3>
                    <pre>{consoleOutput}</pre>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='no-module-message'>
              <img src='https://kaiten.ai/wp-content/uploads/2024/04/logo-icon.png' />
              <h2>Select a module or create a new one!</h2>
              <button onClick={handleOpenModal}>Create New Module</button>
            </div>
          )}
        </div>
      </div>
      <Modal
        isOpen={isModalOpen}
        onRequestClose={handleCloseModal}
        contentLabel="Create New Module"
        className="modal"
        overlayClassName="overlay"
      >
        {!isLoading &&
          <>
            <h2 className={'margin-top-0'}>Create New Module</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <label>
                <input type="text" placeholder='Add custom instructions*' value={newModuleName} onChange={handleModuleNameChange} required />
              </label>
              <label className={'margin-top-10'}>
                Smart contract SOL file*
                <input type="file" onChange={handleFileChange} required />
              </label>
              <div className={'modal-buttons'}>
                <button type="button" onClick={handleCloseModal}>Cancel</button>
                <button type="submit">Submit</button>
              </div>
            </form></>}
        {isLoading && <div className="loader" style={{textAlign: 'center', paddingBottom: '20px'}}><h2><b>Processing</b></h2>Please wait...</div>}
      </Modal>
    </div>
  );
}

export default App;

