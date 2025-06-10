import {GameObject} from "../../GameObject.js";
import {Input} from "../../Input.js";
import {Camera} from "../../Camera.js";
import {Inventory} from "../Inventory/Inventory.js";
import {events} from "../../Events.js";
import {SpriteTextString} from "../SpriteTextString/SpriteTextString.js";
import {storyFlags} from "../../StoryFlags.js";
import { UIManager } from "../Menu/UIManager.js";
import { Menu } from "../Menu/Menu.js";

export class Main extends GameObject {
  constructor() {
    super({});
    this.level = null;
    this.input = new Input()
    this.camera = new Camera()
    this.menu = null; 
  }

  ready() {

    const inventory = new Inventory()
    this.addChild(inventory);

    // Change Level handler
    events.on("CHANGE_LEVEL", this, newLevelInstance => {
      this.setLevel(newLevelInstance)
    })

    // Launch Text Box handler
    events.on("HERO_REQUESTS_ACTION", this, (withObject) => {


      if (typeof withObject.getContent === "function") {
        const content = withObject.getContent();

        if (!content) {
          return;
        }

        console.log(content)
        // Potentially add a story flag
        if (content.addsFlag) {
          console.log("ADD FLAG", content.addsFlag)
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
          events.off(endingSub)
        })
      }

    })
    
    // Wait for the level to fully initialize
  }

  setMenu(menuInstance) {
    // Clean up old menu
    if (this.menu) {
      this.menu.destroy();
    }

    // Set new menu
    this.menu = menuInstance;
    this.addChild(this.menu);

    // Reset input state when changing menus
    if (this.input) {
      this.input.reset();
      console.log('Input reset during menu change');
    }
  }

  setLevel(newLevelInstance) {
    // Clean up old level
    if (this.level) {
      
      
      // Cleanup the old level properly
      if (this.level.cleanup) {
        
        this.level.cleanup();
      }

      // Remove old level from scene
      this.level.destroy();
    }

    // 🚨 CRITICAL FIX: Reset input state when changing levels
    if (this.input) {
      this.input.reset();
      console.log('Input reset during level change');
    }

    // Set new level
    this.level = newLevelInstance;
    this.addChild(this.level);

    // 🚨 Additional fix: Ensure camera is properly initialized for new level
    if (this.camera && this.level.heroStartPosition) {
      // Force camera to immediately center on the new position
      this.camera.position = null;
      this.camera.lastCenteredPosition = null;
      this.camera.targetPosition = this.level.heroStartPosition;
    }
  }

  drawBackground(ctx) {
    if (this.level?.drawBackground) {
      this.level.drawBackground(ctx); // ✅ Properly delegate
    }
  }

  drawObjects(ctx) {
    const currentLevelName = this.level?.levelName;

    this.children.forEach(child => {
      if (child.drawLayer !== "HUD") {
          if (child.isRemote && child.currentLevelName !== currentLevelName) {
            // console.log(child.currentLevelName);
            return; // ⛔ Don't draw remote players not in same level
          }
        child.draw(ctx, 0, 0);
      }
    })
  }

  drawForeground(ctx) {
    this.children.forEach(child => {
      if (child.drawLayer === "HUD" || child.drawLayer === "UI") {
        child.draw(ctx, 0, 0);
      }
    })
  }

}