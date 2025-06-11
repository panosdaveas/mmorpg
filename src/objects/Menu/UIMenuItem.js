import { UIComponent } from "./UIComponent.js";

export class UIMenuItem extends UIComponent {
    constructor({ label, x, y, width, height, onClick }) {
        super({ x, y, width, height });

        this.label = label;
        this.onClick = onClick;
        this.isSelected = false;
        this.isHovered = false;
        this.tileSize = 16;
    }

    setSelected(selected) {
        this.isSelected = selected;
    }

    onMouseMove(x, y) {
        this.isHovered = this.contains(x, y);
        return this.isHovered;
    }

    onMouseClick(x, y) {
        if (this.contains(x, y) && this.onClick) {
            this.onClick();
            return true;
        }
        return false;
    }

    drawImage(ctx, x, y) {
        if (!this.visible || !ctx) return; // Safety check for context

        ctx.save(); // Save context state

        try {
            ctx.font = "12px fontRetroGaming";

            const textX = x + this.tileSize;
            const textY = y + this.tileSize;

            if (this.isSelected) {
                ctx.fillStyle = "#FFD700";
                ctx.fillText("►", x, textY);
                ctx.fillStyle = "#FFF";
            } else {
                ctx.fillStyle = this.isHovered ? "#FFF" : "#CCC";
            }

            ctx.fillText(this.label, textX, textY);
        } catch (error) {
            // Fallback if font isn't available
            console.warn("Font rendering error:", error);
            ctx.fillStyle = this.isSelected ? "#FFD700" : (this.isHovered ? "#FFF" : "#CCC");
            ctx.fillText(this.label, x + this.tileSize, y + this.tileSize);
        }

        ctx.restore(); // Restore context state
    }
}