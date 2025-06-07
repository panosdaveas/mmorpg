import {GameObject} from "../../GameObject.js";
import {Input} from "../../Input.js";
import {Camera} from "../../Camera.js";
import {Inventory} from "../Inventory/Inventory.js";
import {events} from "../../Events.js";
import {SpriteTextString} from "../SpriteTextString/SpriteTextString.js";
import {storyFlags} from "../../StoryFlags.js";

export class Main extends GameObject {
  constructor() {
    super({});
    this.level = null;
    this.input = new Input()
    this.camera = new Camera()
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

    // Set new level
    this.level = newLevelInstance;
    this.addChild(this.level);

    // Important: Update the camera's reference to the new level
    if (this.camera && this.level.localPlayer) {
      // Reset camera state for new level
      this.camera.lastCenteredPosition = null;
      this.camera.targetPosition = this.level.localPlayer.position;
    }

    if (this.input) {
      this.input.reset();
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
      if (child.drawLayer === "HUD") {
        child.draw(ctx, 0, 0);
      }
    })
  }

}