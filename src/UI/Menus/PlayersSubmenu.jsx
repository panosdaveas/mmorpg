import React, { useState, useEffect } from 'react';
import GridLayout from '../GridLayout';
import MenuItem from '../Components/MenuItem';
import MenuToggle from '../Components/MenuToggle';
import MenuButton from '../Components/MenuButton';
import { SpriteSheet } from '../SpriteSheet';
import PaginatedList from '../Components/PaginatedList';

let buttonSpriteSheet = null;

// Initialize sprite sheet immediately
const initSpriteSheet = async () => {
    try {
        const sheet = new SpriteSheet({
            resource: '/sprites/pointers.png', // Your 1x4 sprite sheet
            frameSize: [16, 16],                   // Adjust to your sprite size
            hFrames: 4,                            // normal, hover, pressed, disabled
            vFrames: 5                             // 1 row
        });

        await sheet.init();
        buttonSpriteSheet = sheet;
        console.log('MenuItem: Sprite sheet loaded');
    } catch (error) {
        console.warn('MenuItem: Failed to load sprite sheet:', error);
    }
};

initSpriteSheet();

const PlayersSubmenu = ({ title, visible, onBack, root }) => {
    const [selectedItem, setSelectedItem] = useState(null);

    const handlePlayerSelect = (player, index) => {
        setSelectedItem(player);
        console.log('Selected player:', player, 'at index:', index);
    };


    if (!visible) return null;
    const remotePlayers = root?.multiplayerManager.getRemotePlayers();
    // const objList = Object.entries(remotePlayers).map(([key, value]) => ({
    //     id: key,
    //     ...value
    // }));
    const objList = Object.values(remotePlayers).map(player => ({
        id: player.getAttribute('id'),
        name: player.getAttribute('name') || 'Unknown Player',
        address: player.getAttribute('address'),
        chainId: player.getAttribute('chainId'),
        level: player.getAttribute('level'),
        isOnline: true,
    }));


    return (
        <>
            <GridLayout
                rows={1}
                cols={1}
                // gap='32px'
                // className="main-menu-grid"
            >
                <div style={{ gridRow: 1, gridColumn: 1 }}>
                    <PaginatedList
                        items={objList || []}
                        visibleItems={4}
                        displayKeys={['id']}
                        onItemSelect={handlePlayerSelect}
                        title="Connected Players"
                        emptyMessage="No players connected"
                        root={root}
                    />
                </div>
            </GridLayout>
            <button
                className="back-button"
                onClick={onBack}
            >
                ← Back to Main Menu
            </button>
        </>
    );
};

export default PlayersSubmenu;