import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { DOWN, LEFT, RIGHT, UP } from "../../Input.js";
import { gridCells, isSpaceFree } from "../../helpers/grid.js";
import { Sprite } from "../../Sprite.js";
import { resources } from "../../Resource.js";
import { Animations } from "../../Animations.js";
import { FrameIndexPattern } from "../../FrameIndexPattern.js";
import {
  PICK_UP_DOWN,
  STAND_DOWN,
  STAND_LEFT,
  STAND_RIGHT,
  STAND_UP,
  WALK_DOWN,
  WALK_LEFT,
  WALK_RIGHT,
  WALK_UP
} from "./heroAnimations.js";
import { moveTowards } from "../../helpers/moveTowards.js";
import { events } from "../../Events.js";
import { Attribute } from "../../Attributes.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import { WalletConnector } from "../../web3/Wallet.js";

export class Hero extends GameObject {
  constructor(x, y, options = {}) {
    super({
      position: new Vector2(x, y)
    });

    // Track if this is a remote player
    this.isRemote = options.isRemote ?? false;
    this.lastMovementDirection = DOWN; // Track direction of last movement
    this.previousPosition = new Vector2(x, y); // Track previous position for movement detection
    this.lastMovedTime = Date.now(); // Track when we last moved
    this.movementAnimationTimeout = 400; // Stop animation after this many ms
    this.isInteractive = false;
    this.currentLevelName = options.levelName ?? null;
    this.wallet = new WalletConnector(this);
    this.isSolid = true;
    this.signer = null;
    this.eventSubscriptions = [];
    this.messages = [];
    // this.textContent = textConfig.content;
    // this.textPortraitFrame = textConfig.portraitFrame;

    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-8, -19),
    })
    this.addChild(shadow);

    this.body = new Sprite({
      resource: resources.images.hero,
      // resource: !this.isRemote ? resources.images.hero : resources.images.remoteHero,
      frameSize: new Vector2(32, 32),
      hFrames: 3,
      vFrames: 8,
      frame: 1,
      scale: 1,
      position: new Vector2(-8, -20),
      animations: new Animations({
        walkDown: new FrameIndexPattern(WALK_DOWN),
        walkUp: new FrameIndexPattern(WALK_UP),
        walkLeft: new FrameIndexPattern(WALK_LEFT),
        walkRight: new FrameIndexPattern(WALK_RIGHT),
        standDown: new FrameIndexPattern(STAND_DOWN),
        standUp: new FrameIndexPattern(STAND_UP),
        standLeft: new FrameIndexPattern(STAND_LEFT),
        standRight: new FrameIndexPattern(STAND_RIGHT),
        pickUpDown: new FrameIndexPattern(PICK_UP_DOWN),
      })
    })
    this.addChild(this.body);

    this.facingDirection = DOWN;
    this.destinationPosition = this.position.duplicate();
    this.itemPickupTime = 0;
    this.itemPickupShell = null;
    this.isLocked = false;
    this.interactionCooldown = 0; // Cooldown for interactions

    this.attributes = new Map();
    this.attributesChanged = false;

    // React to picking up an item
    events.on("HERO_PICKS_UP_ITEM", this, data => {
      this.onPickUpItem(data)
    })

  }

  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  addAttribute(name, value) {
    this.attributes.set(name, new Attribute(name, value));
    this.attributesChanged = true;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name).get() : undefined;
  }

  getAttributeAsObject(name) {
    return this.attributes.has(name) ? this.attributes.get(name).toJSON() : undefined;
  }

  setAttribute(name, value) {
    if (this.attributes.has(name)) {
      this.attributes.get(name).set(value);
    } else {
      this.addAttribute(name, value);
    }
    this.attributesChanged = true
  }

  getAttributesAsObject() {
    const obj = {};
    for (const [key, attr] of this.attributes.entries()) {
      obj[key] = attr.get();
    }
    return obj;
  }

  loadAttributesFromObject(attributes) {
    for (const key in attributes) {
      // this.attributes = { ...this.attributes, ...attributes };
      this.setAttribute(key, attributes[key]);
    }
    // For remote players, don't mark as needing sync since these are incoming changes
    if (this.isRemote) {
      this.attributesChanged = false;
      }
  }

  // Set appropriate animation based on movement direction
  updateAnimation(movingDirection) {
    if (!movingDirection) {
      // Standing still - use current facing direction
      if (this.facingDirection === LEFT) {
        this.body.animations.play("standLeft");
      } else if (this.facingDirection === RIGHT) {
        this.body.animations.play("standRight");
      } else if (this.facingDirection === UP) {
        this.body.animations.play("standUp");
      } else {
        this.body.animations.play("standDown");
      }
    } else {
      // Moving - update facing direction and play walk animation
      this.facingDirection = movingDirection;

      if (movingDirection === LEFT) {
        this.body.animations.play("walkLeft");
      } else if (movingDirection === RIGHT) {
        this.body.animations.play("walkRight");
      } else if (movingDirection === UP) {
        this.body.animations.play("walkUp");
      } else {
        this.body.animations.play("walkDown");
      }
    }
  }
  

  // New method to handle position updates for remote players
  updateRemotePosition(x, y) {
    // Store previous position before update
    this.previousPosition.x = this.position.x;
    this.previousPosition.y = this.position.y;

    // Update position
    this.position.x = x;
    this.position.y = y;
    this.destinationPosition.x = x;
    this.destinationPosition.y = y;

    // Determine movement direction
    let direction = null;
    const dx = x - this.previousPosition.x;
    const dy = y - this.previousPosition.y;

    // Set movement direction based on largest component
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? RIGHT : LEFT;
    } else if (dy !== 0) {
      direction = dy > 0 ? DOWN : UP;
    }

    if (direction) {
      this.lastMovementDirection = direction;
      // Track last time we moved (for animation timeout)
      this.lastMovedTime = Date.now();
    }
    
    // Update animation based on movement
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.updateAnimation(this.lastMovementDirection);
    } else {
      this.updateAnimation(null); // Standing still
    }
  }

  ready() {
    this.eventSubscriptions = [
      events.on("START_TEXT_BOX", this, () => {
        this.isLocked = true;
      }),
      events.on("END_TEXT_BOX", this, () => {
        this.isLocked = false;
      }),
      events.on("MENU_OPEN", this, () => {
        this.isLocked = true;
      }),
      events.on("MENU_CLOSE", this, () => {
        this.isLocked = false;
      }),
      this.parent?.multiplayerManager.on('onChatMessage', (messageData) => {
        console.log(`Chat from ${messageData.senderName}: ${messageData.message}`);
        this.messages.push(messageData);
        // Show chat bubble or add to chat log
      }),
      this.parent?.multiplayerManager.on('onTradeRequest', (tradeData) => {
        console.log(`Trade request from ${tradeData.senderName}`);
        // Show trade request UI
        showTradeRequestDialog(tradeData);
      }),
    ];
  }

  update(delta) {
    // For remote players, we just want to check if we need to stop animation
    if (this.isRemote) {
      // Check if we should stop the walking animation for remote players
      if (Date.now() - this.lastMovedTime > this.movementAnimationTimeout) {
        this.updateAnimation(null); // Switch to standing animation
      }
      return;
    }

    // Local player update logic follows...
    this.step(delta);
  }

  step(delta, root) {
    // Don't handle input for remote players
    if (this.isRemote) {
      return;
    }

    // Update interaction cooldown
    if (this.interactionCooldown > 0) {
      this.interactionCooldown -= delta;
    }

    // Don't do anything when locked
    if (this.isLocked) {
      return;
    }

    // Lock movement if celebrating an item pickup
    if (this.itemPickupTime > 0) {
      this.workOnItemPickup(delta);
      return;
    }

    // Check for action input (spacebar)
    /** @type {Input} */
    const input = this.parent?.parent?.input;
    if (input?.getActionJustPressed("Space") && this.interactionCooldown <= 0) {
      // Start a small cooldown to prevent rapid-fire interactions
      this.interactionCooldown = 250; // 250ms

      // Try to interact with an action tile or object
      this.tryAction(this.parent?.parent);
    }

    const distance = moveTowards(this, this.destinationPosition, 1);
    const hasArrived = distance <= 1;
    // Attempt to move again if the hero is at his position
    if (hasArrived) {
      this.tryMove(this.parent?.parent)
    }

    this.tryEmitPosition()
  }

  tryEmitPosition() {
    if (this.isRemote) {
      return; // Don't emit for remote players
    }

    if (this.lastX === this.position.x && this.lastY === this.position.y) {
      return;
    }
    this.lastX = this.position.x;
    this.lastY = this.position.y;
    events.emit("HERO_POSITION", this.position)
  }

  tryMove(root) {
    if (!root || !root.input) return;

    const { input } = root;

    // 🚨 NEW: Handle facing direction immediately
    const facingDirection = input.facingDirection;
    if (facingDirection && input.isDirectionJustPressed(facingDirection)) {
      // Immediately update facing direction on first press
      this.facingDirection = facingDirection;
      this.updateAnimation(null); // Standing animation in new direction
    }

    // 🚨 NEW: Only move if direction has been held long enough
    const movementDirection = input.movementDirection;

    if (!movementDirection) {
      // No movement, just maintain current animation
      if (facingDirection) {
        // Still pressing but not long enough to move
        this.updateAnimation(null); // Standing animation
      } else {
        // Not pressing anything
        this.updateAnimation(null);
      }
      return;
    }

    // 🚨 NEW: Check if we just became eligible for movement
    if (input.isDirectionReadyForMovement(movementDirection)) {
    }

    let nextX = this.destinationPosition.x;
    let nextY = this.destinationPosition.y;
    const gridSize = 16;

    if (movementDirection === DOWN) {
      nextY += gridSize;
    }
    if (movementDirection === UP) {
      nextY -= gridSize;
    }
    if (movementDirection === LEFT) {
      nextX -= gridSize;
    }
    if (movementDirection === RIGHT) {
      nextX += gridSize;
    }

    // Update animation for movement
    this.updateAnimation(movementDirection);

    // Validating that the next destination is free
    const spaceIsFree = isSpaceFree(root.level?.walls, nextX, nextY);
    const solidBodyAtSpace = this.parent.children.find(c => {
      return c.isSolid && c.position.x === nextX && c.position.y === nextY
    })

    if (spaceIsFree && !solidBodyAtSpace) {
      this.destinationPosition.x = nextX;
      this.destinationPosition.y = nextY;
    }
  }

  // Try to emit attributes update if changes are pending
  tryEmitAttributesUpdate() {
    // Don't emit for remote players
    if (this.isRemote) {
      return false;
    }

    // Only emit if we have changes and enough time has passed since last sync
    if (this.attributesChanged) {
      const attributes = this.getAttributesAsObject();

      events.emit("HERO_ATTRIBUTES_UPDATE", {
        hero: this,
        attributes: attributes
      });

      this.attributesChanged = false;
      return true;
    }

    return false;
  }

  tryAction(root) {
    // Get the position the hero is facing toward
    const facingPosition = this.getFacingPosition();

    // First, check for interactive game objects at the facing position
    const interactiveObject = this.parent.children.find(child => {
      return child.position.matches(facingPosition) && child.isInteractive;
    });

    if (interactiveObject) {
      // If there's an interactive object, emit an event for it
      events.emit("HERO_REQUESTS_ACTION", interactiveObject);
      if (interactiveObject.isRemote) {

        console.log("INTERACTIVE PLAYER");
        console.log(interactiveObject.getAttribute("address"));
        console.log(interactiveObject.getAttribute("chainId"));

        const remotePlayer = interactiveObject;
        const targetId = remotePlayer.getAttribute("id");
        const multiplayerManager = this.parent?.multiplayerManager;
        if (multiplayerManager) {
          multiplayerManager.sendChatMessage(targetId, 
            'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industrys standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.'
          );
        }

        // Trigger trade to remote player
      }
      return true;
    }

    // If no interactive object, check for action tiles from the property handler
    // if (root.level?.propertyHandler) {
    if (root.level?.actions) {

      const actionTile = root.level?.getActionsAt(facingPosition.x, facingPosition.y);

      if (actionTile) {
        console.log("Found action tile:", actionTile.properties);

        // Handle different types of actions based on properties
        this.handleActionTile(actionTile, root);
        return true;
      }
    }

    // Check if the hero is standing on an action tile
    if (root.level?.propertyHandler) {
      const actionUnderHero = root.level?.getActionsAt(this.position.x, this.position.y);

      if (actionUnderHero && actionUnderHero.properties["ground-action"]) {
        console.log("Found ground action:", actionUnderHero);

        // Handle ground-based action
        this.handleActionTile(actionUnderHero, root);
        return true;
      }
    }

    // No action was performed
    return false;
  }

  getFacingPosition() {
    // Calculate the position in front of the hero based on facing direction
    const facingPosition = this.position.duplicate();
    const gridSize = TILE_SIZE;

    if (this.facingDirection === DOWN) {
      facingPosition.y += gridSize;
    } else if (this.facingDirection === UP) {
      facingPosition.y -= gridSize;
    } else if (this.facingDirection === LEFT) {
      facingPosition.x -= gridSize;
    } else if (this.facingDirection === RIGHT) {
      facingPosition.x += gridSize;
    }

    return facingPosition;
  }

  async handleActionTile(actionTile, root) {
    // Handle different types of actions based on properties
    const properties = actionTile?.properties;

    // Handle NPC dialogue
    if (properties.npc) {
      events.emit("SHOW_TEXT", {
        text: properties.npc,
        speaker: "NPC"
      });
    }

    // Handle interactable objects
    if (properties.interactable) {
      events.emit("INTERACT_WITH_OBJECT", {
        objectId: properties.interactable,
        position: new Vector2(actionTile.x * 16, actionTile.y * 16)
      });
    }

    // Handle action-1 (custom action type 1)
    if (properties?.action === "connectWallet") {
      if (this.getAttribute("address")) {
        console.log("Account connected");
        return;
      }
      this.signer = await this.wallet.connect();
      // console.log(this.signer);
    }    

    if (properties?.action === "action-1") {
      
      console.log("action!")

      events.emit("TRIGGER_ACTION", {
        type: "action",
        value: properties.action,
        position: new Vector2(actionTile.x * 16, actionTile.y * 16)
      });
      console.log(this.messages);
      // this.setAttribute("hp", 50);
    }

    // Handle action-2 (custom action type 2)
    if (properties["action-2"]) {
      events.emit("TRIGGER_ACTION", {
        type: "action-2",
        value: properties["action-2"],
        position: new Vector2(actionTile.x * 16, actionTile.y * 16)
      });
    }

    // Handle teleport action
    if (properties.teleport) {
      const [destX, destY] = properties.teleport.split(',').map(coord => parseInt(coord.trim()));
      if (!isNaN(destX) && !isNaN(destY)) {
        // Lock character briefly during teleport
        this.isLocked = true;

        // Optional: Add teleport effect here

        // Teleport after a short delay
        setTimeout(() => {
          this.position.x = destX * 16;
          this.position.y = destY * 16;
          this.destinationPosition = this.position.duplicate();
          this.isLocked = false;

          // Force position update
          this.tryEmitPosition();
        }, 200);
      }
    }
  }

  onPickUpItem({ image, position }) {
    if (!this.isRemote) {
      if (this.itemPickupTime > 0) {
        console.log('Already picking up, ignoring new pickup event');
        return;
      }
      // Make sure we land right on the item
      this.destinationPosition = position.duplicate();

      // Start the pickup animation
      this.itemPickupTime = 700; // ms

      this.itemPickupShell = new GameObject({});
      this.itemPickupShell.addChild(new Sprite({
        resource: image,
        position: new Vector2(0, -18)
      }))
      this.addChild(this.itemPickupShell);
    }
  }

  workOnItemPickup(delta) {
    this.itemPickupTime -= delta;
    this.body.animations.play("pickUpDown")

    // Remove the item being held overhead
    if (this.itemPickupTime <= 0) {
      this.itemPickupShell.destroy();
    }
  }

  destroy() {
    // Clean up event listeners before destroying
    events.unsubscribe(this);

    // Call parent destroy
    super.destroy();
  }

}