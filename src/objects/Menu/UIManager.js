import { events } from "../../Events";
// UIManager.js
export class UIManager {
    constructor(canvas) {
        this.components = []; // All registered UI components
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.mouseX = 0;
        this.mouseY = 0;
        // this.isVisible = false;
        this.drawLayer = "HUD"; // Default draw layer

        // Bind events to canvas
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("click", this.handleMouseClick.bind(this));
    }

    register(component) {
        this.components.push(component);
    }

    unregister(component) {
        this.components = this.components.filter(c => c !== component);
    }

    bringToFront(component) {
        this.unregister(component);
        this.register(component);
    }

    draw() {
        for (const component of this.components) {
            if (component.visible !== false && component.draw) {
                component.draw(this.ctx);
            }
        }
    }

    update(delta, root) {
        for (const component of this.components) {
            if (component.visible !== false && component.step) {
                component.step(delta, root);
            }
        }
    }

    show() {
        this.isVisible = true;
        this.selectedIndex = 0;
        events.emit("MENU_OPEN");

        //TODO Hide remote players
    }

    hide() {
        this.isVisible = false;
        events.emit("MENU_CLOSE");

    // Show remote players again
      }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        for (let i = this.components.length - 1; i >= 0; i--) {
            const comp = this.components[i];
            if (comp.contains?.(this.mouseX, this.mouseY)) {
                if (comp.onHover) comp.onHover(this.mouseX, this.mouseY);
                break;
            }
        }
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let i = this.components.length - 1; i >= 0; i--) {
            const comp = this.components[i];
            if (comp.contains?.(x, y)) {
                if (comp.onClick) comp.onClick(x, y);
                break;
            }
        }
    }
  }