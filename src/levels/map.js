import { Level } from "../objects/Level/Level.js";
import { Sprite } from "../Sprite.js";
import { Vector2 } from "../Vector2.js";
import { Exit } from "../objects/Exit/Exit.js";
import { gridCells } from "../helpers/grid.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { Room1 } from "./room1.js";
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/worldConstants.js";
import mapData from './json/map.json';
import { Npc } from "../objects/Npc/Npc.js";
import { TradeModal } from "../objects/TradeModal/TradeModal.js";
import { Input } from "../Input.js";

// const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));
const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class MainMap extends Level {
  constructor(params = {}) {
    console.log('MainMap constructor - heroPosition:', params.heroPosition);

    super({
      ...params,
      levelName: "Main Map",
      mapData: mapData,
    });

    const rod = new Rod(gridCells(29), gridCells(16))
    this.addChild(rod);

    // FIXED: Better position handling
    this.heroStartPosition = params.heroPosition || DEFAULT_HERO_POSITION;
    this.localPlayer = params.hero;
    this.multiplayerManager = params.multiplayerManager;

    console.log('MainMap - Setting player position to:', this.heroStartPosition);

    // FIXED: Set position immediately and ensure it sticks
    if (this.localPlayer) {
      // Stop any current movement or interpolation  
      this.localPlayer.isSolid = true;

      // Set position directly
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;

      // Reset destination position to prevent interpolated movement
      this.localPlayer.destinationPosition = this.localPlayer.position.duplicate();

      // If your player has a setPosition method, use it
      if (typeof this.localPlayer.setPosition === 'function') {
        this.localPlayer.setPosition(this.heroStartPosition.x, this.heroStartPosition.y);
      }

      console.log('Room1 - Player position set to:', this.localPlayer.position);

      // Add to scene graph and set as local player
      this.addChild(this.localPlayer);
      this.setLocalPlayer(this.localPlayer);
    }

    // FIXED: Create exit with different coordinates to avoid conflicts
    const exit = new Exit(gridCells(23), gridCells(16))
    this.addChild(exit);

    // Setup debug text and multiplayer
    this.debugText = document.createElement('div');
    this.debugText.style.position = 'absolute';
    this.debugText.style.top = '10px';
    this.debugText.style.left = '10px';
    this.debugText.style.background = 'rgba(0,0,0,0.3)';
    this.debugText.style.color = 'white';
    this.debugText.style.padding = '10px';
    this.debugText.style.fontFamily = 'monospace';
    this.debugText.style.zIndex = '1000';
    document.body.appendChild(this.debugText);

    if (this.multiplayerManager) {
      this.setupMultiplayerEvents();
    }

    const npc2 = new Npc(gridCells(31), gridCells(20), {
      content: [
        {
          string: "What a wonderful day at work in the block! I'm very pleased to meet you!",
          // string: "WHAT A WONDERFUL DAY AT WORK IN THE CAVE!",
          requires: [],
        }
      ],
      portraitFrame: 0
    })
    this.addChild(npc2);

    // In your main map class constructor
    // const tradingModal = new TradeModal({
    //   position: new Vector2(0, 0),
    //   multiplayerManager: this.multiplayerManager
    // });
    // this.addChild(tradingModal);
  }

  setupMultiplayerEvents() {
    // Call parent setup first
    super.setupMultiplayerEvents();

    // Add MainMap-specific multiplayer event handlers
    if (!this.multiplayerManager) return;
    this.multiplayerManager.on('onConnect', (data) => {
      console.log('Connected to multiplayer server');
      this.updateDebugText();
    });

    this.multiplayerManager.on('onDisconnect', (data) => {
      console.log('Disconnected from multiplayer server:', data.reason);
      this.updateDebugText();
    });

    this.multiplayerManager.on('onError', (data) => {
      console.error('Multiplayer error:', data.error);
      this.updateDebugText();
    });

    this.multiplayerManager.on('onPlayerJoin', (data) => {
      console.log('Player(s) joined:', data);
      this.updateDebugText();
    });

    this.multiplayerManager.on('onPlayerLeave', (data) => {
      console.log('Player left:', data.playerId);
      this.updateDebugText();
    });

    this.multiplayerManager.on('onPlayerMove', (data) => {
      // Player movement is already handled in MultiplayerManager
      this.updateDebugText();
    });

  }

  updateDebugText() {
    if (!this.multiplayerManager) {
      this.debugText.innerHTML = `
        <div>Multiplayer: Disabled</div>
        <div>Local Position: x:${Math.round(this.localPlayer.position.x)}, y:${Math.round(this.localPlayer.position.y)}</div>
      `;
      return;
    }

    const debugInfo = this.multiplayerManager.getDebugInfo();
    const remoteCount = Object.keys(this.multiplayerManager.getRemotePlayers()).length;
    const tileX = Math.floor(this.localPlayer.position.x / TILE_SIZE);
    const tileY = Math.floor(this.localPlayer.position.y / TILE_SIZE);
    // const hp = this.localPlayer.getAttributeAsObject("hp");
    const address = this.localPlayer.getAttributeAsObject("address");

    this.debugText.innerHTML = `
      <div>Socket ID: ${debugInfo.socketId}</div>
      <div>Status: ${debugInfo.socketConnectionStatus}</div>
      <div>Remote Players: ${remoteCount}</div>
      <div>Local Position: x:${Math.round(tileX)}, y:${Math.round(tileY)}</div>
      <div>Last Update: ${debugInfo.lastReceivedUpdate || 'None'}</div>
     <div>${address && address.name && address.value ? `${address.name}: ${address.value.slice(0, 6)}...${address.value.slice(36)}` : 'Wallet not connected'}</div>
    `;
  }

  // Called on each game tick from main.js
  update(delta) {
    // Call parent update first (handles basic multiplayer updates)
    super.update(delta);
    this.updateDebugText();

  }

  async ready() {
    await super.ready();

    // FIXED: Ensure player position is set after level is ready
    if (this.localPlayer && this.heroStartPosition) {
      console.log('Level ready - Setting position:', this.heroStartPosition);

      // 🚨 CRITICAL: Reset movement state
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;

      // Reset destination position to prevent interpolated movement
      this.localPlayer.destinationPosition = this.localPlayer.position.duplicate();

      // Lock player briefly to prevent immediate movement
      this.localPlayer.isLocked = true;
      setTimeout(() => {
        this.localPlayer.isLocked = false;
      }, 100); // Brief 100ms lock

      // Force position update event
      events.emit("HERO_POSITION", this.localPlayer.position);
    }

    // FIXED: Clean event binding to prevent conflicts
    events.off("HERO_EXITS", this); // Remove any existing listeners
    events.on("HERO_EXITS", this, () => {
      console.log('MainMap - HERO_EXITS triggered');
      this.cleanup(); // Cleanup current level

      // Create new level with specific spawn position
      const newLevel = new Room1({
        heroPosition: new Vector2(gridCells(36), gridCells(21)),
        multiplayerManager: this.multiplayerManager,
        hero: this.localPlayer,
      });

      events.emit("CHANGE_LEVEL", newLevel);
    });

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: mapData.width * TILE_SIZE,
      height: mapData.height * TILE_SIZE,
    });

    this.updateDebugText();
  }

  cleanup() {
    console.log('MainMap cleanup called');

    // Remove debug display
    if (this.debugText && this.debugText.parentNode) {
      this.debugText.parentNode.removeChild(this.debugText);
    }

    // Call parent cleanup
    super.cleanup();
  }
}