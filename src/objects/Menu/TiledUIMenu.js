// TiledUIMenu.js - A menu system using Tiled JSON exports
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { TiledPropertyHandler } from "../../helpers/propertyHandler.js";
import { events } from "../../Events.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import menuData from "../../levels/json/menu.json"; // Import your Tiled JSON data

export class TiledUIMenu extends GameObject {
    constructor({ canvas }) {
        super({
            position: new Vector2(0, 0)
        });

        this.canvas = canvas;
        this.menuData = menuData; // JSON data from Tiled export
        this.propertyHandler = null;
        this.tilesetImages = new Map();
        this.interactiveTiles = []; // Array of navigable tiles and objects
        this.selectedTileIndex = 0;
        this.isVisible = true;
        this.drawLayer = "HUD";

        // Action handlers mapping
        this.actionHandlers = {
            'openProfile': () => this.openProfile(),
            'openPlayers': () => this.openPlayers(),
            'openSettings': () => this.openSettings(),
            'closeMenu': () => this.hide(),
            'action1': () => console.log("Action 1 triggered!"),
            'action2': () => console.log("Action 2 triggered!"),
            // Add more handlers as needed
        };

        this.init();
    }

    async init() {
        // Initialize property handler (same as Level class)
        this.propertyHandler = new TiledPropertyHandler(this.menuData);

        // Load tileset images
        this.tilesetImages = await this.propertyHandler.loadTilesetImages(
            this.menuData.tilesets,
            "../assets/maps/" // UI tilesets folder
        );

        // Parse interactive tiles from the menu data
        this.parseInteractiveTiles();

        // Setup mouse/keyboard listeners
        this.setupEventListeners();
    }

    parseInteractiveTiles() {
        this.interactiveTiles = [];

        // Find layers that contain interactive elements
        this.menuData.layers.forEach(layer => {
            if (layer.type === "tilelayer") {
                this.parseTileLayer(layer);
            } else if (layer.type === "objectgroup") {
                this.parseObjectLayer(layer);
            }
        });

        // Sort by position (top-to-bottom, left-to-right) for logical navigation
        this.interactiveTiles.sort((a, b) => {
            if (a.position.y !== b.position.y) {
                return a.position.y - b.position.y;
            }
            return a.position.x - b.position.x;
        });

        console.log(`Found ${this.interactiveTiles.length} interactive elements`);
    }

    parseTileLayer(layer) {
        const width = layer.width;

        layer.data.forEach((tileId, index) => {
            const rawTileId = tileId & 0x1FFFFFFF;
            if (rawTileId === 0) return;

            // Get tile properties
            const properties = this.propertyHandler.tilePropertiesMap.get(rawTileId);
            if (!properties) return;

            // Check if tile is interactive
            if (properties.navigable || properties.onclick || properties.button) {
                const x = (index % width) * TILE_SIZE;
                const y = Math.floor(index / width) * TILE_SIZE;

                this.interactiveTiles.push({
                    type: 'tile',
                    tileId: rawTileId,
                    properties,
                    position: { x, y },
                    size: { width: TILE_SIZE, height: TILE_SIZE },
                    index: this.interactiveTiles.length,
                    layer: layer.name
                });
            }
        });
    }

    parseObjectLayer(layer) {
        if (!layer.objects) return;

        layer.objects.forEach(obj => {
            // Convert Tiled properties format to our format
            const properties = {};
            if (obj.properties) {
                obj.properties.forEach(prop => {
                    properties[prop.name] = prop.value;
                });
            }

            // Check if object is interactive
            if (properties.navigable || properties.onclick || obj.type === "button") {
                this.interactiveTiles.push({
                    type: 'object',
                    objectId: obj.id,
                    name: obj.name,
                    properties,
                    position: { x: obj.x, y: obj.y },
                    size: { width: obj.width, height: obj.height },
                    index: this.interactiveTiles.length,
                    layer: layer.name,
                    text: obj.text || null, // Store text data if it exists
                    objectType: obj.type
                });
            }
        });
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener("click", (e) => {
            if (this.isVisible) {
                this.handleMouseClick(e);
            }
        });

        this.canvas.addEventListener("mousemove", (e) => {
            if (this.isVisible) {
                this.handleMouseMove(e);
            }
        });
    }

    handleMouseClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Check if click hits any interactive element
        const clickedElement = this.interactiveTiles.find(element => {
            return clickX >= element.position.x &&
                clickX < element.position.x + element.size.width &&
                clickY >= element.position.y &&
                clickY < element.position.y + element.size.height;
        });

