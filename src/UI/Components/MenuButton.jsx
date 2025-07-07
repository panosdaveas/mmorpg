// MenuItem.jsx - Specialized GameUIComponent for menu options
import React from 'react';
import GameUIComponent from '../GameUIComponent';
import { SpriteSheet } from '../SpriteSheet';

// Load sprite sheet at module level
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

// Load sprites immediately when module loads
initSpriteSheet();

const MenuButton = ({
    // text,
    isSelected = false,
    onSelect,
    tabIndex,
    sprites = {
        normal: buttonSpriteSheet?.sprites[4][0],   // sprite sheet[0][0] ✅
        hover: buttonSpriteSheet?.sprites[4][1],    // sprite sheet[0][1] ✅
        pressed: buttonSpriteSheet?.sprites[4][2],  // sprite sheet[0][2] ✅
        disabled: buttonSpriteSheet?.sprites[4][3]  // sprite sheet[0][3] ✅
    },
    alpha = {
        normal: 0.8,
        hover: 1,
    },
    ...props
}) => {
    return (
        <GameUIComponent
            // text={text}
            state={isSelected ? 'hover' : 'normal'}
            onClick={onSelect}
            tabIndex={tabIndex}
            // className="menu-item"
            sprites={sprites}
            alpha={alpha}
            style={{
                // position: 'relative',
                zIndex: 1,
                width: '16px',
                height: '16px',
                minWidth: '16px',
                padding: '8px',
            }}
            {...props}
        >
        </GameUIComponent>
    );
};

export default MenuButton;