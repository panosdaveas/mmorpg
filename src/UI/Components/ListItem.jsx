// ListItem.jsx - Reusable list item component for displaying object data
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

        await iconSheet.init();
        iconSpriteSheet = iconSheet;
        console.log('ListItem: Sprite sheets loaded');
    } catch (error) {
        console.warn('ListItem: Failed to load sprite sheets:', error);
    }
};

// Load sprites immediately when module loads
initSpriteSheets();

const ListItem = ({
    data = {}, // The object data to display
    displayKeys = [], // Array of keys to display from the object
    isSelected = false,
    onSelect = null,
    showIcon = true,
    tabIndex,
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
    separator = ' | ', // How to separate multiple values
    maxLength = 50, // Maximum length for displayed text
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

    const handleClick = () => {
        if (onSelect) {
            onSelect(data);
        }
    };

    // Generate display text from object data
    const generateDisplayText = () => {
        if (!data || typeof data !== 'object') {
            return 'Invalid data';
        }

        if (displayKeys.length === 0) {
            // If no keys specified, show all values
            const allValues = Object.values(data).filter(value =>
                value !== null && value !== undefined && value !== ''
            );
            return allValues.join(separator);
        }

        // Show only specified keys
        const displayValues = displayKeys.map(key => {
            const value = data[key];
            if (value === null || value === undefined || value === '') {
                return `${key}: N/A`;
            }
            return `${key}: ${value}`;
        });

        return displayValues.join(separator);
    };

    // Truncate text if it's too long
    const truncateText = (text, maxLen) => {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen - 3) + '...';
    };

    const displayText = truncateText(generateDisplayText(), maxLength);

    return (
        <div
            className="list-item-container"
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gridRow: props.position?.row,
                gridColumn: props.position?.col,
                minHeight: '32px',
                padding: '4px 0'
            }}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            tabIndex={tabIndex}
        >
            {/* Background Component - spans the whole list item */}
            <GameUIComponent
                state={currentState}
                alpha={alpha}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat'
                }}
            />

            {/* Icon Component - optional */}
            {showIcon && (
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
                        pointerEvents: 'none'
                    }}
                />
            )}

            {/* Text Component - displays the object data */}
            <GameUIComponent
                text={displayText}
                state={currentState}
                sprites={{}} // No sprites for text (background handles it)
                alpha={alpha}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    flex: 1,
                    padding: showIcon ? '8px 16px 8px 0px' : '8px 16px',
                    textAlign: 'left',
                    pointerEvents: 'none',
                }}
                {...props}
            />
        </div>
    );
};

export default ListItem;