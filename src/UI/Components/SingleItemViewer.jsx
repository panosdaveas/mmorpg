// SingleItemViewer.jsx - Simple single item display with navigation
import React, { useState, useEffect } from 'react';
import GridLayout from '../GridLayout';
import ListItem from './ListItem';
import MenuButton from './MenuButton';
import { SpriteSheet } from '../SpriteSheet';
import GameUIComponent from '../GameUIComponent';

// Load sprite sheet for navigation buttons
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
        console.log('SingleItemViewer: Sprite sheet loaded');
    } catch (error) {
        console.warn('SingleItemViewer: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const SingleItemViewer = ({
    items = [], // Array of objects to display
    onItemSelect = null, // Callback when item is selected
    showItemIcon = true, // Whether to show icon in the item
    root = null, // Game root for input handling
    title = null, // Optional title for the viewer
    emptyMessage = "No items to display", // Message when list is empty
    className = '',
    showCounter = true, // Whether to show "1 of 5" counter
    counterPosition = 'top', // 'top' or 'bottom'
    showIcon = false, // Whether to show an icon in the item
    ...props
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Check if navigation buttons should be enabled
    const canGoBack = currentIndex > 0;
    const canGoForward = currentIndex < items.length - 1;
    const hasItems = items.length > 0;

    // Get current item
    const currentItem = hasItems ? items[currentIndex] : null;

    // Handle game input for navigation
    useEffect(() => {
        if (!root || !hasItems) return;

        const handleGameInput = () => {
            // Arrow Left or Up - previous item
            if (root.input?.getActionJustPressed("ArrowLeft")) {
                goToPrevious();
            }

            // Arrow Right or Down - next item
            if (root.input?.getActionJustPressed("ArrowRight")) {
                goToNext();
            }

            // Enter/Space - select current item
            if (root.input?.getActionJustPressed("Space")) {
                if (currentItem && onItemSelect) {
                    onItemSelect(currentItem, currentIndex);
                }
            }
        };

        const inputInterval = setInterval(handleGameInput, 12); // ~60fps
        return () => clearInterval(inputInterval);
    }, [root, hasItems, currentIndex, currentItem, onItemSelect]);

    // Reset to first item when items change
    useEffect(() => {
        setCurrentIndex(0);
    }, [items]);

    const goToNext = () => {
        if (canGoForward) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const goToPrevious = () => {
        if (canGoBack) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleItemClick = (item) => {
        if (onItemSelect) {
            onItemSelect(item, currentIndex);
        }
    };

    // Counter component
    const Counter = () => {
        if (!showCounter || !hasItems) return null;

        return (
            <div className="item-counter" style={{
                textAlign: 'left',
            }}>
                <div className="game-ui-text">
                    {currentIndex + 1} of {items.length}
                </div>
            </div>
        );
    };

    // Navigation controls component
    const NavigationControls = () => (
        // <div className="navigation-controls">
        <GridLayout
            rows={1}
            cols={4}
            gap="8px"
            style={{
                display: 'flex',
                alignItems: 'left',
                paddingLeft: '0px',
            }}
        >
            <MenuButton
                onSelect={goToPrevious}
                tabIndex={-1}
                enabled={canGoBack}
                sprites={{
                    normal: buttonSpriteSheet?.sprites[1][0],
                    hover: buttonSpriteSheet?.sprites[1][1],
                    pressed: buttonSpriteSheet?.sprites[1][2],
                    disabled: buttonSpriteSheet?.sprites[1][2]
                }}
                style={{
                    opacity: canGoBack ? 1 : 0.6,
                }}
            />

            {/* Spacer */}
            {/* <div style={{ width: '32px' }} /> */}

            <MenuButton
                onSelect={goToNext}
                tabIndex={-1}
                enabled={canGoForward}
                sprites={{
                    normal: buttonSpriteSheet?.sprites[0][0],
                    hover: buttonSpriteSheet?.sprites[0][1],
                    pressed: buttonSpriteSheet?.sprites[0][2],
                    disabled: buttonSpriteSheet?.sprites[0][2]
                }}
                style={{
                    opacity: canGoForward ? 1 : 0.6,
                }}
            />
        </GridLayout>
    );

    // Empty state
    if (!hasItems) {
        return (
            <div className={`single-item-viewer-empty ${className}`}>
                <div className="game-ui-text" >
                    {emptyMessage}
                </div>
            </div>
        );
    }

    return (
        <div className={`single-item-viewer-container ${className}`} {...props}>
            <GridLayout
                rows={4}
                cols={1}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'left',
                }}
            >
                <Counter />
                <div className="game-ui-text">
                    From: {currentItem.from}
                </div>
                <div className="game-ui-text">
                    Date: {currentItem.timestamp}
                </div>
                <div className="current-item">
                    <GameUIComponent
                        text={items[currentIndex]?.message}
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            flex: 1,
                            padding: showIcon ? '8px 16px 8px 0px' : '0px 0px',
                            textAlign: 'left',
                            pointerEvents: 'none',
                        }}
                        {...props}
                    />
                </div>
                <NavigationControls />
            </GridLayout>
        </div>
    );
};

export default SingleItemViewer;