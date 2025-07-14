import { Level } from "../objects/Level/Level.js";
import { Vector2 } from "../Vector2.js";
import { gridCells } from "../helpers/grid.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "../constants/worldConstants.js";
import mapData from './json/main_map_16x16.json';
import { Npc } from "../objects/Npc/Npc.js";

const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class MainMap extends Level {
  constructor(params = {}) {
    console.log('MainMap constructor - heroPosition:', params.heroPosition);

    super({
      ...params,
      levelName: "Main Map",
      mapData: mapData,
    });

    const rod = new Rod(gridCells(45), gridCells(23))
    this.addChild(rod);

    // Store player setup info (don't set position here)
    this.heroStartPosition = params.heroPosition || DEFAULT_HERO_POSITION;
    this.localPlayer = params.hero;
    this.multiplayerManager = params.multiplayerManager;
    this.setLocalPlayer(this.localPlayer);

    if (this.localPlayer) {
      this.addChild(this.localPlayer);
    }

    // Store level ID for transition handling
    this.levelId = params.levelId || "mainMap";
    this.cameraEnabled = true;

    // Setup debug text and multiplayer
    this.debugText = document.createElement('div');
    this.debugText.style.position = 'absolute';
    this.debugText.style.top = '10px';
    this.debugText.style.left = '10px';
    this.debugText.style.background = 'rgba(0,0,0,0.3)';
    this.debugText.style.color = 'white';
    this.debugText.style.padding = '10px';
    this.debugText.style.fontSize = '12px';
    this.debugText.style.fontFamily = 'monospace';
    this.debugText.style.letterSpacing = '0px';
    this.debugText.style.zIndex = '1000';
    document.body.appendChild(this.debugText);

    const npc1 = new Npc(gridCells(52), gridCells(32), "oldWomanLeft");
    this.addChild(npc1);

    const npc2 = new Npc(gridCells(32), gridCells(23), "female", {
      content: [
        {
          string: "What a wonderful day at work in the block! I'm very pleased to meet you! this text should take a while to show up, taking up more than 3 lines!",
          // string: "WHAT A WONDERFUL DAY AT WORK IN THE CAVE!",
          requires: [],
        }
      ],
      portraitFrame: 0
    })
    this.addChild(npc2);
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

    this.setPlayerPosition();
    // FIXED: Clean event binding to prevent conflicts
    // events.unsubscribe(this);
    events.off("HERO_EXITS", this); // Remove any existing listeners

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: mapData.width * TILE_SIZE,
      height: mapData.height * TILE_SIZE,
    });

    events.emit("SET_CAMERA_OPTIONS", {
      zoom: this.scale,
      enabled: this.cameraEnabled,
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