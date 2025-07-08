// GridLayout.jsx - Container for organizing UI components in a grid
import React, { useEffect } from 'react';

const GridLayout = ({
    rows = 3,
    cols = 3,
    gap = '16px',
    className = '',
    style = {},
    children = null,
    visible = true,
    root = null, // Game root object for input handling
    onEnter = null,
    onEscape = null,
    parentMenu = null, // Reference to parent menu for hierarchy
    isActive = true, // Whether this layout should handle input
    ...props
}) => {
    // Handle game input system integration
    // useEffect(() => {
    //     if (!root || !visible || !isActive) return;

    //     const handleGameInput = () => {
    //         // Check for Enter key press
    //         if (root.input?.getActionJustPressed("Enter")) {
    //             if (onEnter) {
    //                 onEnter();
    //             }
    //         }

    //         // Check for Escape key press
    //         if (root.input?.getActionJustPressed("Escape")) {
    //             if (onEscape) {
    //                 onEscape();
    //             } else if (parentMenu) {
    //                 // Go back to parent menu if no custom escape handler
    //                 parentMenu.show();
    //             }
    //         }
    //     };

    //     // Set up the input check in the game loop
    //     // This would typically be called in your game's update loop
    //     const inputCheckInterval = setInterval(handleGameInput, 16); // ~60fps

    //     return () => clearInterval(inputCheckInterval);
    // }, [root, visible, isActive, onEnter, onEscape, parentMenu]);

    if (!visible) return null;

    const layoutStyle = {
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: gap,
        ...style
    };

    return (
        <div
            className={`game-grid-layout ${className}`}
            style={layoutStyle}
            {...props}
        >
            {children}
        </div>
    );
};

export default GridLayout;
