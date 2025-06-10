// Menu.js (extends UIComponent for UIManager compatibility)
import { MenuItem } from "./MenuItem.js";
import { UIComponent } from "./UIComponent.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";

export class Menu extends UIComponent {
    constructor({ x, y, width, tileSize = TILE_SIZE, interfaces }) {
        super({ x, y, width, height: tileSize * 8 });

        this.tileSize = tileSize;
        this.interfaces = interfaces;
        this.selectedIndex = 0;
        this.menuItems = this.createMenuItems();
    }

    createMenuItems() {
        const itemHeight = this.tileSize * 1.5;
        const startY = this.y + this.tileSize * 1.5;

        return [
            new MenuItem({
                label: "PROFILE",
                x: this.x + this.tileSize * 2,
                y: startY + itemHeight * 0,
                width: this.width - this.tileSize * 3,
                height: itemHeight,
                onClick: () => console.log("Profile selected - not implemented yet")
            }),
            new MenuItem({
                label: "PLAYERS",
                x: this.x + this.tileSize * 2,
                y: startY + itemHeight * 1,
                width: this.width - this.tileSize * 3,
                height: itemHeight,
                onClick: () => {
                    this.visible = false;
                    this.interfaces.players.open();
                }
            }),
            new MenuItem({
                label: "OPTIONS",
                x: this.x + this.tileSize * 2,
                y: startY + itemHeight * 2,
                width: this.width - this.tileSize * 3,
                height: itemHeight,
                onClick: () => console.log("Options selected - not implemented yet")
            }),
            new MenuItem({
                label: "EXIT",
                x: this.x + this.tileSize * 2,
                y: startY + itemHeight * 3,
                width: this.width - this.tileSize * 3,
                height: itemHeight,
                onClick: () => {
                    console.log("Exit selected");
                    this.visible = false;
                }
            })
        ];
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.fillStyle = "#222";
        ctx.fillRect(this.x, this.y, this.width, this.height);

        this.menuItems.forEach((item, index) => {
            item.draw(ctx, index === this.selectedIndex, this.tileSize);
        });
    }

    step(delta, root) {
        // Optional update logic here
    }

    contains(mouseX, mouseY) {
        return this.menuItems.some(item => item.contains(mouseX, mouseY));
    }

    onClick(x, y) {
        for (let i = 0; i < this.menuItems.length; i++) {
            const item = this.menuItems[i];
            if (item.contains(x, y)) {
                this.selectedIndex = i;
                item.onClick();
                break;
            }
        }
    }

    onHover(x, y) {
        for (let i = 0; i < this.menuItems.length; i++) {
            const item = this.menuItems[i];
            item.isHovered = item.contains(x, y);
            if (item.isHovered) {
                this.selectedIndex = i;
            }
        }
    }
}