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
          <div className='editor-layers'>
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
