// src/ui/ReactUIManager.js - Bridge between your game engine and React UI
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import MainMenu from './Menus/MainMenu';
import './GameUI.css';
import { events } from '../Events';

// This component listens to your game's input system and shows React menus
const GameUIOverlay = ({ gameScene }) => {
    const [showReactMenu, setShowReactMenu] = useState(false);
    const [menuType, setMenuType] = useState(null);
    const [toggleStates, setToggleStates] = useState({
        multiplayerToggle: true,
        musicEnabled: false,
        darkMode: false
    });

    const handleMultiplayerToggle = () => {
        if (!toggleStates.multiplayerToggle) {
            // stop multiplayer
            console.log("Stopping Multiplayer")
            events.emit('TOGGLE_MULTIPLAYER_OFF');
            return;
        } else {
            // start multiplayer
            console.log("Starting Multiplayer")
            events.emit('TOGGLE_MULTIPLAYER_ON');
            return;
        }
    }

    useEffect(() => {
        handleMultiplayerToggle();
    }, [toggleStates]);

    useEffect(() => {
        const saved = localStorage.getItem("uiToggles");
        if (saved) {
            setToggleStates(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("uiToggles", JSON.stringify(toggleStates));
    }, [toggleStates]);

    // This is where we connect to your game's input system
    useEffect(() => {
        if (!gameScene) return;

        const checkGameInput = () => {
            // You can change this to any key you want
            if (gameScene.input?.getActionJustPressed("Enter")) {
                console.log("Opening React menu!");
                setShowReactMenu(true);
                setMenuType('main');
                events.emit("MENU_OPEN");
            }

            // Add more keys for different menus:
            // if (gameScene.input?.getActionJustPressed("KeyT")) {
            //   setShowReactMenu(true);
            //   setMenuType('trading');
            // }
        };

        // Check input every frame (same as your game loop)
        const inputInterval = setInterval(checkGameInput, 12); // ~60fps
        return () => clearInterval(inputInterval);
    }, [gameScene]);

    const handleCloseMenu = () => {
        console.log("Closing React menu!");
        setShowReactMenu(false);
        setMenuType(null);
        events.emit("MENU_CLOSE");
    };

    // Don't render anything if menu is not shown
    if (!showReactMenu) return null;

    return (
        <div style={{
            // Overlay on top of your canvas game
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1000, // Make sure it's above your canvas
            backgroundColor: 'rgba(0, 0, 0, 0.8)', // Dark overlay
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'auto' // Allow clicking on React elements
        }}>

            {/* Main Menu */}
            {menuType === 'main' && (
                <MainMenu
                    root={gameScene}          // Pass your game scene
                    visible={showReactMenu}   // Control visibility
                    onClose={handleCloseMenu} // Handle closing
                    toggleStates={toggleStates}
                    setToggleStates={setToggleStates}
                />
            )}

            {/* Add more menu types here as you build them */}
            {menuType === 'trading' && (
                <div className="game-ui-app">
                    <h2>Trading Center</h2>
                    <p>This will be the trading interface!</p>
                    <button onClick={handleCloseMenu}>Close</button>
                </div>
            )}

            {menuType === 'wallet' && (
                <div className="game-ui-app">
                    <h2>Wallet Interface</h2>
                    <p>This will be the wallet interface!</p>
                    <button onClick={handleCloseMenu}>Close</button>
                </div>
            )}

        </div>
    );
};

// This is the main class that connects everything
export class ReactUIManager {
    constructor(gameScene) {
        this.gameScene = gameScene;
        this.reactRoot = null;
        this.isInitialized = false;

        console.log("ReactUIManager: Initializing with game scene", gameScene);
        this.init();
    }

    init() {
        // Find the React container in your HTML
        const container = document.getElementById('react-ui-root');

        if (!container) {
            console.error('❌ ReactUIManager: Could not find #react-ui-root element!');
            console.error('   Make sure you added <div id="react-ui-root"></div> to your index.html');
            return;
        }

        try {
            // Create React root and render the overlay
            this.reactRoot = createRoot(container);
            this.reactRoot.render(
                <GameUIOverlay gameScene={this.gameScene} />
            );

            this.isInitialized = true;
            console.log("✅ ReactUIManager: Successfully initialized!");
            console.log("   Press 'Enter' key in game to open React menu");

        } catch (error) {
            console.error("❌ ReactUIManager: Failed to initialize:", error);
        }
    }

    // Call this when your game shuts down
    cleanup() {
        if (this.reactRoot) {
            console.log("ReactUIManager: Cleaning up...");
            this.reactRoot.unmount();
            this.reactRoot = null;
            this.isInitialized = false;
        }
    }

    // Optional: Methods to control menus from your game code
    openMenu(menuType = 'main') {
        // You could emit events or use other methods to trigger menu opening
        console.log(`ReactUIManager: Request to open ${menuType} menu`);
    }

    closeMenu() {
        // You could emit events or use other methods to trigger menu closing
        console.log("ReactUIManager: Request to close menu");
    }
}