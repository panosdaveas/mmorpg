import { GameObject } from "../../GameObject.js";

export class Level extends GameObject {
  constructor(params = {}) {
    super(params);

    // Basic level properties
    this.background = null;
    this.walls = [];
    this.actions = [];

    // Multiplayer support
    this.multiplayerManager = params.multiplayerManager || null;

    // Level state
    this.isReady = false;
    this.levelName = params.levelName || "Unknown Level";

    // Player reference
    this.localPlayer = null;

    // Level-specific handlers
    this.propertyHandler = null;
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
  ready() {
    this.isReady = true;

    // Setup multiplayer if available
    if (this.multiplayerManager) {
      this.setupMultiplayerEvents();

      // Send initial position if connected
      if (this.multiplayerManager.isSocketConnected() && this.localPlayer) {
        // this.multiplayerManager.sendInitialPosition(this.localPlayer.position);
        this.multiplayerManager.sendInitialPlayerData(this.localPlayer);
      }
    }

    // Child classes should call super.ready() and then their own logic
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
}