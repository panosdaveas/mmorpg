import { GameObject } from "../../GameObject.js";
import { Input } from "../../Input.js";
import { Camera } from "../../Camera.js";
import { Inventory } from "../Inventory/Inventory.js";
import { events } from "../../Events.js";
import { SpriteTextString } from "../SpriteTextString/SpriteTextString.js";
import { storyFlags } from "../../StoryFlags.js";
import { MultiplayerManager } from "../../client/multiplayerManager.js";
import { LevelManager } from "../Level/LevelManager.js";
import { createTestRemotePlayers, removeTestPlayers } from "../../helpers/createTestRemotePlayers.js";

export class Main extends GameObject {
  constructor(params = {}) {
    super(params);

    // Core game systems
    this.level = null;
    this.input = new Input();
    this.camera = new Camera();
    this.menu = null;
    this.uiManager = null;

    // Initialize the level manager
    this.levelManager = new LevelManager();
    this.currentLevelId = null;

    // Initialize multiplayer manager
    this.multiplayerManager = new MultiplayerManager();
    this.multiplayerEnabled = params.multiplayerEnabled !== false;
    this.serverUrl = params.serverUrl || 'http://localhost:3000';

    // Track subscriptions to prevent duplicates
    this.eventSubscriptions = new Map();
    this.multiplayerSubscriptions = new Map();

    // Connect to multiplayer if enabled
    if (this.multiplayerEnabled) {
      this.connectToMultiplayer();
    }
  }

