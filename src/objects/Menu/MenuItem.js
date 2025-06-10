// MenuItem.js
export class MenuItem {
    constructor({ label, x, y, width, height, onClick }) {
        this.label = label;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.onClick = onClick;
        this.isHovered = false;
    }

    contains(mouseX, mouseY) {
        return (
            mouseX >= this.x &&
            mouseX <= this.x + this.width &&
            mouseY >= this.y &&
            mouseY <= this.y + this.height
        );
    }

    draw(ctx, isSelected, tileSize, font = "12px fontRetroGaming") {
        ctx.font = font;

        const textX = this.x + tileSize;
        const textY = this.y + tileSize;

        if (isSelected) {
            ctx.fillStyle = "#FFD700";
            ctx.fillText("►", this.x - tileSize * 0.5, textY);
            ctx.fillStyle = "#FFF";
        } else {
            ctx.fillStyle = this.isHovered ? "#FFF" : "#CCC";
        }

        ctx.fillText(this.label, textX, textY);
    }
  }