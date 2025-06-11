// UIMenu.js - Menu as UIComponent with step() input handling
import { UIComponent } from "./UIComponent.js";
import { UIMenuItem } from "./UIMenuItem.js";
import { Sprite } from "../../Sprite.js";
import { Vector2 } from "../../Vector2.js";
import { resources } from "../../Resource.js";
import { events } from "../../Events.js";
import { CANVAS_WIDTH, TILE_SIZE } from "../../constants/worldConstants.js";

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

        // Create backdrop sprite
        // this.backdrop = new Sprite({
        //     resource: resources.images.menuBox,
        //     frameSize: new Vector2(menuWidth, menuHeight),
        //     position: new Vector2(0, 0)
        // });

        // Create menu backdrop sprite
      
        this.backdrop = new Sprite({
            resource: resources.images.menuBox.isLoaded,
            frameSize: new Vector2(this.menuWidth, this.menuHeight)
          });
        this.addChild(this.backdrop);

        this.createMenuItems();
    }

    createMenuItems() {
        const itemHeight = TILE_SIZE * 1.5;
        const startY = TILE_SIZE * 1.5;

        const menuItems = [
            {
                label: "PROFILE",
                onClick: () => console.log("Profile selected")
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

        menuItems.forEach((item, index) => {
            const menuItem = new UIMenuItem({
                label: item.label,
                x: TILE_SIZE,
                y: startY + itemHeight * index,
                width: this.width - TILE_SIZE * 2,
                height: itemHeight,
                onClick: item.onClick,
            });

            this.addChild(menuItem);
        });
    }

    // Add step function to handle input like the old Menu
    step(delta, root) {
        if (!this.visible || !this.isActive) {
            // Handle menu toggle when hidden
            if (root.input.getActionJustPressed("Enter")) {
                this.show();
            }
            return;
        }

        // Call parent step
        super.step(delta, root);

        // Handle menu navigation when visible
        if (root.input.getActionJustPressed("ArrowUp")) {
            const menuItems = this.children.filter(c => c instanceof UIMenuItem);
            this.selectedIndex = (this.selectedIndex - 1 + menuItems.length) % menuItems.length;
            this.updateSelection();
        }

        if (root.input.getActionJustPressed("ArrowDown")) {
            const menuItems = this.children.filter(c => c instanceof UIMenuItem);
            this.selectedIndex = (this.selectedIndex + 1) % menuItems.length;
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

        const menuItems = this.children.filter(c => c instanceof UIMenuItem);
        menuItems.forEach((child, index) => {
            // Adjust coordinates relative to this component's position
            const relativeX = x - this.position.x;
            const relativeY = y - this.position.y;
            if (child.contains && child.contains(relativeX, relativeY)) {
                this.selectedIndex = index;
                this.updateSelection();
            }
        });

        return this.contains(x, y);
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

    drawImage(ctx, x, y) {
        // Background is handled by backdrop sprite child
        // Menu items are handled by MenuItem children
    }

    updateSelection() {
        const menuItems = this.children.filter(c => c instanceof UIMenuItem);
        menuItems.forEach((child, index) => {
            if (child.setSelected) {
                child.setSelected(index === this.selectedIndex);
            }
        });
    }

    selectCurrentItem() {
        const menuItems = this.children.filter(c => c instanceof UIMenuItem);
        const selectedItem = menuItems[this.selectedIndex];
        if (selectedItem && selectedItem.onClick) {
            selectedItem.onClick();
        }
    }
}