// MenuItem.jsx - Specialized GameUIComponent for menu options
import React from 'react';
import GameUIComponent from '../GameUIComponent';
import { SpriteSheet } from '../SpriteSheet';

// Load sprite sheet at module level
let buttonSpriteSheet = null;

// Initialize sprite sheets immediately
const initSpriteSheets = async () => {
    try {
        // Load button background sprites
        const buttonSheet = new SpriteSheet({
            resource: '/sprites/pointers.png', // Your 1x4 sprite sheet
            frameSize: [16, 16],                   // Adjust to your sprite size
            hFrames: 4,                            // normal, hover, pressed, disabled
            vFrames: 5                             // 1 row
        });

        await Promise.all([buttonSheet.init()]);
        buttonSpriteSheet = buttonSheet;
        console.log('MenuItem: Sprite sheets loaded');
    } catch (error) {
        console.warn('MenuItem: Failed to load sprite sheets:', error);
    }
};

// Load sprites immediately when module loads
initSpriteSheets();

const MenuPointer = ({
    // text,
    isSelected = false,
    onSelect,
    // tabIndex,
    buttonSprites = {
        normal: buttonSpriteSheet?.sprites[0][3],   // button background sprites
        hover: buttonSpriteSheet?.sprites[0][1],
        pressed: buttonSpriteSheet?.sprites[0][2],
        disabled: buttonSpriteSheet?.sprites[0][3]
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
                // className="menu-item-text"
                state={isSelected ? 'hover' : 'normal'}
                sprites={buttonSprites}
                alpha={alpha}
                // style={{
                //     flex: 1,
                //     padding: '8px 0px',
                //     textAlign: 'left'
                // }}
                {...props}
            />
    );
};

export default MenuPointer;