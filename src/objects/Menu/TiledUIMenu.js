// TiledUIMenu.js - Enhanced with class-based button system
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { TiledPropertyHandler } from "../../helpers/propertyHandler.js";
import { events } from "../../Events.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import menuData from "../../levels/json/menu.json";

export class TiledUIMenu extends GameObject {
    constructor({ canvas }) {
        super({
            position: new Vector2(0, 0)
        });

        this.canvas = canvas;
        this.menuData = menuData;
        this.propertyHandler = null;
        this.tilesetImages = new Map();
        this.interactiveTiles = [];
        this.buttonComponents = new Map(); // Store button component groups
        this.selectedTileIndex = 0;
        this.isVisible = true;
        this.drawLayer = "HUD";
        this.hoveredButtonId = null;
        this.pressedButtonId = null;

        // Action handlers mapping
        this.actionHandlers = {
            'openProfile': () => this.openProfile(),
            'openPlayers': () => this.openPlayers(),
            'openSettings': () => this.openSettings(),
            'closeMenu': () => this.hide(),
            'action1': () => console.log("Action 1 triggered!"),
            'action2': () => console.log("Action 2 triggered!"),
        };

        this.init();
    }

    async init() {
        // Initialize property handler
        this.propertyHandler = new TiledPropertyHandler(this.menuData);

        // Load tileset images
        this.tilesetImages = await this.propertyHandler.loadTilesetImages(
            this.menuData.tilesets,
            "../assets/maps/"
        );

        // Parse class-based interactive components
        this.parseClassBasedComponents();

        // Setup event listeners
        this.setupEventListeners();
    }

    parseClassBasedComponents() {
        this.interactiveTiles = [];
        this.buttonComponents = new Map();

        this.menuData.layers.forEach(layer => {
            if (layer.type === "tilelayer") {
                this.parseTileLayer(layer);
            } else if (layer.type === "objectgroup") {
                this.parseObjectLayerClassBased(layer);
            }
        });

        // Sort interactive tiles for navigation
        this.interactiveTiles.sort((a, b) => {
            if (a.position.y !== b.position.y) {
                return a.position.y - b.position.y;
            }
            return a.position.x - b.position.x;
        });

        console.log(`Found ${this.interactiveTiles.length} interactive elements`);
        console.log(`Found ${this.buttonComponents.size} button components`);
    }

    parseObjectLayerClassBased(layer) {
        if (!layer.objects) return;

        // Check if this layer has a class property
        const layerProperties = this.convertPropertiesToObject(layer.properties);

        if (layerProperties.type === 'button' || layer.class === 'Button') {
            // This is a button component layer
            this.parseButtonComponent(layer);
        } else {
            // Parse as regular objects
            this.parseRegularObjects(layer);
        }
    }

    parseButtonComponent(layer) {
        const layerProperties = this.convertPropertiesToObject(layer.properties);
        const buttonId = layer.id || layer.name;

        // Create button component
        const buttonComponent = {
            id: buttonId,
            layerName: layer.name,
            properties: layerProperties,
            states: {
                normal: [],
                hover: [],
                pressed: []
            },
            currentState: 'normal',
            bounds: null // Will be calculated from normal state objects
        };

        // Group objects by their button state
        layer.objects.forEach(obj => {
            const objProperties = this.convertPropertiesToObject(obj.properties);
            const buttonState = this.getButtonStateFromType(obj.type);

            if (buttonState) {
                const stateObject = {
                    id: obj.id,
                    name: obj.name,
                    gid: obj.gid,
                    position: { x: obj.x, y: obj.y },
                    size: { width: obj.width, height: obj.height },
                    visible: obj.visible,
                    properties: objProperties,
                    type: obj.type,
                    rotation: obj.rotation || 0
                };

                buttonComponent.states[buttonState].push(stateObject);

                // Calculate bounds from normal state objects (they define the interactive area)
                if (buttonState === 'normal') {
                    // Use the same Y coordinate as stored in object (no adjustment for bounds)
                    // The adjustment only happens during rendering, not for mouse interaction
                    if (!buttonComponent.bounds) {
                        buttonComponent.bounds = {
                            x: obj.x,
                            y: obj.y,
                            width: obj.width,
                            height: obj.height
                        };
                    } else {
                        // Expand bounds to include this object
                        const left = Math.min(buttonComponent.bounds.x, obj.x);
                        const top = Math.min(buttonComponent.bounds.y, obj.y);
                        const right = Math.max(buttonComponent.bounds.x + buttonComponent.bounds.width, obj.x + obj.width);
                        const bottom = Math.max(buttonComponent.bounds.y + buttonComponent.bounds.height, obj.y + obj.height);

                        buttonComponent.bounds = {
                            x: left,
                            y: top,
                            width: right - left,
                            height: bottom - top
                        };
                    }
                }
            }
        });

        // Add to button components
        this.buttonComponents.set(buttonId, buttonComponent);

        // Add to interactive tiles for navigation
        if (buttonComponent.bounds && layerProperties.navigable) {
            this.interactiveTiles.push({
                type: 'button_component',
                buttonId: buttonId,
                properties: layerProperties,
                position: { x: buttonComponent.bounds.x, y: buttonComponent.bounds.y },
                size: { width: buttonComponent.bounds.width, height: buttonComponent.bounds.height },
                index: this.interactiveTiles.length,
                layer: layer.name
            });
        }
    }