        if (clickedElement) {
            this.executeAction(clickedElement.properties.onclick);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Update selection based on mouse position
        const hoveredElementIndex = this.interactiveTiles.findIndex(element => {
            return mouseX >= element.position.x &&
                mouseX < element.position.x + element.size.width &&
                mouseY >= element.position.y &&
                mouseY < element.position.y + element.size.height;
        });

        if (hoveredElementIndex !== -1) {
            this.selectedTileIndex = hoveredElementIndex;
        }
    }

    // Keyboard navigation
    step(delta, root) {
        if (!this.isVisible) return;

        // Arrow key navigation
        if (root.input.getActionJustPressed("ArrowUp")) {
            this.navigateUp();
        }
        if (root.input.getActionJustPressed("ArrowDown")) {
            this.navigateDown();
        }
        if (root.input.getActionJustPressed("ArrowLeft")) {
            this.navigateLeft();
        }
        if (root.input.getActionJustPressed("ArrowRight")) {
            this.navigateRight();
        }

        // Activate selected tile
        if (root.input.getActionJustPressed("Space") ||
            root.input.getActionJustPressed("Enter")) {
            this.activateSelectedTile();
        }

        // Close menu
        if (root.input.getActionJustPressed("Escape")) {
            this.hide();
        }
    }

    navigateUp() {
        const currentElement = this.interactiveTiles[this.selectedTileIndex];
        const candidates = this.interactiveTiles.filter(element =>
            element.position.y < currentElement.position.y &&
            this.elementsOverlap(element, currentElement, 'horizontal')
        );

        if (candidates.length > 0) {
            const closest = candidates.reduce((closest, element) =>
                Math.abs(element.position.y - currentElement.position.y) <
                    Math.abs(closest.position.y - currentElement.position.y) ? element : closest
            );
            this.selectedTileIndex = closest.index;
        }
    }

    navigateDown() {
        const currentElement = this.interactiveTiles[this.selectedTileIndex];
        const candidates = this.interactiveTiles.filter(element =>
            element.position.y > currentElement.position.y &&
            this.elementsOverlap(element, currentElement, 'horizontal')
        );

        if (candidates.length > 0) {
            const closest = candidates.reduce((closest, element) =>
                Math.abs(element.position.y - currentElement.position.y) <
                    Math.abs(closest.position.y - currentElement.position.y) ? element : closest
            );
            this.selectedTileIndex = closest.index;
        }
    }

    navigateLeft() {
        const currentElement = this.interactiveTiles[this.selectedTileIndex];
        const candidates = this.interactiveTiles.filter(element =>
            element.position.x < currentElement.position.x &&
            this.elementsOverlap(element, currentElement, 'vertical')
        );

        if (candidates.length > 0) {
            const closest = candidates.reduce((closest, element) =>
                Math.abs(element.position.x - currentElement.position.x) <
                    Math.abs(closest.position.x - currentElement.position.x) ? element : closest
            );
            this.selectedTileIndex = closest.index;
        }
    }

    navigateRight() {
        const currentElement = this.interactiveTiles[this.selectedTileIndex];
        const candidates = this.interactiveTiles.filter(element =>
            element.position.x > currentElement.position.x &&
            this.elementsOverlap(element, currentElement, 'vertical')
        );

        if (candidates.length > 0) {
            const closest = candidates.reduce((closest, element) =>
                Math.abs(element.position.x - currentElement.position.x) <
                    Math.abs(closest.position.x - currentElement.position.x) ? element : closest
            );
            this.selectedTileIndex = closest.index;
        }
    }

    // Helper method to check if two elements overlap in a given direction
    elementsOverlap(element1, element2, direction) {
        if (direction === 'horizontal') {
            // Check if they overlap horizontally (for up/down navigation)
            const e1Left = element1.position.x;
            const e1Right = element1.position.x + element1.size.width;
            const e2Left = element2.position.x;
            const e2Right = element2.position.x + element2.size.width;

            return !(e1Right <= e2Left || e2Right <= e1Left);
        } else if (direction === 'vertical') {
            // Check if they overlap vertically (for left/right navigation)
            const e1Top = element1.position.y;
            const e1Bottom = element1.position.y + element1.size.height;
            const e2Top = element2.position.y;
            const e2Bottom = element2.position.y + element2.size.height;

            return !(e1Bottom <= e2Top || e2Bottom <= e1Top);
        }
        return false;
    }

