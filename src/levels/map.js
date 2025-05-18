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

const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));

export class MainMap extends Level {
  constructor(params = {}) {
    super({
      ...params,
      levelName: "Main Map"
    });

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
    this.localPlayer.setAttribute("hp", 100);
    // Add the local player to the scene
    this.addChild(this.localPlayer);

    // Set the local player in the base class
    this.setLocalPlayer(this.localPlayer);

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
    const hp = this.localPlayer.getAttributeAsObject("hp");

    this.debugText.innerHTML = `
      <div>Socket ID: ${debugInfo.socketId}</div>
      <div>Status: ${debugInfo.socketConnectionStatus}</div>
      <div>Remote Players: ${remoteCount}</div>
      <div>Local Position: x:${Math.round(this.localPlayer.position.x)}, y:${Math.round(this.localPlayer.position.y)}</div>
      <div>Last Update: ${debugInfo.lastReceivedUpdate || 'None'}</div>
      <div>${hp?.name}: ${hp?.value || 'None'}</div>
    `;
  }

  // Called on each game tick from main.js
  update(delta) {
    // Call parent update first (handles basic multiplayer updates)
    super.update(delta);
    this.updateDebugText();

    // MainMap-specific update logic here
    // (The parent class already handles basic local player updates and position sending)
  }

  ready() {
    // Call parent ready first
    super.ready();

    // MainMap-specific ready logic
    events.on("HERO_EXITS", this, () => {
      events.emit("CHANGE_LEVEL", new CaveLevel1({
        heroPosition: new Vector2(gridCells(3), gridCells(6)),
        multiplayerManager: this.multiplayerManager // Pass multiplayer manager to new level
      }));
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