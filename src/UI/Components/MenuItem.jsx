// MenuItem.jsx - Specialized GameUIComponent for menu options
import React from 'react';
import MenuPointer from './MenuPointer';
import MenuText from './MenuText';

const MenuItem = ({
    text,
    isSelected = false,
    onSelect,
    tabIndex,
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
        <div
            className="menu-item-container"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0px',
                gridRow: props.position?.row,
                gridColumn: props.position?.col,
            }}
            onClick={onSelect}
            tabIndex={tabIndex}
        >
            {/* Icon Component */}
            <MenuPointer         
                className="menu-item-icon"
                state={isSelected ? 'hover' : 'normal'}
                alpha={alpha}
                // style={{
                //     width: '24px',
                //     height: '24px',
                //     minWidth: '24px',
                //     padding: '4px'
                // }}
            />

            {/* Text Component */}
            <MenuText
                text={text}
                className="menu-item-text"
                state={isSelected ? 'hover' : 'normal'}
                alpha={alpha}
                // style={{
                //     flex: 1,
                //     padding: '8px 16px',
                //     textAlign: 'left'
                // }}
                {...props}
            />
        </div>
    );
};

export default MenuItem;