    activateSelectedTile() {
        const selectedElement = this.interactiveTiles[this.selectedTileIndex];
        if (selectedElement && selectedElement.properties.onclick) {
            this.executeAction(selectedElement.properties.onclick);
        }
    }

    executeAction(actionName) {
        if (this.actionHandlers[actionName]) {
            this.actionHandlers[actionName]();
        } else {
            console.warn(`No handler found for action: ${actionName}`);
            // Emit a generic event
            events.emit("UI_ACTION", { action: actionName });
        }
    }

    // Action handler methods
    openProfile() {
        console.log("Opening profile...");
        events.emit("OPEN_PROFILE");
    }

    openPlayers() {
        console.log("Opening players list...");
        events.emit("OPEN_PLAYERS");
    }

    openSettings() {
        console.log("Opening settings...");
        events.emit("OPEN_SETTINGS");
    }

    show() {
        this.isVisible = true;
        this.selectedTileIndex = 0;
        events.emit("UI_MENU_OPEN");
    }

    hide() {
        this.isVisible = false;
        events.emit("UI_MENU_CLOSE");
    }

    // Draw the menu (similar to Level drawing)
    draw(ctx) {
        if (!this.isVisible) return;

        ctx.save();

        // Draw background tiles
        this.drawBackground(ctx);

        // Draw objects (buttons, text, etc.)
        this.drawObjects(ctx);

        // Draw selection highlight
        this.drawSelection(ctx);

        ctx.restore();
    }

    drawBackground(ctx) {
        if (!this.menuData || !this.tilesetImages) return;

        this.menuData.layers.forEach(layer => {
            if (layer.type !== "tilelayer") return;

            const width = layer.width;

            layer.data.forEach((tileId, index) => {
                const rawTileId = tileId & 0x1FFFFFFF;
                if (rawTileId === 0) return;

                // Find the correct tileset
                const tilesetEntry = [...this.tilesetImages.entries()]
                    .reverse()
                    .find(([firstgid]) => rawTileId >= firstgid);

                if (!tilesetEntry) return;

                const [firstgid, { image, tileset }] = tilesetEntry;
                const localId = rawTileId - firstgid;
                const columns = tileset.columns;

                const sx = (localId % columns) * TILE_SIZE;
                const sy = Math.floor(localId / columns) * TILE_SIZE;
                const dx = (index % width) * TILE_SIZE;
                const dy = Math.floor(index / width) * TILE_SIZE;

                if (!image.complete || image.naturalWidth === 0) return;

                ctx.drawImage(
                    image,
                    sx, sy, TILE_SIZE, TILE_SIZE,
                    dx, dy, TILE_SIZE, TILE_SIZE
                );
            });
        });
    }

    drawObjects(ctx) {
        if (!this.menuData) return;

        this.menuData.layers.forEach(layer => {
            if (layer.type !== "objectgroup" || !layer.objects) return;

            layer.objects.forEach(obj => {
                this.drawObject(ctx, obj);
            });
        });
    }

    drawObject(ctx, obj) {
        // Draw tile image if object has a gid (tile reference)
        if (obj.gid) {
            this.drawObjectTile(ctx, obj);
        } else {
            // Draw object background/border if it's a button and has no tile
            if (obj.type === "button" || this.isObjectInteractive(obj)) {
                ctx.save();

                // Draw button background
                // ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
                // ctx.fillRect(obj.x, obj.y, obj.width, obj.height);

                // Draw button border
                // ctx.strokeStyle = "#666";
                // ctx.lineWidth = 1;
                // ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

                ctx.restore();
            }
        }

        // Draw text objects (overlays on top of tile or background)
        if (obj.text) {
            ctx.save();

            // Set text properties
            ctx.font = obj.text.fontsize ? `${obj.text.fontsize}px sans-serif` : "12px sans-serif";
            ctx.fillStyle = obj.text.color || "#FFFFFF";
            ctx.textAlign = obj.text.halign || "left";

            // Handle vertical alignment
            let textY = obj.y;
            if (obj.text.valign === "center") {
                textY = obj.y + obj.height / 2;
                ctx.textBaseline = "middle";
            } else if (obj.text.valign === "bottom") {
                textY = obj.y + obj.height;
                ctx.textBaseline = "bottom";
            } else {
                ctx.textBaseline = "top";
            }

            // Draw text with word wrapping if specified
            if (obj.text.wrap) {
                this.drawWrappedText(ctx, obj.text.text, obj.x, textY, obj.width);
            } else {
                ctx.fillText(obj.text.text, obj.x, textY);
            }

            ctx.restore();
        }
    }

