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
            resource: '/sprites/toggle.png', // Your 1x4 sprite sheet
            frameSize: [32, 32],                   // Adjust to your sprite size
            hFrames: 1,                            // normal, hover, pressed, disabled
            vFrames: 2                             // 1 row
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

const MenuToggle = ({
    // text,
    isSelected = false,
    onSelect,
    tabIndex,
    sprites = {
        normal: buttonSpriteSheet?.sprites[0][0],   // sprite sheet[0][0] ✅
        pressed: buttonSpriteSheet?.sprites[1][0],  // sprite sheet[0][2] ✅
        disabled: buttonSpriteSheet?.sprites[1][0]  // sprite sheet[0][3] ✅
    },
    alpha = {
        normal: 1,
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
                width: '32px',
                height: '32px',
                minWidth: '32px',
            }}
            {...props}
        >
        </GameUIComponent>
    );
};

export default MenuToggle;