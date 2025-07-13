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
    this.tilesetImages = new Map(); // Will be loaded in ready()
    this.animatedTiles = null;
    this.cameraEnabled = null;
    // this.cameraEnabled = params.cameraEnabled !== undefined ? params.cameraEnabled : true;

    this.propertyHandler = new TiledPropertyHandler(this.mapData);
    this.animatedTiles = this.propertyHandler.parseAnimatedTiles(this.mapData.tilesets);

    // Multiplayer support
    // this.multiplayerManager = params.multiplayerManager || null;
    // Level state
    this.isReady = false;
    this.levelName = params.levelName || "Unknown Level";
    this.levelId = params.levelId || null;
    this.levelConfig = null;
    this.heroStartPosition = params.heroPosition || null;

    // Player reference
    this.localPlayer = null;

  }

  setLevelConfig(config) {
    this.levelConfig = config;
  }

  // Automatically create exits from JSON configuration
  async createExitsFromConfig() {
    if (!this.levelId) {
      console.warn(`Level ${this.levelName} has no levelId - cannot create exits from config`);
      return;
    }

    // If we don't have config, try to load it
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

    // Create each configured exit
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

  // Load level configuration if not already available
  async loadLevelConfig() {
    try {
      const response = await fetch('./src/levels/levels-config.json');
      this.levelConfig = await response.json();
      console.log('Level configuration loaded in Level class');
    } catch (error) {
      console.error('Failed to load level configuration in Level class:', error);
    }
  }

  // Get spawn position for this level
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

  // Handle exit events - can be overridden by subclasses for custom behavior
  handleExit(exitData) {
    console.log(`${this.levelName} handling exit: ${exitData.exitId}`);
    this.cleanup();

    // Emit level change request with exit information
    events.emit("CHANGE_LEVEL_VIA_EXIT", {
      currentLevelId: this.levelId,
      exitData: exitData,
      multiplayerManager: this.multiplayerManager,
      hero: this.localPlayer
    });
  }

  // Set the local player for this level
  setLocalPlayer(player) {
    if (!player) return;

    this.localPlayer = player;
    this.localPlayer.addAttribute("currentLevel", this.levelName);

  // Note: Multiplayer setup is handled by Main class in setLevel() 
  // and by Level.ready() method
  }

  // Setup multiplayer events (override in child classes)
  setupMultiplayerEvents() {
    if (!this.multiplayerManager) return;

    // Basic event handlers that most levels might want
    this.multiplayerManager.on('onConnect', (data) => {
      console.log(`${this.levelName}: Connected to multiplayer`);
      this.onMultiplayerConnect(data);
    });

    this.multiplayerManager.on('onDisconnect', (data) => {
      console.log(`${this.levelName}: Disconnected from multiplayer`);
      this.onMultiplayerDisconnect(data);
    });

    this.multiplayerManager.on('onPlayerJoin', (data) => {
      console.log(`${this.levelName}: Player joined`);
      this.onPlayerJoin(data);
    });

    this.multiplayerManager.on('onPlayerLeave', (data) => {
      console.log(`${this.levelName}: Player left`);
      this.onPlayerLeave(data);
    });

    this.multiplayerManager.on('onError', (data) => {
      console.error('Multiplayer error:', data.error);
      this.updateDebugText();
    });

    this.multiplayerManager.on('onPlayerMove', (data) => {
      // Player movement is already handled in MultiplayerManager
      this.updateDebugText();
    });

  }

  // Multiplayer event handlers (override in child classes)
  onMultiplayerConnect(data) {
    // Send initial position if we have a local player
    if (this.localPlayer && this.multiplayerManager.isSocketConnected()) {
      // this.multiplayerManager.sendInitialPosition(this.localPlayer.position);
      this.multiplayerManager.sendInitialPlayerData(this.localPlayer);
    }
  }

  onMultiplayerDisconnect(data) {
    // Handle disconnection - maybe show a reconnection UI
  }

  onPlayerJoin(data) {
    // Handle new player joining - maybe show a notification
  }

  onPlayerLeave(data) {
    // Handle player leaving - maybe show a notification
  }

  // Update method that handles both local and multiplayer updates
  update(delta) {
    this.updateAnimatedTiles(delta);

    // Update local player first
    if (this.localPlayer) {
      this.localPlayer.update(delta);
    }

    // ONLY send multiplayer updates if this level is active and ready
    if (this.multiplayerManager &&
      this.multiplayerManager.isSocketConnected() &&
      this.localPlayer &&
      this.isReady) {

      this.multiplayerManager.sendPositionUpdate(this.localPlayer.position);

      // Send attributes update after the player has been updated
      if (this.localPlayer.attributesChanged) {
        this.localPlayer.addAttribute("currentLevel", this.levelName);
        const currentAttributes = this.localPlayer.getAttributesAsObject();
        this.multiplayerManager.sendAttributesUpdate(currentAttributes);
        this.localPlayer.attributesChanged = false;
      }
    }
  }


  // Called when level becomes active
  async ready() {
    await this.createExitsFromConfig();

    this.tilesetImages = await this.propertyHandler.loadTilesetImages(this.mapData.tilesets, "../assets/maps/");
    const { walls, actions } = this.propertyHandler.parseLayerTiles(this.tilesetImages, this.animatedTiles);
    this.walls = walls;
    this.actions = actions;

    // Setup multiplayer if available
    if (this.multiplayerManager) {
      this.setupMultiplayerEvents();

      // Send initial position if connected
      if (this.multiplayerManager.isSocketConnected() && this.localPlayer) {
        // this.multiplayerManager.sendInitialPosition(this.localPlayer.position);
        this.multiplayerManager.sendInitialPlayerData(this.localPlayer);
      }
    }

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

    events.on("HERO_EXITS", this, (exitData) => {
      console.log(`${this.levelName} - HERO_EXITS triggered:`, exitData);
      this.handleExit(exitData);
    });

    this.isReady = true;
    // Child classes should call super.ready() and then their own logic
  }

  drawBackground(ctx) {
    if (!this.mapData || !this.tilesetImages) return;

    this.mapData.layers.forEach(layer => {
      if (layer.type !== "tilelayer") return;

      const width = layer.width;

      layer.data.forEach((tileId, index) => {
        const rawTileId = tileId & 0x1FFFFFFF;
        if (rawTileId === 0) return;

        // Skip collide: false tiles - they'll be drawn in middle layer
        const tileProps = this.propertyHandler.tilePropertiesMap.get(rawTileId);
        if (tileProps?.collide === false) {
          return;
        }

        // Draw background tiles (collide: true or no collide property)
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

        // Only draw collide: false tiles in middle layer
        const tileProps = this.propertyHandler.tilePropertiesMap.get(rawTileId);
        if (tileProps?.collide === false) {
          this.drawTile(ctx, rawTileId, index, width);
        }
      });
    });
  }

  // Extract the tile drawing logic
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

  // Cleanup when level is changed
  cleanup() {
    console.log(`Cleaning up level: ${this.levelName}`);
    this.isReady = false;

    // 🚨 FIX: Use unsubscribe instead of off with event names
    events.unsubscribe(this);
    // this.children.forEach(child => child.destroy());

    // Clear image caches if needed
    Object.keys(this.tilesetImages).forEach(key => {
      delete this.tilesetImages[key];
    });

    Object.keys(this.animatedTiles).forEach(key => {
      delete this.animatedTiles[key];
    });

    // Call parent cleanup  
    super.cleanup && super.cleanup();
  }

  destroy() {
    console.log(`🗑️ Destroying level: ${this.levelName}`);

    // 🚨 CRITICAL: Remove player before destroying level to prevent destruction
    if (this.localPlayer) {
      console.log(`Protecting ${this.levelName} player from destruction`);
      this.removeChild(this.localPlayer);
    }

    // Call cleanup to remove event listeners
    this.cleanup();

    // Call parent destroy (this will destroy remaining children including Exit objects)
    super.destroy();
  }

  // Get all remote players in this level
  getRemotePlayers() {
    if (!this.multiplayerManager) return {};
    return this.multiplayerManager.getRemotePlayers();
  }

  // Check if multiplayer is connected
  isMultiplayerConnected() {
    return this.multiplayerManager && this.multiplayerManager.isSocketConnected();
  }

  // Get multiplayer debug info
  getMultiplayerDebugInfo() {
    if (!this.multiplayerManager) return null;
    return this.multiplayerManager.getDebugInfo();
  }

  // Add a wall tile
  addWall(position) {
    this.walls.push(position);
  }

  // Add an action tile
  addAction(actionData) {
    this.actions.push(actionData);
  }

  // Check if a position has a wall
  hasWallAt(x, y) {
    return this.walls.some(wall => wall.x === x && wall.y === y);
  }

  // Get action at position
  getActionAt(x, y) {
    return this.actions.find(action => action.x === x && action.y === y);
  }

  // Get actions at a specific position
  getActionsAt(x, y) {
    const tileX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(y / TILE_SIZE) * TILE_SIZE;
    const key = `${tileX},${tileY}`;
    return this.actions.get(key);
  }

  // Extract position-setting logic into reusable method
  setPlayerPosition() {
    if (this.localPlayer && this.heroStartPosition) {
      console.log('Setting player position:', this.heroStartPosition);

      // Stop any current movement
      this.localPlayer.isSolid = true;

      // Set position directly
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;

      // Reset destination position to prevent interpolated movement
      this.localPlayer.destinationPosition = this.localPlayer.position.duplicate();

      // Use setPosition method if available
      if (typeof this.localPlayer.setPosition === 'function') {
        this.localPlayer.setPosition(this.heroStartPosition.x, this.heroStartPosition.y);
      }

      // Lock player briefly to prevent immediate movement
      this.localPlayer.isLocked = true;
      setTimeout(() => {
        this.localPlayer.isLocked = false;
      }, 100);

      // Force position update event
      events.emit("HERO_POSITION", this.localPlayer.position);
    }
    }
}