    drawObjectTile(ctx, obj) {
        const gid = obj.gid;
        const rawTileId = gid & 0x1FFFFFFF; // Remove flip flags

        // Find the correct tileset for this gid
        const tilesetEntry = [...this.tilesetImages.entries()]
            .reverse()
            .find(([firstgid]) => rawTileId >= firstgid);

        if (!tilesetEntry) {
            console.warn(`No tileset found for gid: ${gid}`);
            return;
        }

        const [firstgid, { image, tileset }] = tilesetEntry;
        const localId = rawTileId - firstgid;
        const columns = tileset.columns;

        // Calculate source position in tileset
        const sx = (localId % columns) * TILE_SIZE;
        const sy = Math.floor(localId / columns) * TILE_SIZE;

        // Handle flip flags (optional - for advanced use)
        const flipHorizontal = (gid & 0x80000000) !== 0;
        const flipVertical = (gid & 0x40000000) !== 0;
        const flipDiagonal = (gid & 0x20000000) !== 0;

        if (!image.complete || image.naturalWidth === 0) return;

        const adjustedY = obj.y - obj.height;

        ctx.save();

        // Handle flipping if needed
        if (flipHorizontal || flipVertical || flipDiagonal) {
            const centerX = obj.x + obj.width / 2;
            const centerY = adjustedY + obj.height / 2;

            ctx.translate(centerX, centerY);

            if (flipDiagonal) {
                // 90-degree rotation + flip
                ctx.rotate(Math.PI / 2);
                ctx.scale(-1, 1);
            } else {
                if (flipHorizontal) ctx.scale(-1, 1);
                if (flipVertical) ctx.scale(1, -1);
            }

            ctx.translate(-centerX, -centerY);
        }

        // Draw the tile image using adjusted Y coordinate
        // Handle different scaling modes
        if (obj.width === TILE_SIZE && obj.height === TILE_SIZE) {
            // 1:1 tile size - draw normally
            ctx.drawImage(
                image,
                sx, sy, TILE_SIZE, TILE_SIZE,
                obj.x, adjustedY, TILE_SIZE, TILE_SIZE
            );
        } else {
            // Object is larger/smaller than tile - stretch or tile the image
            if (obj.width % TILE_SIZE === 0 && obj.height % TILE_SIZE === 0) {
                // Object size is multiple of tile size - tile the image
                const tilesX = obj.width / TILE_SIZE;
                const tilesY = obj.height / TILE_SIZE;

                for (let ty = 0; ty < tilesY; ty++) {
                    for (let tx = 0; tx < tilesX; tx++) {
                        ctx.drawImage(
                            image,
                            sx, sy, TILE_SIZE, TILE_SIZE,
                            obj.x + (tx * TILE_SIZE),
                            adjustedY + (ty * TILE_SIZE),
                            TILE_SIZE, TILE_SIZE
                        );
                    }
                }
            } else {
                // Stretch the tile to fit the object
                ctx.drawImage(
                    image,
                    sx, sy, TILE_SIZE, TILE_SIZE,
                    obj.x, adjustedY, obj.width, obj.height
                );
            }
        }

        ctx.restore();
    }

    drawWrappedText(ctx, text, x, y, maxWidth) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;
        const lineHeight = parseInt(ctx.font) * 1.2;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
    }

    isObjectInteractive(obj) {
        if (!obj.properties) return false;

        return obj.properties.some(prop =>
            prop.name === 'navigable' ||
            prop.name === 'onclick' ||
            prop.name === 'button'
        );
    }

    drawSelection(ctx) {
        if (this.interactiveTiles.length === 0) return;

        const selectedElement = this.interactiveTiles[this.selectedTileIndex];
        if (!selectedElement) return;

        // Draw selection highlight
        ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
        ctx.fillRect(
            selectedElement.position.x,
            selectedElement.position.y,
            selectedElement.size.width,
            selectedElement.size.height
        );

        // Draw selection border
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 2;
        ctx.strokeRect(
            selectedElement.position.x,
            selectedElement.position.y,
            selectedElement.size.width,
            selectedElement.size.height
        );
    }
}