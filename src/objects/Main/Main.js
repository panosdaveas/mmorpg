import {GameObject} from "../../GameObject.js";
import {Input} from "../../Input.js";
import {Camera} from "../../Camera.js";
import {Inventory} from "../Inventory/Inventory.js";
import {events} from "../../Events.js";
import {SpriteTextString} from "../SpriteTextString/SpriteTextString.js";
import {storyFlags} from "../../StoryFlags.js";
import { MultiplayerManager } from "../../client/multiplayerManager.js";
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

    // Initialize multiplayer manager
    this.multiplayerManager = new MultiplayerManager();
    this.multiplayerEnabled = params.multiplayerEnabled !== false; // Default to true
    this.serverUrl = params.serverUrl || 'http://localhost:3000';

    // Connect to multiplayer if enabled
    if (this.multiplayerEnabled) {
      this.connectToMultiplayer();
    }
  }

  // Initialize multiplayer connection
  connectToMultiplayer() {
    if (!this.multiplayerManager) return;

    try {
      console.log('Connecting to multiplayer server...');
      this.multiplayerManager.connect(this.serverUrl);

      // Setup global multiplayer event handlers
      this.setupGlobalMultiplayerEvents();

      setTimeout(() => {
        if (this.multiplayerManager?.isSocketConnected()) {
          createTestRemotePlayers(this.multiplayerManager, 1, {
          });
        }
      }, 1000); // Give multiplayer 1 second to connect
    } catch (error) {
      console.error('Failed to connect to multiplayer:', error);
      this.multiplayerEnabled = false;
    }
  }

  // Setup multiplayer events that affect the entire game
  setupGlobalMultiplayerEvents() {
    if (!this.multiplayerManager) return;

    this.multiplayerManager.on('onConnect', (data) => {
      console.log('Main: Connected to multiplayer server');
      // Notify current level if it exists
      if (this.level && this.level.onMultiplayerConnect) {
        this.level.onMultiplayerConnect(data);
      }
    });

    this.multiplayerManager.on('onDisconnect', (data) => {
      console.log('Main: Disconnected from multiplayer server');
      // Notify current level if it exists
      if (this.level && this.level.onMultiplayerDisconnect) {
        this.level.onMultiplayerDisconnect(data);
      }
    });

    this.multiplayerManager.on('onError', (data) => {
      console.error('Main: Multiplayer error:', data.error);
      // Could show a global error notification here
    });
  }

  // Public getter for multiplayer manager
  getMultiplayerManager() {
    return this.multiplayerManager;
  }

  // Check if multiplayer is connected
  isMultiplayerConnected() {
    return this.multiplayerManager && this.multiplayerManager.isSocketConnected();
  }

  ready() {
    const inventory = new Inventory();
    this.addChild(inventory);

    // Change Level handler
    events.on("CHANGE_LEVEL", this, async newLevelInstance => {
      await this.setLevel(newLevelInstance);
    });

    // Connect To Multiplayer
    events.on("TOGGLE_MULTIPLAYER_ON", this, () => {
      // this.connectToMultiplayer();
      this.reconnectMultiplayer();
    });

    // Disconnect from Multiplayer
    events.on("TOGGLE_MULTIPLAYER_OFF", this, () => {
      this.disconnectMultiplayer();
    });

    // Launch Text Box handler
    events.on("HERO_REQUESTS_ACTION", this, (withObject) => {
      if (typeof withObject.getContent === "function") {
        const content = withObject.getContent();

        if (!content) {
          return;
        }

        console.log(content);

        // Potentially add a story flag
        if (content.addsFlag) {
          console.log("ADD FLAG", content.addsFlag);
          storyFlags.add(content.addsFlag);
        }

        // Show the textbox
        const textbox = new SpriteTextString({
          portraitFrame: content.portraitFrame,
          string: content.string
        });
        this.addChild(textbox);
        events.emit("START_TEXT_BOX");

        // Unsubscribe from this text box after it's destroyed
        const endingSub = events.on("END_TEXT_BOX", this, () => {
          textbox.destroy();
          events.off(endingSub);
        });
      }
      if (withObject?.content) {
        const content = withObject.content;

        if (!content) {
          return;
        }

        console.log(content);

        // Show the textbox
        const textbox = new SpriteTextString({
          string: content
        });
        this.addChild(textbox);
        events.emit("START_TEXT_BOX");

        // Unsubscribe from this text box after it's destroyed
        const endingSub = events.on("END_TEXT_BOX", this, () => {
          textbox.destroy();
          events.off(endingSub);
        });
      }
    });
  }

  // Override stepEntry to include multiplayer updates
  stepEntry(delta, root) {
    // Call parent stepEntry first
    super.stepEntry(delta, root);

    // Update multiplayer if enabled
    if (this.multiplayerEnabled && this.multiplayerManager) {
      this.multiplayerManager.updateRemotePlayers(delta);
    }
  }

  async setLevel(newLevelInstance) {
    // Clean up old level
    if (this.level) {
      // Cleanup the old level properly
      if (this.level.cleanup) {
        this.level.cleanup();
      }
      this.level.destroy();

      // Remove old level from scene
      this.removeChild(this.level);
    }

    // Set the new level
    this.level = newLevelInstance;
    

    // Pass multiplayer manager to the new level
    if (this.level && this.multiplayerManager) {
      // Set multiplayer manager on the level
      this.level.multiplayerManager = this.multiplayerManager;

      // Notify multiplayer manager about level change
      this.multiplayerManager.setLevel(this.level);

      // Setup multiplayer events for the new level
      if (this.level.setupMultiplayerEvents) {
        this.level.setupMultiplayerEvents();
      }
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

    this.addChild(this.level);
  }

  // Method to disconnect multiplayer (useful for testing or settings)
  disconnectMultiplayer() {
    if (this.multiplayerManager) {
      removeTestPlayers(this.multiplayerManager);
      this.multiplayerManager.disconnect();
      this.multiplayerEnabled = false;
      console.log('Multiplayer disconnected manually');
    }
  }

  // Method to reconnect multiplayer
  reconnectMultiplayer() {
    if (!this.multiplayerEnabled && this.multiplayerManager) {
      this.multiplayerEnabled = true;
      this.connectToMultiplayer();

      // ✅ Re-associate the current level with multiplayer manager
      if (this.level) {
        this.level.multiplayerManager = this.multiplayerManager;
        this.multiplayerManager.setLevel(this.level);

        // Setup multiplayer events for the current level
        if (this.level.setupMultiplayerEvents) {
          this.level.setupMultiplayerEvents();
        }
      }
    }
  }

  // Cleanup method for proper resource management
  cleanup() {
    console.log('Main cleanup called');

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

    // Call parent cleanup
    if (super.cleanup) {
      super.cleanup();
    }
  }

  // Override destroy to include cleanup
  destroy() {
    this.cleanup();
    super.destroy();
  }

  drawBackground(ctx) {
    if (this.level?.drawBackground) {
      this.level.drawBackground(ctx); // ✅ Properly delegate
    }
  }

  drawObjects(ctx) {
    const currentLevelName = this.level?.levelName;

    this.children.forEach(child => {
      if (child.drawLayer !== "HUD" && child.drawLayer != "UI") {
          if (child.isRemote && child.currentLevelName !== currentLevelName) {
            // console.log(child.currentLevelName);
            return; // ⛔ Don't draw remote players not in same level
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
    // First pass: Draw HUD layer
    this.children.forEach(child => {
      if (child.drawLayer === "HUD") {
        child.draw(ctx, 0, 0);
      }
    });

    // Second pass: Draw UI layer (on top of HUD)
    this.children.forEach(child => {
      if (child.drawLayer === "UI") {
        child.draw(ctx, 0, 0);
      }
    });
  }

  cleanup() {
    this.multiplayerManager.disconnect();
  }

}