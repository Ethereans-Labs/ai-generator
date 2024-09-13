import React, { useState } from 'react';
import './PalletMenu.css';

const PalletMenu = ({ pallets, selectedPallet, onPalletChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handlePalletClick = (pallet) => {
    onPalletChange(pallet);
    setMenuOpen(false);
  };

  return (
    <div className="pallet-menu">
      <div className="selected-pallet-display" onClick={toggleMenu}>
        <div className={`${selectedPallet} selected-pallet`}></div>
      </div>
      {menuOpen && (
        <ul className="preview-background-color-pallet">
          {pallets.filter(pallet => pallet !== selectedPallet).map((pallet) => (
            <li
              key={pallet}
              className={`${pallet}`}
              onClick={() => handlePalletClick(pallet)}
            ></li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PalletMenu;
