import { GameObject } from "../../GameObject.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import { TiledPropertyHandler } from "../../helpers/propertyHandler.js";
import { events } from "../../Events.js";
import { Exit } from "../Exit/Exit.js";
import { gridCells } from "../../helpers/grid.js";

export class Level extends GameObject {
  constructor(params = {}) {
    super(params);

    // Basic level properties
    this.background = null;
    this.scale = params.scale || 1;
    this.walls = new Set();
    this.actions = new Map();
    this.mapData = params.mapData || null;
    this.tilesetImages = new Map();
    this.animatedTiles = null;
    this.cameraEnabled = null;

    this.propertyHandler = new TiledPropertyHandler(this.mapData);
    this.animatedTiles = this.propertyHandler.parseAnimatedTiles(this.mapData.tilesets);

    // Level state
    this.isReady = false;
    this.levelName = params.levelName || "Unknown Level";
    this.levelId = params.levelId || null;
    this.levelConfig = null;
    this.heroStartPosition = params.heroPosition || null;

    // Player reference
    this.localPlayer = null;

    // Track event subscriptions to prevent duplicates
    this.eventSubscriptions = new Map();
  }

  setLevelConfig(config) {
    this.levelConfig = config;
  }

  async createExitsFromConfig() {
    if (!this.levelId) {
      console.warn(`Level ${this.levelName} has no levelId - cannot create exits from config`);
      return;
    }

    if (!this.levelConfig) {
      await this.loadLevelConfig();
    }

    if (!this.levelConfig || !this.levelConfig.levels) {
      console.warn(`No level configuration available for ${this.levelId}`);
      return;
    }

    const levelData = this.levelConfig.levels[this.levelId];
    if (!levelData || !levelData.exits) {
      console.log(`No exits configured for level: ${this.levelId}`);
      return;
    }

    console.log(`Creating ${levelData.exits.length} exits for level: ${this.levelId}`);

    levelData.exits.forEach(exitConfig => {
      const exit = new Exit(
        gridCells(exitConfig.position[0]),
        gridCells(exitConfig.position[1]),
        exitConfig.id
      );

      console.log(`Created exit: ${exitConfig.id} at position [${exitConfig.position[0]}, ${exitConfig.position[1]}]`);
      this.addChild(exit);
    });
  }

  async loadLevelConfig() {
    try {
      const response = await fetch('./src/levels/levels-config.json');
      this.levelConfig = await response.json();
      console.log('Level configuration loaded in Level class');
    } catch (error) {
      console.error('Failed to load level configuration in Level class:', error);
    }
  }

  getSpawnPosition(spawnPointId = 'default') {
    if (!this.levelConfig || !this.levelConfig.levels) {
      console.warn('No level configuration available for spawn position');
      return this.heroStartPosition;
    }

    const levelData = this.levelConfig.levels[this.levelId];
    if (!levelData || !levelData.spawnPoints) {
      console.warn(`No spawn points configured for level: ${this.levelId}`);
      return this.heroStartPosition;
    }

    const spawnPoint = levelData.spawnPoints[spawnPointId] || levelData.spawnPoints.default;
    if (!spawnPoint) {
      console.warn(`Spawn point '${spawnPointId}' not found in level '${this.levelId}'`);
      return this.heroStartPosition;
    }

    return new Vector2(gridCells(spawnPoint[0]), gridCells(spawnPoint[1]));
  }

  handleExit(exitData) {
    console.log(`${this.levelName} handling exit: ${exitData.exitId}`);
    this.cleanup();

    events.emit("CHANGE_LEVEL_VIA_EXIT", {
      currentLevelId: this.levelId,
      exitData: exitData,
      multiplayerManager: this.multiplayerManager,
      hero: this.localPlayer
    });
  }

  setLocalPlayer(player) {
    if (!player) return;

    this.localPlayer = player;
    this.localPlayer.addAttribute("currentLevel", this.levelName);
  }

  // Remove this method - multiplayer events should be handled by Main
  setupMultiplayerEvents() {
    // Removed to prevent duplicate event handling
    console.log(`${this.levelName}: Multiplayer events handled by Main class`);
  }

  // Simplified multiplayer event handlers - called by Main
  onMultiplayerConnect(data) {
    // Only handle level-specific logic here
    console.log(`${this.levelName}: Multiplayer connected`);
  }

  onMultiplayerDisconnect(data) {
    console.log(`${this.levelName}: Multiplayer disconnected`);
  }

  onPlayerJoin(data) {
    console.log(`${this.levelName}: Player joined`);
  }

  onPlayerLeave(data) {
    console.log(`${this.levelName}: Player left`);
  }

  // Simplified update method
  update(delta) {
    this.updateAnimatedTiles(delta);

    if (this.localPlayer) {
      this.localPlayer.update(delta);
    }

    // Don't handle multiplayer updates here - let Main handle it
  }

  // Add event listener with duplicate prevention
  addEventListener(eventName, handler) {
    // Check if we already have this event registered
    if (this.eventSubscriptions.has(eventName)) {
      console.warn(`Level ${this.levelName}: Event ${eventName} already registered, skipping duplicate`);
      return;
    }

    const subscription = events.on(eventName, this, handler);
    this.eventSubscriptions.set(eventName, subscription);
    return subscription;
  }

