// UIMenu.js - Menu as UIComponent with step() input handling
import { UIComponent } from "./UIComponent.js";
import { UIMenuItem } from "./UIMenuItem.js";
import { Sprite } from "../../Sprite.js";
import { Vector2 } from "../../Vector2.js";
import { resources } from "../../Resource.js";
import { events } from "../../Events.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "../../constants/worldConstants.js";

export class UIMenu extends UIComponent {
    constructor({ multiplayerManager, interfaces = {} }) {
        const menuWidth = TILE_SIZE * 10;
        const menuHeight = TILE_SIZE * 12;
        const menuX = CANVAS_WIDTH - menuWidth + TILE_SIZE;
        const menuY = TILE_SIZE;

        super({
            x: menuX,
            y: menuY,
            width: menuWidth,
            height: menuHeight,
            layer: 100
        });

        this.multiplayerManager = multiplayerManager;
        this.interfaces = interfaces;
        this.selectedIndex = 0;
        this.visible = false; // Start hidden

        // Create backdrop sprite (don't add as child, draw manually)
        this.backdrop = new Sprite({
            resource: resources.images.menuBox,
            frameSize: new Vector2(menuWidth, menuHeight),
            position: new Vector2(0, 0)
        });

        this.createUIMenuItems();
    }

    createUIMenuItems() {
        const itemHeight = TILE_SIZE * 1.5;
        const startY = TILE_SIZE * 1.5;

        const menuItemData = [
            {
                label: "PROFILE",
                onClick: () => {
                    this.hide();
                    if (this.interfaces.profile) {
                        this.interfaces.profile.show();
                    }
                }
                // onClick: () => console.log("Profile selected")
            },
            {
                label: "PLAYERS",
                onClick: () => {
                    this.hide();
                    if (this.interfaces.players) {
                        this.interfaces.players.show();
                    }
                }
            },
            {
                label: "OPTIONS",
                onClick: () => console.log("Options selected")
            },
            {
                label: "EXIT",
                onClick: () => {
                    console.log("Exit selected");
                    this.hide();
                }
            }
        ];

        // Store menu items as array, not as children
        this.menuItems = menuItemData.map((item, index) => {
            return new UIMenuItem({
                label: item.label,
                x: TILE_SIZE,
                y: startY + itemHeight * index,
                width: this.width - TILE_SIZE * 3,
                height: itemHeight,
                onClick: item.onClick
            });
        });
    }

    // Add step function to handle input like the old Menu
    step(delta, root) {
        if (!this.visible || !this.isActive) {
            // Handle menu toggle when hidden
            const anyInterfaceOpen = Object.values(this.interfaces).some(interfaceObj => interfaceObj.visible);
            if (root.input.getActionJustPressed("Enter") && !anyInterfaceOpen) {
                this.show();
            }
            return;
        }

        // Call parent step
        super.step(delta, root);

        // Handle menu navigation when visible
        if (root.input.getActionJustPressed("ArrowUp")) {
            this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
            this.updateSelection();
        }

        if (root.input.getActionJustPressed("ArrowDown")) {
            this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
            this.updateSelection();
        }

        // Select item with Space or Enter
        if (root.input.getActionJustPressed("Space") ||
            root.input.getActionJustPressed("Enter")) {
            this.selectCurrentItem();
        }

        // Close menu with Escape
        if (root.input.getActionJustPressed("Escape")) {
            this.hide();
        }

        // Update interfaces
        Object.values(this.interfaces).forEach(interfaceObj => {
            if (interfaceObj.step) {
                interfaceObj.step(delta, root);
            }
        });
    }

    onMouseMove(x, y) {
        if (!this.visible || !this.isActive) return false;

        this.menuItems.forEach((child, index) => {
            // Adjust coordinates relative to this component's position
            const relativeX = x - this.position.x + TILE_SIZE;
            const relativeY = y - this.position.y + TILE_SIZE;
            if (child.contains && child.contains(relativeX, relativeY)) {
                this.selectedIndex = index;
                this.updateSelection();
            }
        });

        return this.contains(x, y);
    }

    onMouseClick(x, y) {
        if (!this.visible || !this.isActive) return false;

        // Check if click is within menu bounds
        if (!this.contains(x, y)) return false;

        // Delegate to menu items using their existing onMouseClick methods
        for (let i = 0; i < this.menuItems.length; i++) {
            const child = this.menuItems[i];
            const relativeX = x - this.position.x + TILE_SIZE;
            const relativeY = y - this.position.y + TILE_SIZE;
            
            if (child.onMouseClick && child.onMouseClick(relativeX, relativeY)) {
                child.onClick();
                return true; // Event handled
            }
        }

        return false;
    }


    // Override draw method completely like the original Menu
    draw(ctx, x, y) {
        if (!this.visible) return;

        // Update interfaces first
        Object.values(this.interfaces).forEach(interfaceObj => {
            if (interfaceObj.draw) {
                interfaceObj.draw(ctx, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
            }
        });

        // Save context state
        ctx.save();

        // Draw menu backdrop
        this.backdrop.draw(ctx, this.position.x, this.position.y - 8);

        // Draw menu items
        ctx.font = "12px fontRetroGaming";

        this.menuItems.forEach((item, index) => {
            const itemX = this.position.x + item.position.x;
            const itemY = this.position.y + item.position.y;

            if (index === this.selectedIndex) {
                ctx.fillStyle = "#FFD700";
                ctx.fillText("►", itemX, itemY);
                ctx.fillStyle = "#FFF";
            } else {
                ctx.fillStyle = item.isHovered ? "#FFF" : "#CCC";
            }

            ctx.fillText(item.label, itemX + 16, itemY);
        });

        // Restore context state
        ctx.restore();
    }

    // Don't use drawImage - we override draw completely
    drawImage(ctx, x, y) {
        // Not used - draw method handles everything
    }

    show() {
        super.show();
        this.selectedIndex = 0;
        this.updateSelection();
        events.emit("MENU_OPEN");
    }

    hide() {
        super.hide();
        events.emit("MENU_CLOSE");
    }

    updateSelection() {
        this.menuItems.forEach((child, index) => {
            if (child.setSelected) {
                child.setSelected(index === this.selectedIndex);
            }
        });
    }

    selectCurrentItem() {
        const selectedItem = this.menuItems[this.selectedIndex];
        if (selectedItem && selectedItem.onClick) {
            selectedItem.onClick();
        }
    }
}
