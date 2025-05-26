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

    this.propertyHandler = new TiledPropertyHandler(this.mapData);
    this.animatedTiles = this.propertyHandler.parseAnimatedTiles(this.mapData.tilesets);

    // Multiplayer support
    this.multiplayerManager = params.multiplayerManager || null;

    // Level state
    this.isReady = false;
    this.levelName = params.levelName || "Unknown Level";

    // Player reference
    this.localPlayer = null;

  }

  // Set the local player for this level
  setLocalPlayer(player) {
    this.localPlayer = player;

    // If multiplayer is enabled, notify the manager about the level change
    if (this.multiplayerManager) {
      this.multiplayerManager.setLevel(this);
    }
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

    // Send updates through multiplayer manager after player update
    if (this.multiplayerManager && this.multiplayerManager.isSocketConnected() && this.localPlayer) {
      this.multiplayerManager.sendPositionUpdate(this.localPlayer.position);

      // Send attributes update after the player has been updated
      if (this.localPlayer.attributesChanged) {
        // Get fresh attributes after update
        const currentAttributes = this.localPlayer.getAttributesAsObject();
        this.multiplayerManager.sendAttributesUpdate(currentAttributes);
        this.localPlayer.attributesChanged = false;
      }
    }
    // Child classes should call super.update(delta) and then their own logic
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

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: this.mapData.width * TILE_SIZE,
      height: this.mapData.height * TILE_SIZE,
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
    this.isReady = false;

    // Multiplayer cleanup is handled by the manager itself
    // We don't disconnect here since other levels might use the same connection

    // Child classes should call super.cleanup() for their own cleanup
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
}