  async ready() {
    await this.createExitsFromConfig();

    this.tilesetImages = await this.propertyHandler.loadTilesetImages(this.mapData.tilesets, "../assets/maps/");
    const { walls, actions } = this.propertyHandler.parseLayerTiles(this.tilesetImages, this.animatedTiles);
    this.walls = walls;
    this.actions = actions;

    // Only set up essential level-specific event listeners
    this.addEventListener("HERO_EXITS", (exitData) => {
      console.log(`${this.levelName} - HERO_EXITS triggered:`, exitData);
      this.handleExit(exitData);
    });

    this.isReady = true;
  }

  drawBackground(ctx) {
    if (!this.mapData || !this.tilesetImages) return;

    this.mapData.layers.forEach(layer => {
      if (layer.type !== "tilelayer") return;

      const width = layer.width;

      layer.data.forEach((tileId, index) => {
        const rawTileId = tileId & 0x1FFFFFFF;
        if (rawTileId === 0) return;

        const tileProps = this.propertyHandler.tilePropertiesMap.get(rawTileId);
        if (tileProps?.collide === false) {
          return;
        }

        this.drawTile(ctx, rawTileId, index, width);
      });
    });
  }

  drawMiddleLayer(ctx) {
    if (!this.mapData || !this.tilesetImages) return;

    this.mapData.layers.forEach(layer => {
      if (layer.type !== "tilelayer") return;

      const width = layer.width;

      layer.data.forEach((tileId, index) => {
        const rawTileId = tileId & 0x1FFFFFFF;
        if (rawTileId === 0) return;

        const tileProps = this.propertyHandler.tilePropertiesMap.get(rawTileId);
        if (tileProps?.collide === false) {
          this.drawTile(ctx, rawTileId, index, width);
        }
      });
    });
  }

  drawTile(ctx, rawTileId, index, width) {
    const drawTileId = this.getAnimatedTileId(rawTileId);

    const tilesetEntry = [...this.tilesetImages.entries()]
      .reverse()
      .find(([firstgid]) => drawTileId >= firstgid);

    if (!tilesetEntry) return;

    const [firstgid, { image, tileset }] = tilesetEntry;
    const localId = drawTileId - firstgid;
    const columns = tileset.columns;

    const sx = Math.floor((localId % columns) * TILE_SIZE);
    const sy = Math.floor(Math.floor(localId / columns) * TILE_SIZE);
    const dx = (index % width) * TILE_SIZE;
    const dy = Math.floor(index / width) * TILE_SIZE;

    if (!image.complete || image.naturalWidth === 0) return;

    ctx.drawImage(
      image,
      sx, sy, TILE_SIZE, TILE_SIZE,
      dx, dy, TILE_SIZE, TILE_SIZE
    );
  }

  getAnimatedTileId(originalTileId) {
    const anim = this.animatedTiles?.get(originalTileId);
    return anim ? anim.frames[anim.currentFrameIndex].tileid : originalTileId;
  }

  updateAnimatedTiles(delta) {
    if (!this.animatedTiles) return;

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

  cleanup() {
    console.log(`Cleaning up level: ${this.levelName}`);
    this.isReady = false;

    // Clean up all event subscriptions
    events.unsubscribe(this);
    this.eventSubscriptions.clear();

    // Clear image caches if needed
    this.tilesetImages.clear();
    this.animatedTiles?.clear();

    // Call parent cleanup  
    super.cleanup && super.cleanup();
  }

  destroy() {
    console.log(`🗑️ Destroying level: ${this.levelName}`);

    if (this.localPlayer) {
      console.log(`Protecting ${this.levelName} player from destruction`);
      this.removeChild(this.localPlayer);
    }

    this.cleanup();
    super.destroy();
  }

  // Other methods remain the same but simplified...
  getRemotePlayers() {
    if (!this.multiplayerManager) return {};
    return this.multiplayerManager.getRemotePlayers();
  }

  isMultiplayerConnected() {
    return this.multiplayerManager && this.multiplayerManager.isSocketConnected();
  }

  getMultiplayerDebugInfo() {
    if (!this.multiplayerManager) return null;
    return this.multiplayerManager.getDebugInfo();
  }

  addWall(position) {
    this.walls.push(position);
  }

  addAction(actionData) {
    this.actions.push(actionData);
  }

  hasWallAt(x, y) {
    return this.walls.some(wall => wall.x === x && wall.y === y);
  }

  getActionAt(x, y) {
    return this.actions.find(action => action.x === x && action.y === y);
  }

  getActionsAt(x, y) {
    const tileX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(y / TILE_SIZE) * TILE_SIZE;
    const key = `${tileX},${tileY}`;
    return this.actions.get(key);
  }

  setPlayerPosition() {
    if (this.localPlayer && this.heroStartPosition) {
      console.log('Setting player position:', this.heroStartPosition);

      this.localPlayer.isSolid = true;
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;
      this.localPlayer.destinationPosition = this.localPlayer.position.duplicate();

      if (typeof this.localPlayer.setPosition === 'function') {
        this.localPlayer.setPosition(this.heroStartPosition.x, this.heroStartPosition.y);
      }

      this.localPlayer.isLocked = true;
      setTimeout(() => {
        this.localPlayer.isLocked = false;
      }, 100);

      events.emit("HERO_POSITION", this.localPlayer.position);
    }
  }
}