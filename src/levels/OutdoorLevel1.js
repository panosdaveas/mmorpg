import { Level } from "../objects/Level/Level.js";
import { Sprite } from "../Sprite.js";
import { resources } from "../Resource.js";
import { Vector2 } from "../Vector2.js";
import { Exit } from "../objects/Exit/Exit.js";
import { gridCells } from "../helpers/grid.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { CaveLevel1 } from "./CaveLevel1.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "../constants/worldConstants.js";
import mapData from './json/map.json';
import { TiledPropertyHandler } from "../helpers/propertyHandler.js";
import { io } from "socket.io-client";

const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));

export class OutdoorLevel1 extends Level {
  constructor(params = {}) {
    super({});

    // Store debug info
    this.debugInfo = {
      lastReceivedUpdate: null,
      socketConnectionStatus: "Disconnected",
      remotePlayers: 0
    };

    // Initialize socket connection
    this.socket = io('http://localhost:3000', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000
    });

    this.players = {}; // id -> Hero instances
    this.lastSentPosition = null;
    this.mySocketId = null; // Store our socket ID

    // Sky background
    this.background = new Sprite({
      resource: resources.images.sky,
      frameSize: new Vector2(CANVAS_WIDTH, CANVAS_HEIGHT)
    });

    // Ground
    const groundSprite = new Sprite({
      resource: resources.images.map,
      frameSize: new Vector2(MAP_WIDTH, MAP_HEIGHT)
    });
    this.addChild(groundSprite);

    // Local player (our hero)
    this.heroStartPosition = params.heroPosition ?? DEFAULT_HERO_POSITION;
    this.localPlayer = new Hero(this.heroStartPosition.x, this.heroStartPosition.y);
    this.addChild(this.localPlayer);

    // Walls and interactions
    const propertyHandler = new TiledPropertyHandler(mapData);
    this.walls = propertyHandler.getWallTiles();
    this.actions = propertyHandler.getActionTiles();
    this.propertyHandler = propertyHandler;

    // Add debug text display
    this.debugText = document.createElement('div');
    this.debugText.style.position = 'absolute';
    this.debugText.style.top = '10px';
    this.debugText.style.left = '10px';
    this.debugText.style.background = 'rgba(0,0,0,0.5)';
    this.debugText.style.color = 'white';
    this.debugText.style.padding = '10px';
    this.debugText.style.fontFamily = 'monospace';
    this.debugText.style.zIndex = '1000';
    document.body.appendChild(this.debugText);

    // Multiplayer setup
    this.setupSocketEvents();
  }

  updateDebugText() {
    const remoteCount = Object.keys(this.players).filter(id => id !== this.mySocketId).length;

    this.debugText.innerHTML = `
      <div>Socket ID: ${this.mySocketId || 'Not connected'}</div>
      <div>Status: ${this.debugInfo.socketConnectionStatus}</div>
      <div>Remote Players: ${remoteCount}</div>
      <div>Local Position: x:${Math.round(this.localPlayer.position.x)}, y:${Math.round(this.localPlayer.position.y)}</div>
      <div>Last Update: ${this.debugInfo.lastReceivedUpdate || 'None'}</div>
    `;
  }

  setupSocketEvents() {
    const socket = this.socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      this.mySocketId = socket.id;
      this.debugInfo.socketConnectionStatus = "Connected";

      // Tell the server our initial position
      const initialPos = {
        x: this.localPlayer.position.x,
        y: this.localPlayer.position.y
      };

      console.log("Sending initial position:", initialPos);
      socket.emit('playerJoin', initialPos);

      this.updateDebugText();
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      this.debugInfo.socketConnectionStatus = `Error: ${err.message}`;
      this.updateDebugText();
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.debugInfo.socketConnectionStatus = `Disconnected: ${reason}`;
      this.updateDebugText();
    });

    socket.on('currentPlayers', players => {
      console.log('Received current players:', players);

      // Clear any existing remote players first
      for (const id in this.players) {
        if (id !== this.mySocketId && id !== 'local') {
          this.removeChild(this.players[id]);
          delete this.players[id];
        }
      }

      // Add all players from the server
      for (const [id, pos] of Object.entries(players)) {
        if (id === this.mySocketId) {
          // This is us - no need to create a duplicate
          continue;
        } else if (!this.players[id]) {
          // This is another player - create a remote player
          console.log(`Creating remote player for ${id} at`, pos);
          const remote = new Hero(pos.x, pos.y);
          remote.isRemote = true; // Mark as remote player
          this.players[id] = remote;
          this.addChild(remote);
        }
      }

      this.debugInfo.lastReceivedUpdate = "Received player list";
      this.updateDebugText();
    });

    socket.on('newPlayer', data => {
      console.log('New player joined:', data);

      if (data.id !== this.mySocketId && !this.players[data.id]) {
        console.log(`Creating new remote player for ${data.id}`);
        const remote = new Hero(data.x, data.y);
        remote.isRemote = true; // Mark as remote player
        this.players[data.id] = remote;
        this.addChild(remote);

        this.debugInfo.lastReceivedUpdate = `New player: ${data.id}`;
        this.updateDebugText();
      }
    });

    socket.on('playerMoved', data => {
      if (data.id !== this.mySocketId && this.players[data.id]) {
        // Only update remote players (not our local player)
        // console.log(`Updating remote player ${data.id} to`, data);

        // Use the new updateRemotePosition method to handle animation
        this.players[data.id].updateRemotePosition(data.x, data.y);

        this.debugInfo.lastReceivedUpdate = `Player ${data.id.substring(0, 6)} moved`;
        this.updateDebugText();
      }
    });

    socket.on('removePlayer', id => {
      console.log('Player disconnected:', id);

      if (this.players[id] && id !== this.mySocketId) {
        this.removeChild(this.players[id]);
        delete this.players[id];

        this.debugInfo.lastReceivedUpdate = `Player ${id.substring(0, 6)} left`;
        this.updateDebugText();
      }
    });
  }

  // Called on each game tick from main.js
  update(delta) {
    if (!this.localPlayer) return;

    // Update local player
    this.localPlayer.update(delta);

    // Update remote players
    for (const id in this.players) {
      if (id !== this.mySocketId && this.players[id]) {
        this.players[id].update(delta);
      }
    }

    // Send position to server if it changed
    const { x, y } = this.localPlayer.position;
    const last = this.lastSentPosition;

    // Only send if position changed by at least 1 pixel
    if (!last || Math.abs(last.x - x) > 1 || Math.abs(last.y - y) > 1) {
      this.socket.emit('move', { x, y });
      this.lastSentPosition = { x, y };

      // Update debug on position change
      this.updateDebugText();
    }
  }

  ready() {
    events.on("HERO_EXITS", this, () => {
      events.emit("CHANGE_LEVEL", new CaveLevel1({
        heroPosition: new Vector2(gridCells(3), gridCells(6))
      }));
    });

    // Update debug text initially
    this.updateDebugText();
  }

  cleanup() {
    // Disconnect socket when level is changed
    if (this.socket) {
      this.socket.disconnect();
    }

    // Remove debug display
    if (this.debugText && this.debugText.parentNode) {
      this.debugText.parentNode.removeChild(this.debugText);
    }

    // Call parent cleanup if exists
    super.cleanup?.();
  }
}