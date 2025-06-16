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
            'setId': () => this.setID(),
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
            bounds: null
        };

        // Separate objects by type for proper handling
        const buttonObjects = []; // Objects that define the interactive area
        const tileObjects = [];   // Visual tile objects with states
        const textObjects = [];   // Text objects (no state, always visible)

        layer.objects.forEach(obj => {
            if (obj.type === "button") {
                buttonObjects.push(obj);
            } else if (obj.gid && this.getButtonStateFromType(obj.type)) {
                tileObjects.push(obj);
            } else if (obj.text || obj.type === "") {
                textObjects.push(obj);
            }
        });

        // Calculate bounds from button objects, or fallback to layer properties if no button objects
        if (buttonObjects.length > 0) {
            // Calculate bounds ONLY from button objects (not tiles)
            buttonObjects.forEach(obj => {
                if (!buttonComponent.bounds) {
                    buttonComponent.bounds = {
                        x: obj.x,
                        y: obj.y,
                        width: obj.width,
                        height: obj.height
                    };
                } else {
                    // Expand bounds to include this button object
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
            });
        } else if (tileObjects.length > 0) {
            // Fallback: use the first tile object for bounds if no button objects exist
            const firstTile = tileObjects[0];
            buttonComponent.bounds = {
                x: firstTile.x,
                y: firstTile.y,
                width: firstTile.width,
                height: firstTile.height
            };
            console.warn(`Button component ${buttonId} has no button objects, using tile bounds as fallback`);
        } else if (textObjects.length > 0) {
            // Last resort: use text objects for bounds
            const firstText = textObjects[0];
            buttonComponent.bounds = {
                x: firstText.x,
                y: firstText.y,
                width: firstText.width,
                height: firstText.height
            };
            console.warn(`Button component ${buttonId} has no button or tile objects, using text bounds as fallback`);
        } else {
            console.error(`Button component ${buttonId} has no objects to calculate bounds from`);
            // Set a default bounds to prevent null errors
            buttonComponent.bounds = { x: 0, y: 0, width: 16, height: 16 };
        }

        // Add tile objects to their respective states
        tileObjects.forEach(obj => {
            const buttonState = this.getButtonStateFromType(obj.type);
            if (buttonState) {
                const stateObject = {
                    id: obj.id,
                    name: obj.name,
                    gid: obj.gid,
                    position: { x: obj.x, y: obj.y },
                    size: { width: obj.width, height: obj.height },
                    visible: obj.visible,
                    properties: this.convertPropertiesToObject(obj.properties),
                    type: obj.type,
                    rotation: obj.rotation || 0
                };

                buttonComponent.states[buttonState].push(stateObject);
            }
        });

        // Add text objects to ALL states (so they follow the button states)
        textObjects.forEach(obj => {
            const textObject = {
                id: obj.id,
                name: obj.name,
                position: { x: obj.x, y: obj.y },
                size: { width: obj.width, height: obj.height },
                visible: obj.visible,
                properties: this.convertPropertiesToObject(obj.properties),
                type: obj.type,
                rotation: obj.rotation || 0,
                text: obj.text
            };

            // Add text to all states so it follows the button
            buttonComponent.states.normal.push(textObject);
            buttonComponent.states.hover.push(textObject);
            buttonComponent.states.pressed.push(textObject);
        });

        // Add to button components
        this.buttonComponents.set(buttonId, buttonComponent);

        // Add to interactive tiles for navigation (use button bounds, not tile bounds)
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

        // Check button components for hover states - with bounds safety check
        for (const [buttonId, component] of this.buttonComponents) {
            if (component.bounds && this.isPointInBounds(mouseX, mouseY, component.bounds)) {
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
                    console.log(component);
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
        // this.canvas.style.cursor = 'default';
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
            // Get the currently selected element before changing
            const previousElement = this.interactiveTiles[this.selectedTileIndex];

            // Update the selected index
            this.selectedTileIndex = candidates[0].index;

            // Get the newly selected element
            const newElement = this.interactiveTiles[this.selectedTileIndex];

            // Update button states similar to mouse hover logic
            this.updateKeyboardButtonStates(previousElement, newElement);
        }
    }

    // Add this new method to handle keyboard button state updates:
    updateKeyboardButtonStates(previousElement, newElement) {
        let previousButtonId = null;
        let newButtonId = null;

        // Get button IDs if elements are button components
        if (previousElement && previousElement.type === 'button_component') {
            previousButtonId = previousElement.buttonId;
        }

        if (newElement && newElement.type === 'button_component') {
            newButtonId = newElement.buttonId;
        }

        // Update button states only if we're dealing with different buttons
        if (previousButtonId !== newButtonId) {
            // Clear previous button hover state
            if (previousButtonId && this.hoveredButtonId === previousButtonId) {
                this.setButtonState(previousButtonId, 'normal');
                this.hoveredButtonId = null;
            }

            // Set new button hover state
            if (newButtonId) {
                this.hoveredButtonId = newButtonId;
                this.setButtonState(newButtonId, 'hover');
                // this.canvas.style.cursor = 'pointer';
            } else {
                // this.canvas.style.cursor = 'default';
            }
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
                // Set pressed state temporarily
                this.pressedButtonId = selectedElement.buttonId;
                this.setButtonState(selectedElement.buttonId, 'pressed');

                // Execute action
                this.executeAction(component.properties.onclick);

                // Reset to hover state after a brief delay (similar to mouse click)
                setTimeout(() => {
                    if (this.pressedButtonId === selectedElement.buttonId) {
                        this.setButtonState(selectedElement.buttonId, 'hover');
                        this.pressedButtonId = null;
                    }
                }, 100);
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

    setID() {
        console.log("Setting ID...");
        events.emit("SET_ID");
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
        // Draw tile if it has gid
        if (obj.gid) {
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

            // IMPORTANT: Adjust Y for tile objects (bottom-left origin)
            const adjustedY = obj.position.y - obj.size.height;

            ctx.drawImage(
                image,
                sx, sy, TILE_SIZE, TILE_SIZE,
                obj.position.x, adjustedY, obj.size.width, obj.size.height
            );

            ctx.restore();
        }

        // Draw text if it has text property
        if (obj.text) {
            this.drawButtonTextObject(ctx, obj);
        }
    }

    drawButtonTextObject(ctx, obj) {
        ctx.save();
        // console.log("Drawing text object:", obj);

        // Set up font
        const fontSize = obj.text.pixelsize || obj.text.fontsize || 10;
        const fontFamily = this.getFontFamily(obj.text.fontfamily) || 'Arial';

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = obj.text.color || '#000000';
        ctx.textAlign = obj.text.halign || 'left';

        // Handle vertical alignment properly
        // Text objects use top-left origin, so no adjustment needed for Y position
        let textY = obj.position.y;

        if (obj.text.valign === 'center') {
            ctx.textBaseline = 'middle';
            textY = obj.position.y + (obj.size.height / 2);
            //hardcoded fix
            // textY = obj.position.y + (obj.size.height / 2) + 2;
        } else if (obj.text.valign === 'bottom') {
            ctx.textBaseline = 'bottom';
            textY = obj.position.y + obj.size.height;
        } else {
            ctx.textBaseline = 'top';
            // textY already set correctly
        }

        const text = obj.text.text || '';
        const maxWidth = obj.size.width;

        if (obj.text.wrap && maxWidth > 0) {
            this.drawWrappedTextButton(ctx, text, obj.position.x, textY, maxWidth);
        } else {
            ctx.fillText(text, obj.position.x, textY);
        }

        ctx.restore();
    }
    

    drawWrappedTextButton(ctx, text, x, y, maxWidth) {
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

    getFontFamily(fontName) {
        const fontMap = {
            'pixelFont-7-8x14-sproutLands': 'fontRetroGaming',
            // Add other font mappings as needed
        };

        return fontMap[fontName] || fontName || 'Arial';
    }

    isPointInBounds(x, y, bounds) {
        if (!bounds) {
            console.warn('isPointInBounds called with null bounds');
            return false;
        }
        return x >= bounds.x && x < bounds.x + bounds.width &&
            y >= bounds.y && y < bounds.y + bounds.height;
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
        // ctx.textBaseline = obj.text.valign || 'top';

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