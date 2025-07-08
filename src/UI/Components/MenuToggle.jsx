import React, { useState, useEffect } from 'react';
import GameUIComponent from '../GameUIComponent';
import { SpriteSheet } from '../SpriteSheet';

let buttonSpriteSheet = null;

// Load sprite sheet at module level
const initSpriteSheet = async () => {
    try {
        const sheet = new SpriteSheet({
            resource: '/sprites/toggle.png',
            frameSize: [32, 32],
            hFrames: 1,
            vFrames: 2
        });
        await sheet.init();
        buttonSpriteSheet = sheet;
        console.log('MenuItem: Sprite sheet loaded');
    } catch (error) {
        console.warn('MenuItem: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const MenuToggle = ({
    initialState = false,
    onToggle = () => { },
    tabIndex,
    toggled,
    setToggled,
    sprites = {
        normal: buttonSpriteSheet?.sprites[0][0],
        pressed: buttonSpriteSheet?.sprites[1][0],
        disabled: buttonSpriteSheet?.sprites[1][0]
    },
    alpha = {
        normal: 1,
        hover: 1
    },
    ...props
}) => {
    // const [toggled, setToggled] = useState(initialState);

    // Optional: let parent know when toggled
    // useEffect(() => {
    //     onToggle(toggled);
    // }, [toggled]);

    const handleClick = () => {
        const newState = !toggled;
        setToggled(newState);
        onToggle(newState);
      };

    return (
        <GameUIComponent
            controlledState={true}
            state={toggled ? 'normal' : 'pressed'}
            onClick={handleClick}
            tabIndex={tabIndex}
            sprites={sprites}
            alpha={alpha}
            style={{
                zIndex: 1,
                width: '32px',
                height: '32px',
                minWidth: '32px'
            }}
            {...props}
        />
    );
};

export default MenuToggle;