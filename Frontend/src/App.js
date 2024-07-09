import './App.css';
import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import FolderTree, { testData } from 'react-folder-tree';
import 'react-folder-tree/dist/style.css';

function App() {
  const [palletColor, setPalletColor] = useState('pallet2'); // Initial value set to pallet2

  const onTreeStateChange = (state, event) => console.log(state, event);

  const handlePalletClick = (color) => {
    setPalletColor(color);
  };

  const valueData = `<div class='custom-box-area'>
    <h1>This is a heading</h1>
    <p>This is a paragraph.</p>
</div>`;

  const pallets = ['pallet1', 'pallet2', 'pallet3', 'pallet4', 'pallet5', 'pallet6', 'pallet7', 'pallet8', 'pallet9'];

  return (
    <div className="App">
      <div className='top-bar'></div>
      <div className='editor-group'>
        <div className='editor'>
          <div className='editor-layers' style={{ position: 'relative' }}>
            <div>
              <ul className='editor-actions'>
                <li className='editor-home-button'><img src='home.png' alt="Home" /></li>
                <li className='editor-play-button'><img src='wand.png' alt="Play" /></li>
                <li className='editor-settings-button'><img src='settings.png' alt="Settings" /></li>
              </ul>
            </div>
            <div className='editor-tree'>
              <FolderTree data={testData} showCheckbox={false} onChange={onTreeStateChange} />
            </div>
            <div className='navigation-tree-footer'>
              <ul>
                <li>&copy; Copyright 2024 Kaiten</li>
                <li>
                  <svg fill="#000" height="10px" width="10px" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 490 490" >
                    <g>
                      <g>
                        <path d="M245,0C109.5,0,0,109.5,0,245s109.5,245,245,245s245-109.5,245-245S380.5,0,245,0z M245,449.3 c-112.6,0-204.3-91.7-204.3-204.3S132.4,40.7,245,40.7S449.3,132.4,449.3,245S357.6,449.3,245,449.3z"/>
                        <path d="M290.9,224.1h-25v-95.9c0-11.5-9.4-20.9-20.9-20.9s-20.9,9.4-20.9,20.9V245c0,11.5,9.4,20.9,20.9,20.9h45.9 c11.5,0,20.9-9.4,20.9-20.9S302.3,224.1,290.9,224.1z"/>
                      </g>
                    </g>
                  </svg> 20ms</li>
                  <li><b>HTML</b></li>
              </ul>
            </div>
          </div>
          <div className='editor-file-nav'>
            <div className='editor-area-group'>
              <div className='file-navbar'>
                <ul>
                  <li className='active-file'>module.html</li>
                  <li>module.css</li>
                  <li>module.js</li>
                </ul>
              </div>
              <div className='editor-area'>
                <Editor height="90vh" defaultLanguage="html" theme="vs-dark" className='editor-wrapper' defaultValue={valueData} />
              </div>
            </div>
            <div className='preview-area-group'>
              <div className='preview-area-group-header'>
                <h3>Preview</h3>
                <button className='preview-export-button'>Export</button>
                <button className='preview-upload-button'> Upload to IPFS</button>
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
              <div className={`preview-area-output ${palletColor}`}>
                <div className='custom-box-area'>
                  <div>
                    <h1>This is a heading</h1>
                    <p>This is a paragraph.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