  connectToMultiplayer() {
    if (!this.multiplayerManager) return;

    try {
      console.log('Connecting to multiplayer server...');
      this.multiplayerManager.connect(this.serverUrl);

      // Setup global multiplayer event handlers ONCE
      this.setupGlobalMultiplayerEvents();

      setTimeout(() => {
        if (this.multiplayerManager?.isSocketConnected()) {
          createTestRemotePlayers(this.multiplayerManager, 1, {
          });
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to connect to multiplayer:', error);
      this.multiplayerEnabled = false;
    }
  }

  setupGlobalMultiplayerEvents() {
    if (!this.multiplayerManager) return;

    // Prevent duplicate setup
    if (this.multiplayerSubscriptions.size > 0) {
      console.warn('Main: Multiplayer events already set up, skipping');
      return;
    }

    // Store subscriptions to track them
    this.multiplayerSubscriptions.set('onConnect',
      this.multiplayerManager.on('onConnect', (data) => {
        console.log('Main: Connected to multiplayer server');

        // Send initial player data once
        if (this.level?.localPlayer && this.multiplayerManager.isSocketConnected()) {
          this.multiplayerManager.sendInitialPlayerData(this.level.localPlayer);
        }

        // Notify current level
        if (this.level?.onMultiplayerConnect) {
          this.level.onMultiplayerConnect(data);
        }
      })
    );

    this.multiplayerSubscriptions.set('onDisconnect',
      this.multiplayerManager.on('onDisconnect', (data) => {
        console.log('Main: Disconnected from multiplayer server');
        if (this.level?.onMultiplayerDisconnect) {
          this.level.onMultiplayerDisconnect(data);
        }
      })
    );

    this.multiplayerSubscriptions.set('onError',
      this.multiplayerManager.on('onError', (data) => {
        console.error('Main: Multiplayer error:', data.error);
      })
    );

    // Let multiplayer manager handle player join/leave internally
    // Levels can still listen if they need level-specific behavior
  }

  getMultiplayerManager() {
    return this.multiplayerManager;
  }

  isMultiplayerConnected() {
    return this.multiplayerManager && this.multiplayerManager.isSocketConnected();
  }

  async ready() {
    await this.levelManager.loadConfig();

    const inventory = new Inventory();
    this.addChild(inventory);

    // Set up core game events ONCE
    this.setupGameEvents();

    // Set up position/attribute tracking ONCE
    this.setupHeroTrackingEvents();
  }

  setupGameEvents() {
    // Prevent duplicate setup
    if (this.eventSubscriptions.size > 0) {
      console.warn('Main: Game events already set up, skipping');
      return;
    }

    this.eventSubscriptions.set('CHANGE_LEVEL',
      events.on("CHANGE_LEVEL", this, newLevelInstance => {
        this.setLevel(newLevelInstance);
      })
    );

    this.eventSubscriptions.set('CHANGE_LEVEL_VIA_EXIT',
      events.on("CHANGE_LEVEL_VIA_EXIT", this, (transitionData) => {
        this.handleLevelTransition(transitionData);
      })
    );

    this.eventSubscriptions.set('CHANGE_LEVEL_BY_ID',
      events.on("CHANGE_LEVEL_BY_ID", this, (levelChangeData) => {
        this.changeLevelById(levelChangeData);
      })
    );

    this.eventSubscriptions.set('TOGGLE_MULTIPLAYER_ON',
      events.on("TOGGLE_MULTIPLAYER_ON", this, () => {
        this.reconnectMultiplayer();
      })
    );

    this.eventSubscriptions.set('TOGGLE_MULTIPLAYER_OFF',
      events.on("TOGGLE_MULTIPLAYER_OFF", this, () => {
        this.disconnectMultiplayer();
      })
    );

    this.eventSubscriptions.set('HERO_REQUESTS_ACTION',
      events.on("HERO_REQUESTS_ACTION", this, (withObject) => {
        this.handleHeroAction(withObject);
      })
    );
  }

  setupHeroTrackingEvents() {
    // Set up hero position tracking ONCE at the Main level
    this.eventSubscriptions.set('HERO_POSITION',
      events.on("HERO_POSITION", this, position => {
        if (this.multiplayerManager && this.multiplayerManager.isSocketConnected()) {
          this.multiplayerManager.sendPositionUpdate(position);
        }
      })
    );

    // Set up hero attributes tracking ONCE at the Main level
    this.eventSubscriptions.set('HERO_ATTRIBUTES_CHANGED',
      events.on("HERO_ATTRIBUTES_CHANGED", this, attributes => {
        if (this.multiplayerManager && this.multiplayerManager.isSocketConnected()) {
          this.multiplayerManager.sendAttributesUpdate(attributes);
        }
      })
    );
  }

  handleHeroAction(withObject) {
    if (typeof withObject.getContent === "function") {
      const content = withObject.getContent();
      if (!content) return;

      console.log(content);

      if (content.addsFlag) {
        console.log("ADD FLAG", content.addsFlag);
        storyFlags.add(content.addsFlag);
      }

      const textbox = new SpriteTextString({
        portraitFrame: content.portraitFrame,
        string: content.string
      });
      this.addChild(textbox);
      events.emit("START_TEXT_BOX");

      const endingSub = events.on("END_TEXT_BOX", this, () => {
        textbox.destroy();
        events.off(endingSub);
      });
    }

    if (withObject?.content) {
      const content = withObject.content;
      if (!content) return;

      console.log(content);

      const textbox = new SpriteTextString({
        string: content
      });
      this.addChild(textbox);
      events.emit("START_TEXT_BOX");

      const endingSub = events.on("END_TEXT_BOX", this, () => {
        textbox.destroy();
        events.off(endingSub);
      });
    }
  }

  stepEntry(delta, root) {
    super.stepEntry(delta, root);

    // Handle multiplayer updates and level updates in one place
    if (this.level) {
      // Update the level
      this.level.update(delta);

      // Handle multiplayer position/attribute sync
      if (this.multiplayerEnabled && this.multiplayerManager && this.level.localPlayer) {
        const localPlayer = this.level.localPlayer;

        // Send position updates (handled by HERO_POSITION event)
        // Send attribute updates
        if (localPlayer.attributesChanged) {
          const currentAttributes = localPlayer.getAttributesAsObject();
          this.multiplayerManager.sendAttributesUpdate(currentAttributes);
          localPlayer.attributesChanged = false;
        }

        // Update remote players
        this.multiplayerManager.updateRemotePlayers(delta);
      }
    }
  }

  handleLevelTransition(transitionData) {
    const { currentLevelId, exitData, multiplayerManager, hero } = transitionData;

    console.log(`Main: Handling level transition from ${currentLevelId} via exit ${exitData.exitId}`);

    try {
      const newLevel = this.levelManager.handleLevelTransition(
        currentLevelId,
        exitData,
        {
          multiplayerManager,
          hero
        }
      );

      if (newLevel) {
        this.currentLevelId = newLevel.levelId;
        this.setLevel(newLevel);
      } else {
        console.error("Failed to create new level from transition");
      }
    } catch (error) {
      console.error("Error during level transition:", error);
    }
  }

  changeLevelById({ levelId, spawnPoint = "default", ...params }) {
    console.log(`Main: Changing to level ${levelId} at spawn ${spawnPoint}`);

    try {
      const newLevel = this.levelManager.createLevel(levelId, spawnPoint, params);
      this.currentLevelId = levelId;
      this.setLevel(newLevel);
    } catch (error) {
      console.error("Error changing level by ID:", error);
    }
  }

  async setLevel(newLevelInstance) {
    // Clean up old level
    if (this.level) {
      if (this.level.cleanup) {
        this.level.cleanup();
      }
      this.level.destroy();
      this.removeChild(this.level);
    }

    // Set the new level
    this.level = newLevelInstance;
    this.addChild(this.level);

    // Pass multiplayer manager reference to the level
    if (this.level && this.multiplayerManager) {
      this.level.multiplayerManager = this.multiplayerManager;

      // Update multiplayer manager's current level
      this.multiplayerManager.setLevel(this.level);
    }

    await this.level.ready();

    // Trigger camera bounds update for new level
    if (this.level.mapData) {
      const { width, height, tilewidth, tileheight } = this.level.mapData;
      events.emit("SET_CAMERA_MAP_BOUNDS", {
        width: width * tilewidth,
        height: height * tileheight,
      });
    }

    // Send initial player data for the new level
    if (this.multiplayerManager?.isSocketConnected() && this.level.localPlayer) {
      this.multiplayerManager.sendInitialPlayerData(this.level.localPlayer);
    }
  }

  disconnectMultiplayer() {
    if (this.multiplayerManager) {
      removeTestPlayers(this.multiplayerManager);
      this.multiplayerManager.disconnect();
      this.multiplayerEnabled = false;
      console.log('Multiplayer disconnected manually');
    }
  }

  reconnectMultiplayer() {
    if (!this.multiplayerEnabled && this.multiplayerManager) {
      this.multiplayerEnabled = true;
      this.connectToMultiplayer();

      if (this.level) {
        this.level.multiplayerManager = this.multiplayerManager;
        this.multiplayerManager.setLevel(this.level);
      }
    }
  }

  cleanup() {
    console.log('Main cleanup called');

    // Clean up event subscriptions
    this.eventSubscriptions.clear();
    this.multiplayerSubscriptions.clear();
    events.unsubscribe(this);

    // Cleanup current level
    if (this.level && this.level.cleanup) {
      this.level.cleanup();
    }

    // Disconnect multiplayer
    if (this.multiplayerManager) {
      this.multiplayerManager.disconnect();
    }

    // Cleanup UI elements
    if (this.menu && this.menu.destroy) {
      this.menu.destroy();
    }

    if (this.uiManager && this.uiManager.destroy) {
      this.uiManager.destroy();
    }

    if (super.cleanup) {
      super.cleanup();
    }
  }

  destroy() {
    this.cleanup();
    super.destroy();
  }

  drawBackground(ctx) {
    if (this.level?.drawBackground) {
      this.level.drawBackground(ctx);
    }
  }

  drawObjects(ctx) {
    const currentLevelName = this.level?.levelName;

    this.children.forEach(child => {
      if (child.drawLayer !== "HUD" && child.drawLayer != "UI") {
        if (child.isRemote && child.currentLevelName !== currentLevelName) {
          return;
        }
        child.draw(ctx, 0, 0);
      }
    })
  }

  drawMiddleLayer(ctx) {
    if (this.level?.drawMiddleLayer) {
      this.level.drawMiddleLayer(ctx);
    }
  }

  drawForeground(ctx) {
    this.children.forEach(child => {
      if (child.drawLayer === "HUD") {
        child.draw(ctx, 0, 0);
      }
    });

    this.children.forEach(child => {
      if (child.drawLayer === "UI") {
        child.draw(ctx, 0, 0);
      }
    });
  }
}