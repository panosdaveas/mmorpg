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
            onPlayerMove: [],
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

        // If we're connected and have a hero, send initial position
        if (this.isConnected && level && level.localPlayer) {
            this.sendInitialPosition(level.localPlayer.position);
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
            console.log('New player joined:', data);
            this.handleNewPlayer(data);
        });

        socket.on('playerMoved', data => {
            if (data.id !== this.mySocketId && this.players[data.id]) {
                this.players[data.id].updateRemotePosition(data.x, data.y);
                this.debugInfo.lastReceivedUpdate = `Player ${data.id.substring(0, 6)} moved`;
                this.emit('onPlayerMoved', { playerId: data.id, position: { x: data.x, y: data.y } });
            }
        });

        socket.on('playerDataUpdated', data => {
            const { id, attributes } = data;
            const player = this.players[id];
            if (!player) return;

            if (attributes) {
                player.loadAttributesFromObject(attributes);
            }
            console.log("DATA", id, attributes);
            this.emit('onPlayerDataUpdated', { playerId: id, attributes: attributes });
        });

        socket.on('removePlayer', id => {
            console.log('Player disconnected:', id);
            this.handlePlayerLeave(id);
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
        for (const [id, pos] of Object.entries(players)) {
            if (id === this.mySocketId) {
                continue; // Skip ourselves
            }

            if (!this.players[id]) {
                this.createRemotePlayer(id, pos);
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

        console.log(`Creating remote player for ${id} at {${data.x}, ${data.y}}`);
        const remote = new Hero(data.x, data.y);
        remote.isRemote = true;

        if (data.attributes) {
            remote.loadAttributesFromObject(data.attributes);
        }
        
        this.players[id] = remote;
        this.currentLevel.addChild(remote);
    }

    // Send initial position to server
    sendInitialPosition(position) {
        if (!this.socket || !this.isConnected) return;

        const initialPos = {
            x: position.x,
            y: position.y
        };

        console.log("Sending initial position:", initialPos);
        this.socket.emit('playerJoin', initialPos);
    }

    sendAttributesUpdate(data) {
        if (!this.socket || !this.isConnected) return;

        const { attributes } = data;
        
        console.log("Attributes:", attributes);
        this.socket.emit('dataUpdated', attributes); // or a dedicated event if preferred
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

    // Update all remote players
    updateRemotePlayers(delta) {
        for (const id in this.players) {
            if (id !== this.mySocketId && this.players[id]) {
                this.players[id].update(delta);
            }
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