    parseRegularObjects(layer) {
        layer.objects.forEach(obj => {
            const properties = this.convertPropertiesToObject(obj.properties);

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
                    text: obj.text || null,
                    objectType: obj.type,
                    gid: obj.gid
                });
            }
        });
    }

    parseTileLayer(layer) {
        const width = layer.width;

        layer.data.forEach((tileId, index) => {
            const rawTileId = tileId & 0x1FFFFFFF;
            if (rawTileId === 0) return;

            const properties = this.propertyHandler.tilePropertiesMap.get(rawTileId);
            if (!properties) return;

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

    getButtonStateFromType(objectType) {
        if (!objectType) return null;

        const lowerType = objectType.toLowerCase();
        if (lowerType.includes('normal')) return 'normal';
        if (lowerType.includes('hover')) return 'hover';
        if (lowerType.includes('pressed') || lowerType.includes('press')) return 'pressed';

        return null;
    }

    convertPropertiesToObject(propertiesArray) {
        const properties = {};
        if (propertiesArray) {
            propertiesArray.forEach(prop => {
                properties[prop.name] = prop.value;
            });
        }
        return properties;
    }

    setupEventListeners() {
        if (!this.canvas) return;

        // Mouse events for hover and click
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    handleMouseMove(e) {
        if (!this.isVisible) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        let hoveredButton = null;
        let hoveredElementIndex = -1;

        // Check button components for hover states
        for (const [buttonId, component] of this.buttonComponents) {
            if (this.isPointInBounds(mouseX, mouseY, component.bounds)) {
                hoveredButton = buttonId;
                break;
            }
        }

        // Find hovered interactive element for selection rectangle
        hoveredElementIndex = this.interactiveTiles.findIndex(element => {
            return mouseX >= element.position.x &&
                mouseX < element.position.x + element.size.width &&
                mouseY >= element.position.y &&
                mouseY < element.position.y + element.size.height;
        });

        // Update selection index for yellow rectangle
        if (hoveredElementIndex !== -1) {
            this.selectedTileIndex = hoveredElementIndex;
        }

        // Update button hover state
        if (hoveredButton !== this.hoveredButtonId) {
            // Clear previous hover
            if (this.hoveredButtonId) {
                this.setButtonState(this.hoveredButtonId, 'normal');
            }

            // Set new hover
            this.hoveredButtonId = hoveredButton;
            if (hoveredButton) {
                this.setButtonState(hoveredButton, 'hover');
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }

    handleMouseDown(e) {
        if (!this.isVisible || !this.hoveredButtonId) return;

        this.pressedButtonId = this.hoveredButtonId;
        this.setButtonState(this.pressedButtonId, 'pressed');
    }

    handleMouseUp(e) {
        if (!this.isVisible) return;

        if (this.pressedButtonId) {
            const component = this.buttonComponents.get(this.pressedButtonId);
            if (component && this.hoveredButtonId === this.pressedButtonId) {
                // Execute button action
                if (component.properties.onclick) {
                    this.executeAction(component.properties.onclick);
                }
            }

            // Reset to hover state if still hovering, normal otherwise
            this.setButtonState(this.pressedButtonId, this.hoveredButtonId === this.pressedButtonId ? 'hover' : 'normal');
            this.pressedButtonId = null;
        }
    }

    handleMouseLeave() {
        if (this.hoveredButtonId) {
            this.setButtonState(this.hoveredButtonId, 'normal');
            this.hoveredButtonId = null;
        }
        if (this.pressedButtonId) {
            this.setButtonState(this.pressedButtonId, 'normal');
            this.pressedButtonId = null;
        }
        this.canvas.style.cursor = 'default';
    }

    handleKeyDown(e) {
        if (!this.isVisible) return;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.navigateUp();
                e.preventDefault();
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.navigateDown();
                e.preventDefault();
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.navigateLeft();
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.navigateRight();
                e.preventDefault();
                break;
            case 'Enter':
            case 'Space':
                this.activateSelectedTile();
                e.preventDefault();
                break;
        }
    }

    setButtonState(buttonId, state) {
        const component = this.buttonComponents.get(buttonId);
        if (component) {
            component.currentState = state;
        }
    }

    isPointInBounds(x, y, bounds) {
        return x >= bounds.x && x < bounds.x + bounds.width &&
            y >= bounds.y && y < bounds.y + bounds.height;
    }

    // Navigation methods (keeping existing logic)
    navigateUp() {
        this.navigate('up');
    }

    navigateDown() {
        this.navigate('down');
    }

    navigateLeft() {
        this.navigate('left');
    }

    navigateRight() {
        this.navigate('right');
    }

    navigate(direction) {
        if (this.interactiveTiles.length === 0) return;

        const currentElement = this.interactiveTiles[this.selectedTileIndex];
        const candidates = this.findNavigationCandidates(currentElement, direction);

        if (candidates.length > 0) {
            this.selectedTileIndex = candidates[0].index;
        }
    }

    findNavigationCandidates(currentElement, direction) {
        const candidates = [];

        this.interactiveTiles.forEach((element, index) => {
            if (index === this.selectedTileIndex) return;

            const isValidDirection = this.isValidNavigationDirection(currentElement, element, direction);
            if (isValidDirection) {
                const distance = this.calculateNavigationDistance(currentElement, element, direction);
                candidates.push({ element, index, distance });
            }
        });

        return candidates.sort((a, b) => a.distance - b.distance);
    }

    isValidNavigationDirection(from, to, direction) {
        const threshold = 8;

        switch (direction) {
            case 'up':
                return to.position.y < from.position.y - threshold &&
                    this.hasOverlap(from, to, 'horizontal');
            case 'down':
                return to.position.y > from.position.y + from.size.height + threshold &&
                    this.hasOverlap(from, to, 'horizontal');
            case 'left':
                return to.position.x < from.position.x - threshold &&
                    this.hasOverlap(from, to, 'vertical');
            case 'right':
                return to.position.x > from.position.x + from.size.width + threshold &&
                    this.hasOverlap(from, to, 'vertical');
            default:
                return false;
        }
    }

    calculateNavigationDistance(from, to, direction) {
        const fromCenterX = from.position.x + from.size.width / 2;
        const fromCenterY = from.position.y + from.size.height / 2;
        const toCenterX = to.position.x + to.size.width / 2;
        const toCenterY = to.position.y + to.size.height / 2;

        switch (direction) {
            case 'up':
            case 'down':
                return Math.abs(fromCenterY - toCenterY) + Math.abs(fromCenterX - toCenterX) * 0.1;
            case 'left':
            case 'right':
                return Math.abs(fromCenterX - toCenterX) + Math.abs(fromCenterY - toCenterY) * 0.1;
            default:
                return Infinity;
        }
    }

    hasOverlap(element1, element2, direction) {
        if (direction === 'horizontal') {
            const e1Left = element1.position.x;
            const e1Right = element1.position.x + element1.size.width;
            const e2Left = element2.position.x;
            const e2Right = element2.position.x + element2.size.width;

            return !(e1Right <= e2Left || e2Right <= e1Left);
        } else if (direction === 'vertical') {
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
        if (!selectedElement) return;

        if (selectedElement.type === 'button_component') {
            const component = this.buttonComponents.get(selectedElement.buttonId);
            if (component && component.properties.onclick) {
                this.executeAction(component.properties.onclick);
            }
        } else if (selectedElement.properties.onclick) {
            this.executeAction(selectedElement.properties.onclick);
        }
    }

    executeAction(actionName) {
        if (this.actionHandlers[actionName]) {
            this.actionHandlers[actionName]();
        } else {
            console.warn(`No handler found for action: ${actionName}`);
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

    // Enhanced drawing methods
    draw(ctx) {
        if (!this.isVisible) return;

        ctx.save();

        // Draw background tiles
        this.drawBackground(ctx);

        // Draw button components
        this.drawButtonComponents(ctx);

        // Draw regular objects
        this.drawRegularObjects(ctx);

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

    drawButtonComponents(ctx) {
        for (const [buttonId, component] of this.buttonComponents) {
            this.drawButtonComponent(ctx, component);
        }
    }

    drawButtonComponent(ctx, component) {
        // Only draw objects for the current state
        const stateObjects = component.states[component.currentState];

        if (stateObjects && stateObjects.length > 0) {
            stateObjects.forEach(obj => {
                this.drawStateObject(ctx, obj);
            });
        } else {
            // Fallback to normal state if current state has no objects
            component.states.normal.forEach(obj => {
                if (obj.visible) {
                    this.drawStateObject(ctx, obj);
                }
            });
        }
    }

    drawStateObject(ctx, obj) {
        if (!obj.gid) return;

        const rawTileId = obj.gid & 0x1FFFFFFF;
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

        if (!image.complete || image.naturalWidth === 0) return;

        ctx.save();

        // Handle rotation if needed
        if (obj.rotation && obj.rotation !== 0) {
            const centerX = obj.position.x + obj.size.width / 2;
            const centerY = obj.position.y + obj.size.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-centerX, -centerY);
        }

        ctx.drawImage(
            image,
            sx, sy, TILE_SIZE, TILE_SIZE,
            obj.position.x, obj.position.y, obj.size.width, obj.size.height
        );

        ctx.restore();
    }

    drawRegularObjects(ctx) {
        if (!this.menuData) return;

        this.menuData.layers.forEach(layer => {
            if (layer.type !== "objectgroup" || !layer.objects) return;

            // Skip button component layers
            const layerProperties = this.convertPropertiesToObject(layer.properties);
            if (layerProperties.type === 'button' || layer.class === 'Button') return;

            layer.objects.forEach(obj => {
                this.drawObject(ctx, obj);
            });
        });
    }

    drawObject(ctx, obj) {
        if (obj.gid) {
            this.drawObjectTile(ctx, obj);
        }

        if (obj.text) {
            this.drawTextObject(ctx, obj);
        }
    }

    drawObjectTile(ctx, obj) {
        const rawTileId = obj.gid & 0x1FFFFFFF;
        if (rawTileId === 0) return;

        const tilesetEntry = [...this.tilesetImages.entries()]
            .reverse()
            .find(([firstgid]) => rawTileId >= firstgid);

        if (!tilesetEntry) return;

        const [firstgid, { image, tileset }] = tilesetEntry;
        const localId = rawTileId - firstgid;
        const columns = tileset.columns;

        const sx = (localId % columns) * TILE_SIZE;
        const sy = Math.floor(localId / columns) * TILE_SIZE;
        const adjustedY = obj.y - obj.height;

        if (!image.complete || image.naturalWidth === 0) return;

        ctx.drawImage(
            image,
            sx, sy, TILE_SIZE, TILE_SIZE,
            obj.x, adjustedY, obj.width, obj.height
        );
    }

    drawTextObject(ctx, obj) {
        ctx.save();

        ctx.font = obj.text.fontsize ?
            `${obj.text.fontsize}px ${obj.text.fontfamily || 'Arial'}` :
            '16px Arial';
        ctx.fillStyle = obj.text.color || '#000000';
        ctx.textAlign = obj.text.halign || 'left';
        ctx.textBaseline = 'top';

        const text = obj.text.text || '';
        const maxWidth = obj.width;

        if (obj.text.wrap && maxWidth > 0) {
            this.drawWrappedText(ctx, text, obj.x, obj.y, maxWidth);
        } else {
            ctx.fillText(text, obj.x, obj.y);
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