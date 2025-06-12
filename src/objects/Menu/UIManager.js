// UIManager.js - Simplified to work with step() input handling
import { TILE_SIZE } from "../../constants/worldConstants.js";
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";

export class UIManager extends GameObject {
    constructor(canvas) {
        super({
            position: new Vector2(0, 0)
        });

        this.canvas = canvas;
        this.drawLayer = "HUD";
        this.mouseX = 0;
        this.mouseY = 0;

        // Only setup mouse events for UI interactions
        this.setupMouseListeners();
    }

    setupMouseListeners() {
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("click", this.handleMouseClick.bind(this));
    }

    // Use addChild to register components (standard GameObject way)
    registerComponent(component) {
        this.addChild(component);
        component.uiManager = this;
        this.sortComponents();
        return component;
    }

    sortComponents() {
        this.children.sort((a, b) => (a.layer || 0) - (b.layer || 0));
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.mouseX = (e.clientX - rect.left) * scaleX;
        this.mouseY = (e.clientY - rect.top) * scaleY;

        // Check components in reverse order (front to back)
        for (let i = this.children.length - 1; i >= 0; i--) {
            const component = this.children[i];
            if (component.onMouseMove && component.onMouseMove(this.mouseX, this.mouseY)) {
                break;
            }
        }
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let i = this.children.length - 1; i >= 0; i--) {
            const component = this.children[i];
            if (component.onMouseClick && component.onMouseClick(x, y)) {
                break;
            }
        }
    }
}
