import { GameObject } from "../../GameObject.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import { TiledPropertyHandler } from "../../helpers/propertyHandler.js";
import { events } from "../../Events.js";

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
    this.heroStartPosition = params.heroPosition || null;

    // Player reference
    this.localPlayer = null;

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

    events.on("CHANGE_LEVEL", this, (newLevel) => {
      if (this.multiplayerManager?.sendLevelChangedUpdate) {
        this.multiplayerManager.sendLevelChangedUpdate(newLevel.levelName);
      }
      this.localPlayer.setAttribute("currentLevel", newLevel.levelName);
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
      });
    });
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

    // Remove all event listeners for this level
    events.off("HERO_POSITION", this);
    events.off("HERO_ATTRIBUTES_CHANGED", this);
    events.off("CHANGE_LEVEL", this);
    events.off("HERO_EXITS", this);

    // Call parent cleanup
    super.cleanup && super.cleanup();
  }

  destroy() {
    // 🚨 CRITICAL: Remove player before destroying level to prevent destruction
    if (this.localPlayer) {
      console.log(`Protecting ${this.levelName} player from destruction`);
      this.removeChild(this.localPlayer);
    }

    // Call parent destroy (this will destroy remaining children)
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