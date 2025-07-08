// MainMenu.jsx - Main menu implementation with game input integration
import React, { useState, useEffect } from 'react';
import GridLayout from '../GridLayout';
import MenuItem from '../Components/MenuItem';
import MenuToggle from '../Components/MenuToggle';

// Submenu Placeholder Component
const SubmenuPlaceholder = ({ title, visible, onBack, root }) => {
    if (!visible) return null;
    if (title === 'players') {
        console.log(root?.multiplayerManager.getRemotePlayers());
    }

    return (
        <div className="submenu-placeholder">
            <div className="game-ui-text">Submenu: {title}</div>
            <div className="game-ui-text">This is a placeholder for the {title} submenu</div>
            <div className="game-ui-text">Content will be implemented later...</div>
            <button
                className="back-button"
                onClick={onBack}
            >
                ← Back to Main Menu
            </button>
        </div>
    );
};

const MainMenu = ({
    root = null, // Game root object
    onClose = null, // Callback when menu is completely closed
    visible = true
}) => {
    const [selectedOption, setSelectedOption] = useState(0);
    const [currentSubmenu, setCurrentSubmenu] = useState(null);
    const [menuStack, setMenuStack] = useState([]); // Track menu hierarchy

    const menuOptions = [
        { id: 'trading', text: 'TRADING CENTER' },
        { id: 'wallet', text: 'WALLET  ASSETS' },
        { id: 'players', text: 'CONNECTED PLAYERS' },
        { id: 'settings', text: 'SETTINGS' }
    ];

    // Handle game input for navigation
    useEffect(() => {
        if (!root || !visible) return;

        const handleGameInput = () => {
            // Only handle input if we're in the main menu (not in a submenu)
            if (!currentSubmenu) {
                // Arrow Up - previous option
                if (root.input?.getActionJustPressed("ArrowUp") || root.input?.getActionJustPressed("Up")) {
                    setSelectedOption(prev => prev > 0 ? prev - 1 : menuOptions.length - 1);
                }

                // Arrow Down - next option
                if (root.input?.getActionJustPressed("ArrowDown") || root.input?.getActionJustPressed("Down")) {
                    setSelectedOption(prev => prev < menuOptions.length - 1 ? prev + 1 : 0);
                }

                // Enter - select current option
                if (root.input?.getActionJustPressed("Space")) {
                    handleOptionSelect(selectedOption);
                }
            }

            // Escape - go back in menu hierarchy or close menu
            if (root.input?.getActionJustPressed("Escape")) {
                if (currentSubmenu) {
                    // Go back to main menu
                    goBackToMainMenu();
                } else {
                    // Close the entire menu
                    if (onClose) {
                        onClose();
                    }
                }
            }
        };

        // Set up the input check in the game loop
        const inputCheckInterval = setInterval(handleGameInput, 16); // ~60fps

        return () => clearInterval(inputCheckInterval);
    }, [root, visible, currentSubmenu, selectedOption, menuOptions.length, onClose]);

    const handleOptionSelect = (index) => {
        const option = menuOptions[index];

        // Add current menu state to stack before opening submenu
        setMenuStack(prev => [...prev, {
            type: 'main',
            selectedOption: index
        }]);

        setCurrentSubmenu(option.id);
        console.log(`Selected: ${option.text}`);
    };

    const handleOptionHover = (index) => {
        if (!currentSubmenu) { // Only allow hover selection in main menu
            setSelectedOption(index);
        }
    };

    const goBackToMainMenu = () => {
        setCurrentSubmenu(null);

        // Restore previous state from stack
        if (menuStack.length > 0) {
            const previousState = menuStack[menuStack.length - 1];
            setSelectedOption(previousState.selectedOption);
            setMenuStack(prev => prev.slice(0, -1)); // Remove last item from stack
        }
    };

    const openSubmenu = (submenuId) => {
        // Add current state to stack
        setMenuStack(prev => [...prev, {
            type: 'main',
            selectedOption: selectedOption
        }]);

        setCurrentSubmenu(submenuId);
    };

    if (!visible) return null;

    return (
        <div className="main-menu-container">
            
            <h2>Game Menu</h2>

            {/* Main Menu Grid */}
            <GridLayout
                rows={menuOptions.length}
                cols={1}
                gap="8px"
                className="main-menu-grid"
                visible={!currentSubmenu}
                root={root}
                isActive={!currentSubmenu} // Only active when not in submenu
                onEnter={() => handleOptionSelect(selectedOption)}
                onEscape={() => {
                    if (onClose) onClose();
                }}
                
            >
                {menuOptions.map((option, index) => (
                    <MenuItem
                        key={option.id}
                        text={option.text}
                        position={{ row: index + 1, col: 1 }}
                        isSelected={selectedOption === index}
                        onSelect={() => handleOptionSelect(index)}
                        onMouseEnter={() => handleOptionHover(index)}
                        tabIndex={index + 1}
                    />
                ))}
                <GridLayout
                    rows={1}
                    cols={1}
                >
                    <MenuToggle
                        initialState={true}
                        onToggle={(value) => console.log("Toggle is now:", value)}
                        position={{ row: 1, col: 1 }}
                    />
                </GridLayout>
            </GridLayout>
            
            {/* Submenu Placeholder with hierarchy support */}
            {currentSubmenu && (
                <GridLayout
                    rows={1}
                    cols={1}
                    visible={!!currentSubmenu}
                    root={root}
                    isActive={!!currentSubmenu}
                    onEscape={goBackToMainMenu}
                >
                    <SubmenuPlaceholder
                        title={currentSubmenu}
                        visible={!!currentSubmenu}
                        onBack={goBackToMainMenu}
                        root={root}
                    />
                </GridLayout>
            )}
        </div>
    );
};

export default MainMenu;