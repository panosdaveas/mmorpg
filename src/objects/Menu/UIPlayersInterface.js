// UIPlayersInterface.js - With step() input handling and custom draw method
import { UIComponent } from "./UIComponent.js";
import { Sprite } from "../../Sprite.js";
import { Vector2 } from "../../Vector2.js";
import { resources } from "../../Resource.js";
import { events } from "../../Events.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/worldConstants.js";

export class UIPlayersInterface extends UIComponent {
    constructor({ multiplayerManager }) {
        const tileSize = 16;
        const interfaceWidth = tileSize * 20;
        const interfaceHeight = tileSize * 15;
        const centerX = (CANVAS_WIDTH - interfaceWidth) / 2;
        const centerY = (CANVAS_HEIGHT - interfaceHeight) / 2;

        super({
            x: centerX,
            y: centerY,
            width: interfaceWidth,
            height: interfaceHeight,
            layer: 200
        });

        this.multiplayerManager = multiplayerManager;
        this.scrollOffset = 0;
        this.maxVisiblePlayers = 10;
        this.tileSize = tileSize;
        this.visible = false; // Start hidden

        // Create backdrop sprite (don't add as child, draw manually)
        this.backdrop = new Sprite({
            resource: resources.images.interface,
            frameSize: new Vector2(interfaceWidth, interfaceHeight),
            position: new Vector2(0, 0)
        });
    }

    // Use step() for input handling like the old system
    step(delta, root) {
        if (!this.visible || !this.isActive) return;

        // Call parent step
        super.step(delta, root);

        // Handle ESC key to close
        if (root.input.getActionJustPressed("Escape")) {
            console.log("Closing Players Interface");
            this.hide();
            // Show menu again if it exists
            if (this.uiManager) {
                const menu = this.uiManager.children.find(c => c.constructor.name === 'UIMenu');
                if (menu) menu.show();
            }
        }

        // Handle scrolling if needed
        const players = this.getPlayersList();
        if (players.length > this.maxVisiblePlayers) {
            if (root.input.getActionJustPressed("ArrowDown")) {
                this.scrollOffset = Math.min(this.scrollOffset + 1, players.length - this.maxVisiblePlayers);
            }
            if (root.input.getActionJustPressed("ArrowUp")) {
                this.scrollOffset = Math.max(this.scrollOffset - 1, 0);
            }
        }
    }

    getPlayersList() {
        const playersObj = this.multiplayerManager.getRemotePlayers();
        return Object.entries(playersObj).map(([id, player]) => ({ id, ...player }));
    }

    // Override draw method completely like the original PlayersInterface
    draw(ctx, x, y) {
        if (!this.visible) return;

        // Draw backdrop first
        this.backdrop.draw(ctx, this.position.x, this.position.y);

        // Draw title and content
        ctx.save();
        ctx.font = "12px fontRetroGaming";
        ctx.fillStyle = "#FFF";
        ctx.fillText("Connected Players", this.position.x + this.tileSize, this.position.y + this.tileSize * 2);

        // Draw players list
        const players = this.getPlayersList();
        const startY = this.tileSize * 3;
        ctx.fillStyle = "#333";

        // Create clipping region for scrollable area
        ctx.beginPath();
        ctx.rect(this.position.x + this.tileSize, this.position.y + startY, this.width - this.tileSize * 2, this.tileSize * 10);
        ctx.clip();

        // Draw players
        const visiblePlayers = players.slice(this.scrollOffset, this.scrollOffset + this.maxVisiblePlayers);
        visiblePlayers.forEach((player, index) => {
            const playerY = startY + (index * this.tileSize * 1.5);
            const playerX = this.tileSize * 2;

            ctx.fillText(`ID: ${player.id}`, this.position.x + playerX, this.position.y + playerY);
            ctx.fillText(`Address: N/A`, this.position.x + playerX, this.position.y + playerY + this.tileSize);
        });

        ctx.restore();

        // Draw scroll indicators if needed
        if (players.length > this.maxVisiblePlayers) {
            ctx.save();
            ctx.font = "12px fontRetroGaming";
            ctx.fillStyle = "#666";

            if (this.scrollOffset > 0) {
                ctx.fillText("▲", this.position.x + this.width - this.tileSize * 2, this.position.y + startY);
            }
            if (this.scrollOffset < players.length - this.maxVisiblePlayers) {
                ctx.fillText("▼", this.position.x + this.width - this.tileSize * 2, this.position.y + startY + this.tileSize * 9);
            }

            ctx.restore();
        }

        // Draw close hint
        ctx.save();
        ctx.font = "12px fontRetroGaming";
        ctx.fillStyle = "#666";
        ctx.fillText("Press ESC to close", this.position.x + this.tileSize, this.position.y + this.height - this.tileSize * 2);
        ctx.restore();
    }

    // Don't use drawImage - we override draw completely
    drawImage(ctx, x, y) {
        // Not used - draw method handles everything
    }

    show() {
        super.show();
        this.scrollOffset = 0;
        events.emit("MENU_OPEN");
    }

    hide() {
        super.hide();
        events.emit("MENU_CLOSE");
    }
}
