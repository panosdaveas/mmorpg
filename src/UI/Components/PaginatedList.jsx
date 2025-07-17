// PaginatedList.jsx - Reusable pagination list component
import React, { useState, useEffect } from 'react';
import GridLayout from '../GridLayout';
import ListItem from '../Components/ListItem';
import MenuButton from '../Components/MenuButton';
import { SpriteSheet } from '../SpriteSheet';

// Load sprite sheet for pagination buttons
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
        console.log('PaginatedList: Sprite sheet loaded');
    } catch (error) {
        console.warn('PaginatedList: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const PaginatedList = ({
    items = [], // Array of objects to display
    visibleItems = 4, // Number of items to show per page
    displayKeys = [], // Keys to display from each object
    onItemSelect = null, // Callback when item is selected
    showItemIcons = true, // Whether to show icons in list items
    root = null, // Game root for input handling
    title = null, // Optional title for the list
    emptyMessage = "No items to display", // Message when list is empty
    className = '',
    ...props
}) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(0);

    // Calculate pagination values
    const totalPages = Math.ceil(items.length / visibleItems);
    const startIndex = currentPage * visibleItems;
    const endIndex = Math.min(startIndex + visibleItems, items.length);
    const currentItems = items.slice(startIndex, endIndex);

    // Check if pagination buttons should be enabled
    const canGoBack = currentPage > 0;
    const canGoForward = currentPage < totalPages - 1;
    const needsPagination = items.length > visibleItems;

    // Handle game input for navigation
    useEffect(() => {
        if (!root) return;

        const handleGameInput = () => {
            if (currentItems.length === 0) return;

            // Arrow Up - previous item
            if (root.input?.getActionJustPressed("ArrowUp")) {
                setSelectedItemIndex(prev => {
                    if (prev > 0) {
                        return prev - 1;
                    } else if (canGoBack) {
                        // Go to previous page, select last item
                        goToPreviousPage();
                        return visibleItems - 1;
                    }
                    return prev;
                });
            }

            // Arrow Down - next item
            if (root.input?.getActionJustPressed("ArrowDown")) {
                setSelectedItemIndex(prev => {
                    if (prev < currentItems.length - 1) {
                        return prev + 1;
                    } else if (canGoForward) {
                        // Go to next page, select first item
                        goToNextPage();
                        return 0;
                    }
                    return prev;
                });
            }

            // Arrow Left - previous page
            if (root.input?.getActionJustPressed("ArrowLeft")) {
                goToPreviousPage();
            }

            // Arrow Right - next page
            if (root.input?.getActionJustPressed("ArrowRight")) {
                goToNextPage();
            }

            // Enter/Space - select current item
            if (root.input?.getActionJustPressed("Space") || root.input?.getActionJustPressed("Enter")) {
                if (currentItems[selectedItemIndex] && onItemSelect) {
                    onItemSelect(currentItems[selectedItemIndex], startIndex + selectedItemIndex);
                }
            }
        };

        const inputInterval = setInterval(handleGameInput, 12); // ~60fps
        return () => clearInterval(inputInterval);
    }, [root, currentItems, selectedItemIndex, canGoBack, canGoForward, startIndex, onItemSelect]);

    // Reset selected index when page changes
    useEffect(() => {
        setSelectedItemIndex(0);
    }, [currentPage]);

    // Reset to first page when items change
    useEffect(() => {
        setCurrentPage(0);
        setSelectedItemIndex(0);
    }, [items]);

    const goToNextPage = () => {
        if (canGoForward) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const goToPreviousPage = () => {
        if (canGoBack) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const handleItemClick = (item, localIndex) => {
        setSelectedItemIndex(localIndex);
        if (onItemSelect) {
            onItemSelect(item, startIndex + localIndex);
        }
    };

    const handleItemHover = (localIndex) => {
        setSelectedItemIndex(localIndex);
    };

    if (items.length === 0) {
        return (
            <div className={`paginated-list-empty ${className}`}>
                <div className="game-ui-text" style={{ textAlign: 'center', padding: '16px' }}>
                    {emptyMessage}
                </div>
            </div>
        );
    }

    return (
        <div className={`paginated-list-container ${className}`} {...props}>
            {/* Optional title */}
            {/* {title && (
                <div className="list-title" style={{ marginBottom: '8px' }}>
                    <div className="game-ui-text">{title}</div>
                </div>
            )} */}

            

            {/* List items */}
            <div className="list-items">
                <GridLayout
                    rows={visibleItems}
                    cols={1}
                    gap="2px"
                >
                    {currentItems.map((item, index) => (
                        <ListItem
                            key={`${currentPage}-${index}`}
                            data={item}
                            displayKeys={displayKeys}
                            isSelected={selectedItemIndex === index}
                            onSelect={() => handleItemClick(item, index)}
                            onMouseEnter={() => handleItemHover(index)}
                            showIcon={showItemIcons}
                            tabIndex={index + 1}
                            position={{ row: index + 1, col: 1 }}
                        />
                    ))}
                </GridLayout>
            </div>

            {/* Pagination controls - top */}
            {/* {needsPagination && ( */}
                {/* <div className="pagination-controls-top" style={{ marginBottom: '8px' }}> */}
                    <GridLayout
                        rows={1}
                        cols={4}
                        gap="8px"
                        style={{
                            display: 'flex',
                            // alignItems: 'center',
                            // justifyContent: 'space-between'
                        }}
                    >
                        <MenuButton
                            onSelect={goToPreviousPage}
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

                        {/* <div className="game-ui-text" style={{
                            flex: 1,
                            textAlign: 'center',
                            fontSize: '12px'
                        }}>
                            Page {currentPage + 1} of {totalPages} ({items.length} total)
                        </div> */}

                        <MenuButton
                            onSelect={goToNextPage}
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
                {/* </div> */}
            {/* )} */}

            {/* Pagination controls - bottom (simplified)
            {needsPagination && (
                <div className="pagination-controls-bottom" style={{
                    marginTop: '8px',
                    textAlign: 'center'
                }}>
                    <div className="game-ui-text" style={{ fontSize: '10px' }}>
                        Showing {startIndex + 1}-{endIndex} of {items.length}
                    </div>
                </div>
            // )} */}
        </div>
    );
};

export default PaginatedList;