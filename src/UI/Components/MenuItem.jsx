// MenuItem.jsx - Specialized GameUIComponent for menu options
import React, { useState } from 'react';
import GameUIComponent from '../GameUIComponent';
import { SpriteSheet } from '../SpriteSheet';

// Load sprite sheet at module level
let iconSpriteSheet = null;

// Initialize sprite sheets immediately
const initSpriteSheets = async () => {
    try {
        // Load icon sprites (pointer, etc.)
        const iconSheet = new SpriteSheet({
            resource: '/sprites/pointers.png',   // Your icon sprite sheet
            frameSize: [16, 16],                   // Adjust to your icon size
            hFrames: 4,                            // different icon states
            vFrames: 5                             // 5 rows
        });

        await Promise.all([iconSheet.init()]);
        iconSpriteSheet = iconSheet;
        console.log('MenuItem: Sprite sheets loaded');
    } catch (error) {
        console.warn('MenuItem: Failed to load sprite sheets:', error);
    }
};

// Load sprites immediately when module loads
initSpriteSheets();

const MenuItem = ({
    text,
    isSelected = false,
    onSelect,
    tabIndex,
    backgroundSprites = {
        normal: '/sprites/text-box.png',   // whole menu item background
    },
    iconSprites = {
        normal: iconSpriteSheet?.sprites[4][3],     // icon sprites (pointer, etc.)
        hover: iconSpriteSheet?.sprites[0][1],
        pressed: iconSpriteSheet?.sprites[0][2],
        disabled: iconSpriteSheet?.sprites[0][3]
    },
    alpha = {
        normal: 0.8,
        hover: 1,
    },
    ...props
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Determine the current state based on selection and hover
    const currentState = isSelected ? 'hover' : (isHovered ? 'hover' : 'normal');

    const handleMouseEnter = () => {
        setIsHovered(true);
        // Call the original onMouseEnter if it exists
        if (props.onMouseEnter) {
            props.onMouseEnter();
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        // Call the original onMouseLeave if it exists
        if (props.onMouseLeave) {
            props.onMouseLeave();
        }
    };

    return (
        <div
            className="menu-item-container"
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gridRow: props.position?.row,
                gridColumn: props.position?.col,
             
            }}
            onClick={onSelect}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            tabIndex={tabIndex}
        >
            {/* Background Component - spans the whole menu item */}
            <GameUIComponent
                state={currentState}
                // sprites={backgroundSprites}
                alpha={alpha}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none', // Don't interfere with container click
                    backgroundSize: '100% 100%', // 👈 Add this to force fill
                    backgroundRepeat: 'no-repeat'
                }}
            />

            {/* Icon Component - non-interactive */}
            <GameUIComponent
                state={currentState}
                sprites={iconSprites}
                alpha={alpha}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '16px',
                    height: '16px',
                    minWidth: '16px',
                    padding: '8px',
                    pointerEvents: 'none' // Don't interfere with container click
                }}
            />

            {/* Text Component - non-interactive */}
            <GameUIComponent
                text={text}
                state={currentState}
                sprites={{}} // No sprites for text (background handles it)
                alpha={alpha}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    flex: 1,
                    padding: '8px 16px 8px 0px', // trbl
                    textAlign: 'left',
                    pointerEvents: 'none', // Don't interfere with container click
                }}
                {...props}
            />
        </div>
    );
};

export default MenuItem;