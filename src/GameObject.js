import {Vector2} from "./Vector2.js";
import {events} from "./Events.js";

export class GameObject {
  constructor({ position }) {
    this.position = position ?? new Vector2(0, 0);
    this.children = [];
    this.parent = null;
    this.hasReadyBeenCalled = false;
    this.isSolid = false;
    this.drawLayer = null;
  }

  // First entry point of the loop
  stepEntry(delta, root) {
    // Call updates on all children first
    this.children.forEach((child) => child.stepEntry(delta, root));

    // Call ready on the first frame
    if (!this.hasReadyBeenCalled) {
      this.hasReadyBeenCalled = true;
      this.ready();
    }

    // Call any implemented Step code
    this.step(delta, root);
  }

  // Called before the first `step`
  ready() {
    // ...
  }

  // Called once every frame
  step(_delta) {
    // ...
  }

  /* draw entry */
  draw(ctx, x, y) {
    const drawPosX = x + this.position.x;
    const drawPosY = y + this.position.y;

    // Do the actual rendering for Images
    this.drawImage(ctx, drawPosX, drawPosY);

    // Pass on to children
    this.getDrawChildrenOrdered().forEach((child) => child.draw(ctx, drawPosX, drawPosY));
  }

  getDrawChildrenOrdered() {
    return [...this.children].sort((a,b) => {

      if (b.drawLayer === "FLOOR") {
        return 1;
      }

      // For UI and HUD layers, sort by z-index
      if ((a.drawLayer === "UI" || a.drawLayer === "HUD") &&
        (b.drawLayer === "UI" || b.drawLayer === "HUD")) {
        const aZIndex = a.zIndex || 0;
        const bZIndex = b.zIndex || 0;
        return aZIndex - bZIndex; // Lower z-index draws first
      }

      return a.position.y > b.position.y ? 1 : -1
    })
  }

  drawImage(ctx, drawPosX, drawPosY) {
    //...
  }

  // Remove from the tree
  destroy() {
    // 1. Clean up ALL event listeners for this object FIRST
    events.unsubscribe(this);

    // 2. Destroy all children
    this.children.forEach(child => {
      child.destroy();
    })

    // 3. Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  /* Other Game Objects are nestable inside this one */
  addChild(gameObject) {
    gameObject.parent = this;
    this.children.push(gameObject);
  }

  removeChild(gameObject) {
    // events.unsubscribe(gameObject);
    this.children = this.children.filter(g => {
      return gameObject !== g;
    })
  }
}