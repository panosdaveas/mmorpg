import { io } from 'socket.io-client';
import { Hero } from '../objects/Hero/Hero.js';

export class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.players = {}; // id -> Hero instances
        this.mySocketId = null;
        this.lastSentPosition = null;
        this.currentLevel = null;
        this.isConnected = false;

        // Debug info
        this.debugInfo = {
            lastReceivedUpdate: null,
            socketConnectionStatus: "Disconnected",
            remotePlayers: 0
        };

        // Event callbacks that levels can subscribe to
        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onPlayerJoin: [],
            onPlayerLeave: [],
            onPlayerMoved: [],
            onPlayerDataUpdated: [],
            onError: []
        };
    }

    // Initialize socket connection
    connect(serverUrl = 'http://localhost:3000') {
        if (this.socket && this.socket.connected) {
            console.log('Socket already connected');
            return;
        }

        this.socket = io(serverUrl, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 5000
        });

        this.setupSocketEvents();
    }

    // Disconnect and cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.mySocketId = null;
        this.players = {};
        this.currentLevel = null;
    }

    // Set the current level (for adding/removing players)
    setLevel(level) {
        this.currentLevel = level;

        // ✅ Send level info to server
        if (this.socket && this.socket.connected && level?.levelName) {
            this.sendLevelChangedUpdate(level.levelName);
        }

        if (this.isConnected && level?.localPlayer) {
            this.sendInitialPlayerData(level.localPlayer);
        }
    }

    // Subscribe to multiplayer events
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    // Unsubscribe from multiplayer events
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    // Emit events to subscribers
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    // Setup socket event listeners
    setupSocketEvents() {
        const socket = this.socket;

        socket.on('connect', () => {
            console.log('Connected to server:', socket.id);
            this.mySocketId = socket.id;
            this.isConnected = true;
            this.debugInfo.socketConnectionStatus = "Connected";

            this.emit('onConnect', { socketId: socket.id });

            // Send initial data if we have a level and player ready
            if (this.currentLevel && this.currentLevel.localPlayer) {
                this.sendInitialPlayerData(this.currentLevel.localPlayer);
            }
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            this.debugInfo.socketConnectionStatus = `Error: ${err.message}`;
            this.isConnected = false;

            this.emit('onError', { error: err.message });
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            this.debugInfo.socketConnectionStatus = `Disconnected: ${reason}`;
            this.isConnected = false;

            this.emit('onDisconnect', { reason });
        });

        socket.on('currentPlayers', players => {
            console.log('Received current players:', players);
            this.handleCurrentPlayers(players);
        });

        socket.on('newPlayer', data => {
            this.handleNewPlayer(data);
            console.log('New player joined:', data.id);
        });

        socket.on('playerMoved', data => {
            if (data.id !== this.mySocketId && this.players[data.id]) {
                this.players[data.id].updateRemotePosition(data.x, data.y);
                this.debugInfo.lastReceivedUpdate = `Player ${data.id.substring(0, 6)} moved`;
                this.emit('onPlayerMoved', { playerId: data.id, position: { x: data.x, y: data.y } });
            }
        });

        socket.on('playerDataUpdated', data => {
            console.log('Received player data update:', data);
            const { id, attributes } = data;
            const player = this.players[id];
            if (!player) {
                console.warn(`Received data update for unknown player: ${id}`);
                return;
            }

            // Update the player's attributes
            if (attributes) {
                player.loadAttributesFromObject(attributes);
                console.log("Updated player data:", id, player.getAttributesAsObject());
                this.emit('onPlayerDataUpdated', { playerId: id, player });
            }
        });

        socket.on('removePlayer', id => {
            console.log('Player disconnected:', id);
            this.handlePlayerLeave(id);
        });

        socket.on("playerLevelChanged", ({ id, levelName }) => {
            const player = this.players[id];
            if (player) {
                player.currentLevelName = levelName;
                // ✅ Remove from current level
                this.currentLevel?.removeChild?.(player);

                // ✅ If they now belong in this level, add them back
                if (this.currentLevel?.levelName === levelName) {
                    this.currentLevel.addChild(player);
                }
                console.log(`[Client] Updated remote player ${id} to level ${levelName}`);
            }
        });
    }

    // Handle receiving current players list
    handleCurrentPlayers(players) {
        if (!this.currentLevel) return;

        // Clear existing remote players
        for (const id in this.players) {
            if (id !== this.mySocketId && this.currentLevel) {

                this.currentLevel.removeChild(this.players[id]);
                delete this.players[id];
            }
        }

        // Add all players from server
        for (const [id, playerData] of Object.entries(players)) {
            if (id === this.mySocketId) {
                continue; // Skip ourselves
            }

            if (!this.players[id]) {
                console.log(`[Client] Creating player ${id} in level ${playerData.levelName}`);
                this.createRemotePlayer(id, playerData);
            }
        }

        this.debugInfo.lastReceivedUpdate = "Received player list";
        this.emit('onPlayerJoin', { players: Object.keys(this.players) });
    }

    // Handle new player joining
    handleNewPlayer(data) {
        if (data.id !== this.mySocketId && !this.players[data.id]) {
            this.createRemotePlayer(data.id, data);
            this.debugInfo.lastReceivedUpdate = `New player: ${data.id}`;
            this.emit('onPlayerJoin', { playerId: data.id });
        }
    }

    // Handle player leaving
    handlePlayerLeave(id) {
        if (this.players[id] && id !== this.mySocketId && this.currentLevel) {
            this.currentLevel.removeChild(this.players[id]);
            delete this.players[id];
            this.debugInfo.lastReceivedUpdate = `Player ${id.substring(0, 6)} left`;
            this.emit('onPlayerLeave', { playerId: id });
        }
    }

    // Create a remote player
    createRemotePlayer(id, data) {
        if (!this.currentLevel) return;

        console.log(`Creating remote player for ${id} with data:`, data);

        // Default position if not provided
        const x = data.x || 320;
        const y = data.y || 262;

        const remote = new Hero(x, y);
        remote.isRemote = true;
        // Make remote players act as solid objects
        remote.isSolid = true;
        // make remote players interactive
        remote.isInteractive = true;
        // remote.currentLevelName = this.currentLevel.levelName;
        remote.currentLevelName = data.levelName ?? 'Main Map';

        // Load attributes if provided
        if (data.attributes && typeof data.attributes === 'object') {
            console.log(`Loading attributes for player ${id}:`, data.attributes);
            remote.loadAttributesFromObject(data.attributes);
        }

        this.players[id] = remote;
        // ✅ Only add to the current level if levelName matches
        if (this.currentLevel?.levelName === remote.currentLevelName) {
            this.currentLevel.addChild(remote);
        }
        // this.currentLevel.addChild(remote);
    }

    // Send initial player data (position + attributes) together
    sendInitialPlayerData(localPlayer) {
        if (!this.socket || !this.isConnected || !localPlayer) return;

        const initialData = {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            attributes: localPlayer.getAttributesAsObject(),
            levelName: this.currentLevel?.levelName
            // levelName: localPlayer.currentLevelName
        };

        console.log("Sending initial player data:", initialData);
        this.socket.emit('playerJoin', initialData);
    }

    // Send attribute updates
    sendAttributesUpdate(attributes) {
        if (!this.socket || !this.isConnected) return;

        const data = { attributes };

        console.log("Sending attributes update:", data);
        this.socket.emit('playerDataUpdated', data);
        return true;
    }

    // Send position update to server
    sendPositionUpdate(position) {
        if (!this.socket || !this.isConnected) return;

        const { x, y } = position;
        const last = this.lastSentPosition;

        // Only send if position changed by at least 1 pixel
        if (!last || Math.abs(last.x - x) > 1 || Math.abs(last.y - y) > 1) {
            this.socket.emit('move', { x, y });
            this.lastSentPosition = { x, y };
            return true;
        }
        return false;
    }

    sendLevelChangedUpdate(levelName) {
        if (!this.socket || !this.isConnected) return;

        console.log(`[Client] Sending level change to server: ${levelName}`);
        this.socket.emit("changeLevel", { levelName });
    }

    // Update all remote players
    updateRemotePlayers(delta) {
        const currentLevelName = this.currentLevel?.levelName;

        for (const id in this.players) {
            if (id === this.mySocketId) continue;

            const player = this.players[id];

            // ✅ ⛔ SKIP players not on the same level
            if (player.currentLevelName !== currentLevelName) {
                continue;
            }

            player.update(delta);
        }
    }

    // Get debug information
    getDebugInfo() {
        const remoteCount = Object.keys(this.players).filter(id => id !== this.mySocketId).length;

        return {
            ...this.debugInfo,
            socketId: this.mySocketId || 'Not connected',
            remotePlayers: remoteCount,
            isConnected: this.isConnected
        };
    }

    // Get all remote players
    getRemotePlayers() {
        return Object.keys(this.players)
            .filter(id => id !== this.mySocketId)
            .reduce((acc, id) => {
                acc[id] = this.players[id];
                return acc;
            }, {});
    }

    // Check if connected
    isSocketConnected() {
        return this.socket && this.socket.connected;
    }
}