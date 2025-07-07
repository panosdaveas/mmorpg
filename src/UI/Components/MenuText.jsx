// MenuItem.jsx - Specialized GameUIComponent for menu options
import React from 'react';
import GameUIComponent from '../GameUIComponent';

const MenuText = ({
    text,
    isSelected = false,
    onSelect,
    // tabIndex,
    sprites = {
        normal: "public/sprites/text-box.png"
    },
    alpha = {
        normal: 0.8,
        hover: 1,
    },
    ...props
}) => {
    return (
        <GameUIComponent
            text={text}
            state={isSelected ? 'hover' : 'normal'}
            // onClick={onSelect}
            // tabIndex={tabIndex}
            // className="menu-item"
            sprites={sprites}
            alpha={alpha}
            {...props}
        >
        </GameUIComponent>
    );
};

export default MenuText;