// MenuButton.jsx - Fixed version with better size control
import React from 'react';
import GameUIComponent from '../GameUIComponent';
import { SpriteSheet } from '../SpriteSheet';

let buttonSpriteSheet = null;

const initSpriteSheet = async () => {
    try {
        const sheet = new SpriteSheet({
            resource: '/sprites/pointers.png',
            frameSize: [16, 16],
            hFrames: 4,
            vFrames: 5
        });

        await sheet.init();
        buttonSpriteSheet = sheet;
        console.log('MenuButton: Sprite sheet loaded');
    } catch (error) {
        console.warn('MenuButton: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const MenuButton = ({
    isSelected = false,
    onSelect,
    tabIndex,
    enabled = true,
    sprites = {
        normal: buttonSpriteSheet?.sprites[4][0],
        hover: buttonSpriteSheet?.sprites[4][1],
        pressed: buttonSpriteSheet?.sprites[4][2],
        disabled: buttonSpriteSheet?.sprites[4][3]
    },
    alpha = {
        normal: 0.8,
        hover: 1,
    },
    size = 24, // Allow customizable size
    padding = 0, // Allow customizable padding
    style = {}, // Allow style overrides
    ...props
}) => {
    const handleClick = () => {
        if (enabled && onSelect) {
            onSelect();
        }
    };

    return (
        <GameUIComponent
            state={isSelected ? 'hover' : 'normal'}
            controlledState={!enabled}
            onClick={handleClick}
            tabIndex={enabled ? tabIndex : -1}
            sprites={sprites}
            alpha={alpha}
            enabled={enabled}
            style={{
                zIndex: 1,
                width: `${size}px`,
                height: `${size}px`,
                minWidth: `${size}px`,
                padding: `${padding}px`,
                opacity: enabled ? (alpha.normal || 1) : 0.5,
                imageRendering: 'pixelated',
                WebkitImageRendering: 'pixelated',
                MozImageRendering: 'crisp-edges',
                msImageRendering: 'crisp-edges',
                ...style // Allow style overrides
            }}
            {...props}
        />
    );
};

export default MenuButton;