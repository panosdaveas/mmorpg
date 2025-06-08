import { GameObject } from "./GameObject";
import { Sprite } from "./Sprite";
import { resources } from "./Resource";
import { Vector2 } from "./Vector2";
// Interface.js - Base interface class for UI screens
export class MenuInterface extends GameObject {
    constructor({ position, width, height }) {
        super({
            position: position
        });

        this.width = width;
        this.height = height;
        this.isOpen = false;

        // Create backdrop sprite
        this.backdrop = new Sprite({
            resource: resources.images.interfaceBox,
            frameSize: new Vector2(this.width, this.height)
        });

        this.content = [];
    }

    open() {
        this.isOpen = true;
    }

    close() {
        this.isOpen = false;
    }

    step(delta, root) {
        if (!this.isOpen) return;

        // Update content
        this.content.forEach(item => {
            if (item.step) item.step(delta, root);
        });
    }

    draw(ctx, x, y) {
        if (!this.isOpen) return;

        // Draw backdrop
        this.backdrop.draw(ctx, x, y);

        // Draw content
        this.content.forEach(item => {
            if (item.draw) item.draw(ctx, x, y);
        });
    }
}