import React, { useState, useEffect } from 'react';
import GridLayout from '../GridLayout';
import MenuItem from '../Components/MenuItem';
import MenuToggle from '../Components/MenuToggle';
import MenuButton from '../Components/MenuButton';
import { SpriteSheet } from '../SpriteSheet';

let buttonSpriteSheet = null;

// Initialize sprite sheet immediately
const initSpriteSheet = async () => {
    try {
        const sheet = new SpriteSheet({
            resource: '/sprites/pointers.png', // Your 1x4 sprite sheet
            frameSize: [16, 16],                   // Adjust to your sprite size
            hFrames: 4,                            // normal, hover, pressed, disabled
            vFrames: 5                             // 1 row
        });

        await sheet.init();
        buttonSpriteSheet = sheet;
        console.log('MenuItem: Sprite sheet loaded');
    } catch (error) {
        console.warn('MenuItem: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const PlayersSubmenu = ({ title, visible, onBack, root }) => {
    if (!visible) return null;
    if (title === 'players') {
        console.log(root?.multiplayerManager.getRemotePlayers());
    }

    return (
        <div className="submenu-placeholder">
            <div className="game-ui-text">Submenu: {title}</div>
            <div className="game-ui-text">This is a placeholder for the {title} submenu</div>
            <div className="game-ui-text">Content will be implemented later...</div>
            <GridLayout
                rows={1}
                cols={4}
                // gap='32px'
                // className="main-menu-grid"
            >
                <span>
                    <MenuButton
                        sprites={{
                            normal: buttonSpriteSheet?.sprites[1][0],   // sprite sheet[0][0] ✅
                            hover: buttonSpriteSheet?.sprites[1][1],    // sprite sheet[0][1] ✅
                            pressed: buttonSpriteSheet?.sprites[1][2],  // sprite sheet[0][2] ✅
                            disabled: buttonSpriteSheet?.sprites[1][3]  // sprite sheet[0][3] ✅
                        }}
                    />
                    </span>
                    <span>
                    <MenuButton
                        sprites={{
                            normal: buttonSpriteSheet?.sprites[0][0],   // sprite sheet[0][0] ✅
                            hover: buttonSpriteSheet?.sprites[0][1],    // sprite sheet[0][1] ✅
                            pressed: buttonSpriteSheet?.sprites[0][2],  // sprite sheet[0][2] ✅
                            disabled: buttonSpriteSheet?.sprites[0][3]  // sprite sheet[0][3] ✅
                        }}
                    />
                </span>
            </GridLayout>
            <button
                className="back-button"
                onClick={onBack}
            >
                ← Back to Main Menu
            </button>
        </div>
    );
};

export default PlayersSubmenu;