// UIComponent.js
export class UIComponent {
  constructor({ x = 0, y = 0, width = 100, height = 100 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.visible = true;
  }

  draw(ctx) {
    // Override in subclasses
  }

  step(delta, root) {
    // Override in subclasses
  }

  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }

  onClick(x, y) {
    // Override in subclasses
  }

  onHover(x, y) {
    // Optional override
  }
} 