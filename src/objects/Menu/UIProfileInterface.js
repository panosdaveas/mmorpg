import { UIComponent } from "./UIComponent.js";
import { Sprite } from "../../Sprite.js";
import { Vector2 } from "../../Vector2.js";
import { resources } from "../../Resource.js";
import { events } from "../../Events.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/worldConstants.js";

export class UIProfileInterface extends UIComponent {
    constructor({ hero }) {
        super({
            x: 0,
            y: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            layer: 300 // Higher than other interfaces
        });

        this.tileSize = 16;
        this.visible = false; // Start hidden

        // Create fullscreen backdrop sprite
        this.backdrop = new Sprite({
            resource: resources.images.interface,
            frameSize: new Vector2(CANVAS_WIDTH, CANVAS_HEIGHT),
            position: new Vector2(0, 0)
        });
        this.hero = hero; // Store the hero for player info
    }

    // Use step() for input handling like the old system
    step(delta, root) {
        if (!this.visible || !this.isActive) return;

        // Handle ESC key to close
        if (root.input.getActionJustPressed("Escape")) {
            console.log("Closing Profile Interface");
            this.hide();
            // Show menu again if it exists
            if (this.uiManager) {
                const menu = this.uiManager.children.find(c => c.constructor.name === 'UIMenu');
                if (menu) menu.show();
            }
        }
    }

    getPlayerInfo() {

        const id = this.hero.getAttribute("id") || "Local Player";
        const currentLevel = this.hero.getAttribute("currentLevel") || "Unknown";
        const walletAddress = this.hero.getAttribute("address") || "Not connected";

        return {
            id: id,
            currentLevel: currentLevel,
            walletAddress: walletAddress
        };

    }

    onMouseClick(x, y) {
        if (!this.visible || !this.isActive) return false;
        return this.contains(x, y);
    }

    // Override draw method completely - don't call super.draw
    draw(ctx, x, y) {
        // Safety check for context
        if (!ctx || !this.visible) return;

        // Calculate absolute position (fullscreen, so just use passed coordinates)
        const absX = x;
        const absY = y;

        // Draw dark backdrop
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(absX, absY, this.width, this.height);

        // Draw main panel in center
        const panelWidth = CANVAS_WIDTH * 0.8;
        const panelHeight = CANVAS_HEIGHT * 0.8;
        const panelX = absX + (CANVAS_WIDTH - panelWidth) / 2;
        const panelY = absY + (CANVAS_HEIGHT - panelHeight) / 2;

        // Panel background
        // ctx.fillStyle = "#222";
        // ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

        // // Panel border
        // ctx.strokeStyle = "#666";
        // ctx.lineWidth = 2;
        // ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

        // this.backdrop.draw(ctx, panelX, panelY, panelWidth, panelHeight);
        ctx.drawImage(resources.images.interface.image, panelX, panelY, panelWidth, panelHeight);

        // Title
        ctx.font = "16px fontRetroGaming";
        ctx.fillStyle = "#FFD700";
        const titleX = panelX + this.tileSize * 2;
        const titleY = panelY + this.tileSize * 3;
        ctx.fillText("PLAYER PROFILE", titleX, titleY);

        // Get player info (we need access to root/scene)
        // const playerInfo = this.getPlayerInfo(this.parent?.parent);
        // For now, we'll use placeholder data
        ctx.font = "12px fontRetroGaming";
        ctx.fillStyle = "#FFF";

        let currentY = titleY + this.tileSize * 2;
        const lineHeight = this.tileSize * 1.5;
        const infoX = titleX;

        const playerInfo = this.getPlayerInfo();

        // Player ID
        ctx.fillText("Player ID:", infoX, currentY);
        ctx.fillStyle = "#CCC";
        ctx.fillText(playerInfo.id, infoX + 120, currentY);
        currentY += lineHeight;

        // Current Level
        ctx.fillStyle = "#FFF";
        ctx.fillText("Current Level:", infoX, currentY);
        ctx.fillStyle = "#CCC";
        ctx.fillText(playerInfo.currentLevel, infoX + 120, currentY);
        currentY += lineHeight;

        // Wallet Address
        ctx.fillStyle = "#FFF";
        ctx.fillText("Wallet:", infoX, currentY);
        ctx.fillStyle = "#CCC";
        ctx.fillText(playerInfo.walletAddress, infoX + 120, currentY);
        currentY += lineHeight * 2;

        // Close hint
        ctx.fillStyle = "#666";
        ctx.fillText("Press ESC to close", panelX + this.tileSize*2, panelY + panelHeight - this.tileSize * 2);

        ctx.restore();
    }

    // Don't use drawImage
    drawImage(ctx, x, y) {
        // Not used
    }

    show() {
        this.visible = true;
        this.isActive = true;
        events.emit("MENU_OPEN");
    }

    hide() {
        this.visible = false;
        this.isActive = false;
        events.emit("MENU_CLOSE");
    }
}
