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

// const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));
const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class MainMap extends Level {
  constructor(params = {}) {
    super({
      ...params,
      levelName: "Main Map"
    });

    // Sky background
    // this.background = new Sprite({
    //   resource: resources.images.sky,
    //   frameSize: new Vector2(CANVAS_WIDTH, CANVAS_HEIGHT)
    // });

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
    this.walls = new Set();
    // this.actions = [];
    this.actions = new Map();
    // this.walls = propertyHandler.getWallTiles();
    // this.actions = propertyHandler.getActionTiles();
    this.animatedTiles =propertyHandler.parseAnimatedTiles(mapData.tilesets);
    this.tilesetImages = new Map(); // Will be loaded in ready()
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

  updateAnimatedTiles(delta) {
    for (const [tileId, anim] of this.animatedTiles.entries()) {
      anim.elapsedTime += delta;
      let currentFrame = anim.frames[anim.currentFrameIndex];

      while (anim.elapsedTime > currentFrame.duration) {
        anim.elapsedTime -= currentFrame.duration;
        anim.currentFrameIndex = (anim.currentFrameIndex + 1) % anim.frames.length;
        currentFrame = anim.frames[anim.currentFrameIndex];
      }
    }
  }

  getAnimatedTileId(originalTileId) {
    const anim = this.animatedTiles.get(originalTileId);
    return anim ? anim.frames[anim.currentFrameIndex].tileid : originalTileId;
  }

  // Called on each game tick from main.js
  update(delta) {
    // Call parent update first (handles basic multiplayer updates)
    super.update(delta);
    this.updateDebugText();

    this.updateAnimatedTiles(delta);

  }
  drawBackground(ctx) {
    this.walls = new Set();
    this.actions = new Map();

    mapData.layers.forEach(layer => {
      if (layer.type !== "tilelayer") return;

      const width = layer.width;

      layer.data.forEach((tileId, index) => {
        const rawTileId = tileId & 0x1FFFFFFF;
        if (rawTileId === 0) return;

        const x = index % width;
        const y = Math.floor(index / width);
        const posKey = `${x * TILE_SIZE},${y * TILE_SIZE}`;

        // 1. Get drawTileId for rendering
        const drawTileId = this.getAnimatedTileId(rawTileId);

        // 2. Find tileset and image for drawTileId
        const tilesetEntry = [...this.tilesetImages.entries()]
          .reverse()
          .find(([firstgid]) => drawTileId >= firstgid);

        if (!tilesetEntry) return;

        const [firstgid, { image, tileset }] = tilesetEntry;
        const localId = drawTileId - firstgid;
        const columns = tileset.columns;

        const sx = Math.floor((localId % columns) * TILE_SIZE);
        const sy = Math.floor(Math.floor(localId / columns) * TILE_SIZE);
        const dx = x * TILE_SIZE;
        const dy = y * TILE_SIZE;

        ctx.drawImage(image, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);

        // 3. Get tileProps from raw ID or animation base ID
        let tileProps = this.propertyHandler.tilePropertiesMap.get(rawTileId);
        if (!tileProps) {
          const anim = this.animatedTiles.get(rawTileId);
          if (anim?.frames?.length > 0) {
            const baseTileId = anim.frames[0].tileid;
            tileProps = this.propertyHandler.tilePropertiesMap.get(baseTileId);
          }
        }

        // 4. Handle collision
        if (tileProps?.collide) {
          this.walls.add(posKey);
        }

        // 5. Handle action tiles
        if (tileProps && Object.keys(tileProps).length > 0) {
          this.actions.set(posKey, {
            x,
            y,
            tileId: rawTileId,
            properties: tileProps
          });
        }
      });
    });
  }

  async ready() {
    // Call parent ready first
    super.ready();

    this.tilesetImages = await this.propertyHandler.loadTilesetImages(mapData.tilesets, "../assets/maps/");
    // MainMap-specific ready logic
    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: mapData.width * TILE_SIZE,
      height: mapData.height * TILE_SIZE
    });

    events.on("HERO_EXITS", this, () => {
      events.emit("CHANGE_LEVEL", new CaveLevel1({
        heroPosition: new Vector2(gridCells(3), gridCells(6)),
        multiplayerManager: this.multiplayerManager // Pass multiplayer manager to new level
      }));
    });

    // Listen for hero position changes
    events.on("HERO_POSITION", this, position => {
      if (this.multiplayerManager) {
        this.multiplayerManager.sendPositionUpdate(position);
      }
    });

    // Listen for hero attribute changes
    events.on("HERO_ATTRIBUTES_CHANGED", this, attributes => {
      if (this.multiplayerManager) {
        this.multiplayerManager.sendAttributesUpdate(attributes);
      }
    });

    // Update debug text initially
    this.updateDebugText();
  }

  // Get actions at a specific position
  getActionsAt(x, y) {
    const tileX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(y / TILE_SIZE) * TILE_SIZE;
    const key = `${tileX},${tileY}`;
    return this.actions.get(key);
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