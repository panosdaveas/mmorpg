import { MenuInterface } from "../../MenuInterface";
import { Vector2 } from "../../Vector2";
import { SpriteTextString } from "../SpriteTextString/SpriteTextString";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/worldConstants";
// PlayersInterface.js - Interface for showing connected players
export class PlayersInterface extends MenuInterface {
    constructor({ multiplayerManager }) {
        
        const tileSize = 16;
        const interfaceWidth = tileSize * 20; // 320px
        const interfaceHeight = tileSize * 15; // 240px

        // Center the interface
        const centerX = (CANVAS_WIDTH - interfaceWidth) / 2 ;
        const centerY = (CANVAS_HEIGHT - interfaceHeight) / 2;

        super({
            position: new Vector2(centerX, centerY),
            width: interfaceWidth,
            height: interfaceHeight
        });

        this.multiplayerManager = multiplayerManager;
        this.scrollOffset = 0;
        this.maxVisiblePlayers = 10;

        // Title
        // this.title = new SpriteTextString({
        //     string: "Connected Players",
        //     position: new Vector2(tileSize, tileSize)
        // });

        // this.content.push(this.title);

        // Close button hint
        // this.closeHint = new SpriteTextString({
        //     string: "Press ESC to close",
        //     position: new Vector2(tileSize, interfaceHeight - tileSize * 2)
        // });

        // this.content.push(this.closeHint);
    }

    step(delta, root) {
        super.step(delta, root);

        // Handle ESC key to close
        if (this.isOpen && root.input.getActionJustPressed("Escape")) {
            console.log("Closing Players Interface");
            this.close();
            root.menu.show(); // Show menu again
        }

        // Handle scrolling if needed
        const players = this.multiplayerManager.getRemotePlayers();
        if (players.length > this.maxVisiblePlayers) {
            if (root.input.getActionJustPressed("ArrowDown")) {
                this.scrollOffset = Math.min(this.scrollOffset + 1, players.length - this.maxVisiblePlayers);
            }
            if (root.input.getActionJustPressed("ArrowUp")) {
                this.scrollOffset = Math.max(this.scrollOffset - 1, 0);
            }
        }
    }

    draw(ctx, x, y) {
        if (!this.isOpen) return;

        // Draw backdrop first
        this.backdrop.draw(ctx, x, y);

        // Draw title and close hint
        // this.title.draw(ctx, x, y);
        // this.closeHint.draw(ctx, x, y);

        // Draw player list
        const playersObj = this.multiplayerManager.getRemotePlayers();
        const players = Object.entries(playersObj).map(([id, player]) => ({
            id,
            ...player
        }));
        const tileSize = 16;
        const startY = tileSize;

        ctx.save();
        ctx.font = "12px fontRetroGaming";
        ctx.fillStyle = "#333";

        // Create clipping region for scrollable area
        ctx.beginPath();
        ctx.rect(x + tileSize, y + startY, this.width - tileSize * 2, tileSize * 10);
        ctx.clip();

        // Draw players
        players.slice(this.scrollOffset, this.scrollOffset + this.maxVisiblePlayers).forEach((player, index) => {
            const playerY = startY + (index * tileSize * 1.5);
            const playerX = tileSize * 2;
            // Player ID
            ctx.fillText(`ID: ${player.id}`, x + playerX, y + playerY);

            // console.log(player.attributes.get('address').get());
            // Player address (if available)
            const address = "N/A";
            // const address = player.attributes.get('address').get() ?? "N/A";
          
            ctx.fillText(`Address: ${address}`, x + playerX, y + playerY + tileSize);
        });

        ctx.restore();

        // Draw scroll indicators if needed
        if (players.length > this.maxVisiblePlayers) {
            ctx.save();
            ctx.font = "12px fontRetroGaming";
            ctx.fillStyle = "#666";

            if (this.scrollOffset > 0) {
                ctx.fillText("▲", x + this.width - tileSize * 2, y + startY);
            }
            if (this.scrollOffset < players.length - this.maxVisiblePlayers) {
                ctx.fillText("▼", x + this.width - tileSize * 2, y + startY + tileSize * 9);
            }

            ctx.restore();
        }
    }
}
  