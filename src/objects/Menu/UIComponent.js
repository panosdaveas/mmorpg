// UIComponent.js - Base class for UI components
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/worldConstants.js";

export class UIComponent extends GameObject {
  constructor({ x = 0, y = 0, width = CANVAS_WIDTH, height = CANVAS_HEIGHT, layer = 0 }) {
    super({
      position: new Vector2(x, y)
    });

    this.width = width;
    this.height = height;
    this.layer = layer;
    this.isActive = true;
    this.drawLayer = "HUD"; // All UI components draw in HUD layer
    this.visible = true; // Default to visible
  }

  // Input handling - override in subclasses
  onKeyDown(key, root) {
    return false; // Return true if handled
  }

  onMouseMove(x, y) {
    return false; // Return true if handled
  }

  onMouseClick(x, y) {
    return false; // Return true if handled
  }

  // Utility methods
  contains(x, y) {
    return x >= this.position.x && x <= this.position.x + this.width &&
      y >= this.position.y && y <= this.position.y + this.height;
  }

  show() {
    this.visible = true;
    this.isActive = true;
  }

  hide() {
    this.visible = false;
    this.isActive = false;
  }

  // Override GameObject drawImage - default does nothing
  drawImage(ctx, x, y) {
    // Override in subclasses if needed
    // Base UIComponent doesn't draw anything itself
  }

  // Override GameObject draw to respect visible flag
  draw(ctx, x, y) {
    if (this.visible === false) return;
    super.draw(ctx, x, y);
  }

  step(delta, root) {
    if (this.visible === false || !this.isActive) return;
    super.step(delta, root);
  }
}
