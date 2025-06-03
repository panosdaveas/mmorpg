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

// const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));
const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class MainMap extends Level {
  constructor(params = {}) {
    super({
      ...params,
      levelName: "Main Map",
      mapData: mapData,
    });

    const rod = new Rod(gridCells(33), gridCells(13))
    this.addChild(rod)

    // Local player (our hero)
    this.heroStartPosition = params.heroPosition ?? DEFAULT_HERO_POSITION;
    this.localPlayer = new Hero(this.heroStartPosition.x, this.heroStartPosition.y);
    this.localPlayer.setAttribute("hp", 100);
    // Add the local player to the scene
    this.addChild(this.localPlayer);

    // Set the local player in the base class
    this.setLocalPlayer(this.localPlayer);

    const exit = new Exit(gridCells(23), gridCells(16))
    this.addChild(exit);

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

    // Setup multiplayer if manager is available
    if (this.multiplayerManager) {
      this.setupMultiplayerEvents();
    }
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
      
      <div>${address?.name}: ${address?.value.slice(0, 6) + "..." + address?.value.slice(36, address.value.length) || 'Not connected'}</div>
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

    events.on("HERO_EXITS", this, () => {
      this.cleanup(); // Cleanup current level
      events.emit("CHANGE_LEVEL", new Room1({
        heroPosition: new Vector2(gridCells(36), gridCells(21)),
        multiplayerManager: this.multiplayerManager, // Pass multiplayer manager to new level
        // position: null, // Reset position for new level
      }));
    });

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: mapData.width * TILE_SIZE,
      height: mapData.height * TILE_SIZE,
    });

    // Update debug text initially
    this.updateDebugText();

  }

  cleanup() {
    // Remove debug display
    if (this.debugText && this.debugText.parentNode) {
      this.debugText.parentNode.removeChild(this.debugText);
    }

    // Call parent cleanup
    super.cleanup();
  }
}