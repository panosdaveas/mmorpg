// Simple function to create multiple test remote players
export function createTestRemotePlayers(multiplayerManager, count = 3, options = {}) {
    const {
        spawnX = 100,
        spawnY = 100,
        spawnRadius = 200,
        levelName = multiplayerManager.currentLevel?.levelName || 'Main Map',
        withMovement = false
    } = options;

    const createdPlayers = [];

    for (let i = 0; i < count; i++) {
        // Generate unique test player ID
        const playerId = `test-${Date.now()}-${i}`;

        // Random position around spawn point
        const angle = (i / count) * 2 * Math.PI; // Distribute evenly in circle
        const radius = Math.random() * spawnRadius;
        // const x = spawnX + Math.cos(angle) * radius;
        // const y = spawnY + Math.sin(angle) * radius;
        const x = 576;
        const y = 336;

        // Create player data
        const playerData = {
            x: Math.floor(x),
            y: Math.floor(y),
            levelName: levelName,
            attributes: {
                name: `TestBot${i + 1}`,
                // level: Math.floor(Math.random() * 10) + 1,
                // coins: Math.floor(Math.random() * 1000),
                address: `0x1c08Ad51b53C9DEaAD8e10C4a208d56a2Bd2cB8d`,
                isTestPlayer: true,
                // class: ['Warrior', 'Mage', 'Archer', 'Rogue'][i % 4]
            }
        };

        // Create the remote player using existing system
        multiplayerManager.createRemotePlayer(playerId, playerData);

        const player = multiplayerManager.players[playerId];
        if (player) {
            player.isTestPlayer = true;

            // Add simple random movement if requested
            if (withMovement) {
                setInterval(() => {
                    if (multiplayerManager.players[playerId]) {
                        const newX = spawnX + (Math.random() - 0.5) * spawnRadius * 2;
                        const newY = spawnY + (Math.random() - 0.5) * spawnRadius * 2;
                        player.updateRemotePosition(Math.floor(newX), Math.floor(newY));
                    }
                }, 3000 + Math.random() * 2000);
            }

            createdPlayers.push({ id: playerId, player });
            console.log(`Created test player: ${playerId}`);
        }
    }

    return createdPlayers;
}

// Quick cleanup function
export function removeTestPlayers(multiplayerManager) {
    const testPlayerIds = Object.keys(multiplayerManager.players)
        .filter(id => multiplayerManager.players[id]?.isTestPlayer);

    testPlayerIds.forEach(id => {
        multiplayerManager.handlePlayerLeave(id);
        console.log(`Removed test player: ${id}`);
    });

    console.log(`Removed ${testPlayerIds.length} test players`);
}