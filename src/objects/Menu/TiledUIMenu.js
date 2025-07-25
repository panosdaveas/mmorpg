// TiledUIMenu.js - Enhanced with class-based button system
import { GameObject } from "../../GameObject.js";
import { Vector2 } from "../../Vector2.js";
import { TiledPropertyHandler } from "../../helpers/propertyHandler.js";
import { events } from "../../Events.js";
import { TILE_SIZE } from "../../constants/worldConstants.js";
import { resources } from "../../Resource.js";

export class TiledUIMenu extends GameObject {
    constructor({ canvas, menuData, active = true, scale = 1, zIndex = 1, position, autoHandleEscape }) { // <- Accept menuData as parameter
        super({
            position: position ?? new Vector2(0, 0)
        });

        this.scale = scale;
        this.canvas = canvas ?? document.querySelector("#game-canvas");
        this.zIndex = zIndex;
        this.menuData = menuData; // ← Use passed menuData
        this.propertyHandler = null;
        this.tilesetImages = new Map();
        this.animatedTiles = null;
        this.interactiveTiles = [];
        this.buttonComponents = new Map();
        this.selectedTileIndex = 0;
        this.isVisible = false;
        this.drawLayer = "UI";
        this.hoveredButtonId = null;
        this.pressedButtonId = null;
        this.active = active; // ← Store active state
        this.autoHandleEscape = autoHandleEscape;

        // Make action handlers configurable (will be set by TabManager)
        this.actionHandlers = {
            // Default handlers that every menu should have
            'closeMenu': () => this.hide(),
            // 'setId': () => this.setID(),
            'setText': () => this.setText(),
            'toggleMultiplayer': (data) => this.toggleMultiplayer(data),
            // 'openProfile': () => this.actionHandlers()
        };

        this.childMenus = []; // Array to maintain order (most recent = last)
        this.activeChildIndex = -1; // -1 means parent is active, 0+ means child at index is active
        this.parentMenu = null; // Reference to parent if this is a child

        this.init();

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    setActive(active) {
        this.active = active;
        console.log(`TiledUIMenu: Set active to ${active}`);
        // events.emit('MENU_OPEN');

        // Re-setup event listeners based on new active state
        this.setupEventListeners();
    }

    setActionHandlers(handlers) {
        // Merge new handlers with existing ones
        this.actionHandlers = { ...this.actionHandlers, ...handlers };
        console.log(`TiledUIMenu: Set ${Object.keys(handlers).length} action handlers`);
    }

    addChildMenu(childMenu, offsetX = 100, offsetY = 0) {
        // Set up parent-child relationship
        childMenu.parentMenu = this;
        childMenu.position.x = this.position.x + offsetX;
        childMenu.position.y = this.position.y + offsetY;

        // Keep child within screen bounds
        // this.constrainChildToScreen(childMenu);

        // Add to children array and make it active
        this.childMenus.push(childMenu);
        this.activeChildIndex = this.childMenus.length - 1;

        // Deactivate parent, activate child
        this.setActive(false);
        childMenu.setActive(true);
        childMenu.show();

        console.log(`TiledUIMenu: Added child menu, now active child index: ${this.activeChildIndex}`);
        return childMenu;
    }

    removeLastChildMenu() {
        if (this.childMenus.length === 0) return null;

        const removedChild = this.childMenus.pop();
        removedChild.hide();
        removedChild.parentMenu = null;

        // Update active child index
        this.activeChildIndex = this.childMenus.length - 1;

        // Activate the new "most recent" menu (either previous child or parent)
        if (this.activeChildIndex >= 0) {
            // There's still a child menu active
            this.childMenus[this.activeChildIndex].setActive(true);
        } else {
            // No more children, activate parent
            this.setActive(true);
        }

        console.log(`TiledUIMenu: Removed child menu, now active child index: ${this.activeChildIndex}`);
        return removedChild;
    }

    removeAllChildMenus() {
        while (this.childMenus.length > 0) {
            this.removeLastChildMenu();
        }
    }


    

    async init() {
        // Validate menuData
        if (!this.menuData) {
            console.error("TiledUIMenu: No menuData provided!");
            return;
        }

        try {
            // Initialize property handler
            this.propertyHandler = new TiledPropertyHandler(this.menuData);

            this.animatedTiles = this.propertyHandler.parseAnimatedTiles(this.menuData.tilesets);

            // Load tileset images
            this.tilesetImages = await this.propertyHandler.loadTilesetImages(
                this.menuData.tilesets,
                "../assets/maps/"
            );

            // Parse class-based interactive components
            this.parseClassBasedComponents();

            // Setup event listeners
            this.setupEventListeners();
            this.preselectFirstItem();

            console.log("TiledUIMenu: Initialization complete");

        } catch (error) {
            console.error("TiledUIMenu: Initialization failed:", error);
        }
    }

    destroy() {
        this.removeEventListeners();
        super.destroy();
    }

    // 7. ADD METHOD TO CHECK IF MENU IS READY (needed by TabManager)
    isReady() {
        return this.tilesetImages && this.tilesetImages.size > 0 && this.propertyHandler;
    }

    getMenuInfo() {
        return {
            isReady: this.isReady(),
            isVisible: this.isVisible,
            interactiveTilesCount: this.interactiveTiles.length,
            buttonComponentsCount: this.buttonComponents.size,
            tilesetsLoaded: this.tilesetImages.size
        };
    }

    ready() {

    }

    step(delta, root) {
        this.updateAnimatedTiles(delta);

        // Handle Escape key for hierarchical closing (only if auto-handling is enabled)
        if (this.autoHandleEscape && root.input?.getActionJustPressed("Escape")) {
            if (this.childMenus.length > 0) {
                // Close the most recent child menu
                this.removeLastChildMenu();
                return; // Don't process other input
            } else if (this.parentMenu) {
                // This menu is a child, close it
                this.parentMenu.removeLastChildMenu();
                return;
            } else {
                // This is a root menu, close it
                this.hide();
                return;
            }
        }

        // Only process other input if this menu is active
        if (!this.active) return;

        // Handle Enter key to show menu (existing logic)
        if (!this.isVisible && root.input?.getActionJustPressed("Enter")) {
            this.show();
        }

    // Additional step logic would go here (button navigation, etc.)
    // ... existing TiledUIMenu step logic ...
    }

    // Add animation update method
    updateAnimatedTiles(delta) {
        if (!this.animatedTiles) return;

        for (const [tileId, anim] of this.animatedTiles.entries()) {
            anim.elapsedTime += delta;
            let currentFrame = anim.frames[anim.currentFrameIndex];

            while (anim.elapsedTime > currentFrame.duration) {
                anim.elapsedTime -= currentFrame.duration;
                anim.currentFrameIndex = (anim.currentFrameIndex + 1) % anim.frames.length;
                currentFrame = anim.frames[anim.currentFrameIndex];
            }
        }
    }

    // Add method to get current animated tile ID
    getAnimatedTileId(originalTileId) {
        const anim = this.animatedTiles?.get(originalTileId);
        return anim ? anim.frames[anim.currentFrameIndex].tileid : originalTileId;
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

        // Check if button is enabled (default to true if not specified)
        const isEnabled = layerProperties.enabled !== false;

        // Check if this is a switch button
        const isSwitch = layerProperties.isSwitch === true;

        // Create button component
        const buttonComponent = {
            id: buttonId,
            layerName: layer.name,
            properties: layerProperties,
            enabled: isEnabled,
            isSwitch: isSwitch,           // NEW: Track if this is a switch
            toggleState: false,           // NEW: Track switch on/off state (false = off, true = on)
            states: {
                normal: [],
                hover: [],
                pressed: []
            },
            // If disabled, start in hover state; if enabled, start in normal state
            // For switches, start in normal state regardless (off position)
            currentState: isEnabled ? 'normal' : 'hover',
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
        if (buttonComponent.bounds && layerProperties.navigable && isEnabled) {
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

        // Remove existing listeners first
        this.removeEventListeners();

        // Mouse events are always active (for visual feedback)
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

        // Keyboard events only if active
        if (this.active) {
            document.addEventListener('keydown', this.handleKeyDown);
            console.log("TiledUIMenu: Keyboard events enabled");
        } else {
            console.log("TiledUIMenu: Keyboard events disabled");
        }
    }

    removeEventListeners() {
        if (!this.canvas) return;

        // Remove mouse listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

        // Remove keyboard listeners
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleMouseMove(e) {
        if (!this.isVisible) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = ((e.clientX - rect.left) * scaleX - this.position.x) / this.scale;
        const mouseY = ((e.clientY - rect.top) * scaleY - this.position.y) / this.scale;

        let hoveredButton = null;
        let hoveredElementIndex = -1;

        // Check button components for hover states - with bounds safety check
        for (const [buttonId, component] of this.buttonComponents) {
            if (component.bounds && this.isPointInBounds(mouseX, mouseY, component.bounds)) {
                // Only allow hover interaction if button is enabled
                if (component.enabled) {
                    hoveredButton = buttonId;
                }
                break;
            }
        }

        // Find hovered interactive element for selection rectangle (only enabled buttons)
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

        // Update button hover state (only for enabled buttons)
        if (hoveredButton !== this.hoveredButtonId) {
            // Clear previous hover
            if (this.hoveredButtonId) {
                const prevComponent = this.buttonComponents.get(this.hoveredButtonId);
                if (prevComponent && prevComponent.enabled) {
                    // For switches that are ON, keep them in pressed state
                    if (prevComponent.isSwitch && prevComponent.toggleState) {
                        this.setButtonState(this.hoveredButtonId, 'pressed');
                    } else {
                        this.setButtonState(this.hoveredButtonId, 'normal');
                    }
                }
            }

            // Set new hover (only for enabled buttons)
            this.hoveredButtonId = hoveredButton;
            if (hoveredButton) {
                const component = this.buttonComponents.get(hoveredButton);
                if (component && component.enabled) {
                    // For switches that are ON, keep them in pressed state (don't show hover)
                    if (component.isSwitch && component.toggleState) {
                        this.setButtonState(hoveredButton, 'pressed');
                    } else {
                        this.setButtonState(hoveredButton, 'hover');
                    }
                }
            }
        }
    }

    handleMouseDown(e) {
        if (!this.isVisible || !this.hoveredButtonId) return;

        // Only allow press if button is enabled
        const component = this.buttonComponents.get(this.hoveredButtonId);
        if (component && component.enabled) {
            this.pressedButtonId = this.hoveredButtonId;
            this.setButtonState(this.pressedButtonId, 'pressed');
        }
    }

    handleMouseUp(e) {
        if (!this.isVisible) return;

        if (this.pressedButtonId) {
            const component = this.buttonComponents.get(this.pressedButtonId);
            if (component && component.enabled && this.hoveredButtonId === this.pressedButtonId) {

                // Handle switch toggle logic
                if (component.isSwitch) {
                    // Toggle the switch state
                    component.toggleState = !component.toggleState;

                    // Set visual state based on toggle state
                    if (component.toggleState) {
                        // Switch is ON - stay in pressed state
                        this.setButtonState(this.pressedButtonId, 'pressed');
                    } else {
                        // Switch is OFF - return to normal state  
                        this.setButtonState(this.pressedButtonId, 'normal');
                    }

                    // Execute action with toggle state info
                    if (component.properties.onclick) {
                        this.executeAction(component.properties.onclick, {
                            isSwitch: true,
                            toggleState: component.toggleState,
                            buttonId: this.pressedButtonId
                        });
                    }
                } else {
                    // Regular button behavior
                    if (component.properties.onclick) {
                        this.executeAction(component.properties.onclick);
                    }

                    // Reset to hover state if still hovering, normal otherwise
                    this.setButtonState(this.pressedButtonId,
                        this.hoveredButtonId === this.pressedButtonId ? 'hover' : 'normal');
                }
            }

            // Only clear pressedButtonId for regular buttons, not switches in ON state
            if (!component || !component.isSwitch || !component.toggleState) {
                this.pressedButtonId = null;
            }
        }
    }


    handleMouseLeave() {
        if (this.hoveredButtonId) {
            const component = this.buttonComponents.get(this.hoveredButtonId);

            // For switches that are ON, keep them in pressed state even when mouse leaves
            if (component && component.isSwitch && component.toggleState) {
                this.setButtonState(this.hoveredButtonId, 'pressed');
            } else {
                // Regular buttons or switches that are OFF go to normal state
                this.setButtonState(this.hoveredButtonId, 'normal');
            }

            this.hoveredButtonId = null;
        }

        if (this.pressedButtonId) {
            const component = this.buttonComponents.get(this.pressedButtonId);

            // Only reset pressed buttons that are NOT switches in ON state
            if (!component || !component.isSwitch || !component.toggleState) {
                this.setButtonState(this.pressedButtonId, 'normal');
                this.pressedButtonId = null;
            }
            // Switches that are ON keep their pressed state and pressedButtonId
        }
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

        // Clear previous button hover state
        if (previousButtonId && this.hoveredButtonId === previousButtonId) {
            const prevComponent = this.buttonComponents.get(previousButtonId);
            if (prevComponent && prevComponent.enabled) {
                // For switches that are ON, keep them in pressed state
                if (prevComponent.isSwitch && prevComponent.toggleState) {
                    this.setButtonState(previousButtonId, 'pressed');
                } else {
                    this.setButtonState(previousButtonId, 'normal');
                }
            }
            this.hoveredButtonId = null;
        }

        // Set new button hover state
        if (newButtonId) {
            const newComponent = this.buttonComponents.get(newButtonId);
            if (newComponent && newComponent.enabled) {
                this.hoveredButtonId = newButtonId;
                // For switches that are ON, keep them in pressed state (don't show hover)
                if (newComponent.isSwitch && newComponent.toggleState) {
                    this.setButtonState(newButtonId, 'pressed');
                } else {
                    this.setButtonState(newButtonId, 'hover');
                }
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
        const threshold = 2;

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

    a// REPLACE these methods in your TiledUIMenu.js file:

    // 1. REPLACE the updateKeyboardButtonStates method
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

        // Clear previous button hover state
        if (previousButtonId && this.hoveredButtonId === previousButtonId) {
            const prevComponent = this.buttonComponents.get(previousButtonId);
            if (prevComponent && prevComponent.enabled) {
                // For switches that are ON, keep them in pressed state
                if (prevComponent.isSwitch && prevComponent.toggleState) {
                    this.setButtonState(previousButtonId, 'pressed');
                } else {
                    this.setButtonState(previousButtonId, 'normal');
                }
            }
            this.hoveredButtonId = null;
        }

        // Set new button hover state
        if (newButtonId) {
            const newComponent = this.buttonComponents.get(newButtonId);
            if (newComponent && newComponent.enabled) {
                this.hoveredButtonId = newButtonId;
                // For switches that are ON, keep them in pressed state (don't show hover)
                if (newComponent.isSwitch && newComponent.toggleState) {
                    this.setButtonState(newButtonId, 'pressed');
                } else {
                    this.setButtonState(newButtonId, 'hover');
                }
            }
        }
    }

    // 2. REPLACE the activateSelectedTile method
    activateSelectedTile() {
        const selectedElement = this.interactiveTiles[this.selectedTileIndex];
        if (!selectedElement) return;

        if (selectedElement.type === 'button_component') {
            const component = this.buttonComponents.get(selectedElement.buttonId);
            // Only activate if component exists, is enabled, and has onclick action
            if (component && component.enabled && component.properties.onclick) {

                if (component.isSwitch) {
                    // Handle switch toggle for keyboard activation
                    component.toggleState = !component.toggleState;

                    // Set visual state based on toggle state
                    if (component.toggleState) {
                        // Switch is ON - set to pressed state
                        this.setButtonState(selectedElement.buttonId, 'pressed');
                    } else {
                        // Switch is OFF - set to hover state (since it's selected)
                        this.setButtonState(selectedElement.buttonId, 'hover');
                    }

                    // Execute action with toggle state info
                    this.executeAction(component.properties.onclick, {
                        isSwitch: true,
                        toggleState: component.toggleState,
                        buttonId: selectedElement.buttonId
                    });

                    // For switches, don't do the temporary press animation

                } else {
                    // Regular button behavior with temporary press animation
                    this.pressedButtonId = selectedElement.buttonId;
                    this.setButtonState(selectedElement.buttonId, 'pressed');

                    // Execute action
                    this.executeAction(component.properties.onclick);

                    // Reset to hover state after a brief delay
                    setTimeout(() => {
                        if (this.pressedButtonId === selectedElement.buttonId) {
                            this.setButtonState(selectedElement.buttonId, 'hover');
                            this.pressedButtonId = null;
                        }
                    }, 100);
                }
            }
        } else if (selectedElement.properties.onclick) {
            this.executeAction(selectedElement.properties.onclick);
        }
    }

    executeAction(actionName, additionalData = null) {
        if (this.actionHandlers[actionName]) {
            try {
                // Pass additional data (like switch state) to action handlers
                this.actionHandlers[actionName](additionalData);
            } catch (error) {
                console.error(`Error executing action '${actionName}':`, error);
            }
        } else {
            console.warn(`No handler found for action: ${actionName}`);
            // Emit event as fallback with additional data
            events.emit("UI_ACTION", {
                action: actionName,
                source: 'TiledUIMenu',
                ...additionalData
            });
        }
    }

    setButtonEnabled(buttonId, enabled) {
        const component = this.buttonComponents.get(buttonId);
        if (!component) {
            console.warn(`Button component ${buttonId} not found`);
            return false;
        }

        const wasEnabled = component.enabled;
        component.enabled = enabled;

        if (enabled && !wasEnabled) {
            // Button was disabled, now enabled - add back to interactive tiles if navigable
            if (component.bounds && component.properties.navigable) {
                const existingIndex = this.interactiveTiles.findIndex(tile =>
                    tile.type === 'button_component' && tile.buttonId === buttonId
                );

                if (existingIndex === -1) {
                    this.interactiveTiles.push({
                        type: 'button_component',
                        buttonId: buttonId,
                        properties: component.properties,
                        position: { x: component.bounds.x, y: component.bounds.y },
                        size: { width: component.bounds.width, height: component.bounds.height },
                        index: this.interactiveTiles.length,
                        layer: component.layerName
                    });

                    // Re-sort interactive tiles
                    this.interactiveTiles.sort((a, b) => {
                        if (a.position.y !== b.position.y) {
                            return a.position.y - b.position.y;
                        }
                        return a.position.x - b.position.x;
                    });

                    // Update indices
                    this.interactiveTiles.forEach((tile, index) => {
                        tile.index = index;
                    });
                }
            }
        } else if (!enabled && wasEnabled) {
            // Button was enabled, now disabled - remove from navigation
            const index = this.interactiveTiles.findIndex(tile =>
                tile.type === 'button_component' && tile.buttonId === buttonId
            );

            if (index !== -1) {
                this.interactiveTiles.splice(index, 1);

                // Update indices for remaining tiles
                this.interactiveTiles.forEach((tile, idx) => {
                    tile.index = idx;
                });

                // Adjust selected index if necessary
                if (this.selectedTileIndex >= index) {
                    this.selectedTileIndex = Math.max(0, this.selectedTileIndex - 1);
                    if (this.selectedTileIndex >= this.interactiveTiles.length) {
                        this.selectedTileIndex = Math.max(0, this.interactiveTiles.length - 1);
                    }
                }
            }

            // Clear any hover/press states for this disabled button
            if (this.hoveredButtonId === buttonId) {
                this.hoveredButtonId = null;
            }
            if (this.pressedButtonId === buttonId) {
                this.pressedButtonId = null;
            }
        }

        console.log(`Button ${buttonId} enabled state changed to: ${enabled}`);
        return true;
    }
    

    // Action handler methods
    // openProfile() {
    //     console.log("Opening profile...");
    //     events.emit("OPEN_PROFILE");
    // }

    // openPlayers() {
    //     console.log("Opening players list...");
    //     events.emit("OPEN_PLAYERS");
    // }

    // openSettings() {
    //     console.log("Opening settings...");
    //     events.emit("OPEN_SETTINGS");
    // }

    updateButtonText(buttonId, newText) {
        const component = this.buttonComponents.get(buttonId);
        if (!component) {
            console.warn(`Button component ${buttonId} not found`);
            return false;
        }

        let textUpdated = false;

        // Update text in all states (normal, hover, pressed)
        Object.keys(component.states).forEach(stateName => {
            component.states[stateName].forEach(obj => {
                if (obj.text) {
                    obj.text.text = newText;
                    textUpdated = true;
                }
            });
        });

        if (textUpdated) {
            console.log(`Updated text in button ${buttonId} to: "${newText}"`);
            return true;
        } else {
            console.warn(`No text objects found in button component ${buttonId}`);
            return false;
        }
    }

    updateAllButtonsWithPattern(pattern, newText) {
        let updatedCount = 0;

        for (const [buttonId, component] of this.buttonComponents) {
            for (const obj of component.states.normal) {
                if (obj.text && obj.text.text.includes(pattern)) {
                    this.updateButtonText(buttonId, newText);
                    updatedCount++;
                    break; // Only update once per button component
                }
            }
        }

        console.log(`Updated ${updatedCount} buttons containing "${pattern}"`);
        return updatedCount;
    }

    findButtonByText(searchText) {
        for (const [buttonId, component] of this.buttonComponents) {
            for (const obj of component.states.normal) {
                // if (obj.text && obj.text.text === searchText) {
                if (obj.name === searchText) {
                    return buttonId;
                }
            }
        }
        return null;
    }

    findObjectByName(searchText) {
        for (const [buttonId, component] of this.buttonComponents) {
            // console.log(component.properties?.onclick);
            if (component.layerName === searchText || component.properties?.onclick === searchText) {
                return buttonId;
            }
        }
        return null;
    }

    setID(newId) {
        // Test value for now...pass the socket Id in the future
        const dynamicValue = newId;

        const buttonId = this.findButtonByText("PlayerID");
        if (buttonId) {
            this.updateButtonText(buttonId, dynamicValue);
        }
    }

    setText(target, value) {
        const dynamicValue = value;

        const objectId = this.findButtonByText(target);
        if (objectId) {
            this.updateButtonText(objectId, dynamicValue);
        }
    }

    toggleMultiplayer(data) {
        // data = buttonId, isSwitch, toggleState
        console.log("Toggle Multiplayer Switch");
        const isSwitchOn = data?.toggleState;
        if (isSwitchOn) {
            console.log("Stopping Multiplayer")
            // start multiplayer
            events.emit('TOGGLE_MULTIPLAYER_OFF');
            return;
        }
        console.log("Starting Multiplayer")
        // stop multiplayer
        events.emit('TOGGLE_MULTIPLAYER_ON');
        return;
    }

    setSwitchState(buttonId, state) {
        const component = this.buttonComponents.get(buttonId);
        if (!component) {
            console.warn(`Button component ${buttonId} not found`);
            return false;
        }

        if (!component.isSwitch) {
            console.warn(`Button ${buttonId} is not a switch`);
            return false;
        }

        component.toggleState = state;

        // Update visual state
        if (state) {
            this.setButtonState(buttonId, 'pressed');
        } else {
            this.setButtonState(buttonId, 'normal');
        }

        console.log(`Switch ${buttonId} set to ${state ? 'ON' : 'OFF'}`);
        return true;
    }

    /**
     * Get a switch button's current toggle state
     * @param {string} buttonId - The button component ID
     * @returns {boolean|null} - true if ON, false if OFF, null if not found or not a switch
     */
    getSwitchState(buttonId) {
        const component = this.buttonComponents.get(buttonId);
        if (!component) {
            console.warn(`Button component ${buttonId} not found`);
            return null;
        }

        if (!component.isSwitch) {
            console.warn(`Button ${buttonId} is not a switch`);
            return null;
        }

        return component.toggleState;
    }

    /**
     * Toggle a switch button's state programmatically
     * @param {string} buttonId - The button component ID
     * @returns {boolean|null} - new state if successful, null if failed
     */
    toggleSwitch(buttonId) {
        const component = this.buttonComponents.get(buttonId);
        if (!component) {
            console.warn(`Button component ${buttonId} not found`);
            return null;
        }

        if (!component.isSwitch) {
            console.warn(`Button ${buttonId} is not a switch`);
            return null;
        }

        const newState = !component.toggleState;
        this.setSwitchState(buttonId, newState);
        return newState;
    }

    /**
     * Get all switch buttons and their states
     * @returns {Object} - Object with buttonId as key and state as value
     */
    getAllSwitchStates() {
        const switchStates = {};

        for (const [buttonId, component] of this.buttonComponents) {
            if (component.isSwitch) {
                switchStates[buttonId] = component.toggleState;
            }
        }

        return switchStates;
    }

    /**
     * Reset all switches to OFF state
     */
    resetAllSwitches() {
        for (const [buttonId, component] of this.buttonComponents) {
            if (component.isSwitch) {
                this.setSwitchState(buttonId, false);
            }
        }
        console.log('All switches reset to OFF state');
    }


    show() {
        this.isVisible = true;
        this.selectedTileIndex = 0;
        this.preselectFirstItem();
        // events.emit("MENU_OPEN");
    }

    hide() {
        this.isVisible = false;
        this.removeAllChildMenus(); // Hide all children when parent hides
        // events.emit("MENU_CLOSE");
    }

    // ADD: Method to get the currently active menu (for external reference)
    getActiveMenu() {
        if (this.activeChildIndex >= 0 && this.childMenus[this.activeChildIndex]) {
            // Recursively get the active menu from the active child
            return this.childMenus[this.activeChildIndex].getActiveMenu();
        }
        return this; // This menu is active
    }

    // ADD: Method to check if this menu has active children
    hasActiveChildren() {
        return this.activeChildIndex >= 0;
    }

    preselectFirstItem() {
        if (this.interactiveTiles.length === 0) {
            return;
        }

        // Clear any existing hover states
        this.hoveredButtonId = null;
        this.pressedButtonId = null;

        // Get the first interactive element
        const firstElement = this.interactiveTiles[0];

        if (firstElement && firstElement.type === 'button_component') {
            const buttonId = firstElement.buttonId;
            const component = this.buttonComponents.get(buttonId);

            if (component && component.enabled) {
                // Set this button as hovered (selected)
                this.hoveredButtonId = buttonId;

                // Apply visual state - for switches that are ON, keep pressed state
                if (component.isSwitch && component.toggleState) {
                    this.setButtonState(buttonId, 'pressed');
                } else {
                    this.setButtonState(buttonId, 'hover');
                }

                console.log(`TiledUIMenu: Preselected first item: ${buttonId}`);
            }
        }
    }

    // Enhanced drawing methods
    draw(ctx) {
        if (!this.isVisible) return;

        ctx.save();

        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;

        // Apply position and scale transforms
        ctx.translate(this.position.x, this.position.y);
        ctx.scale(this.scale, this.scale);

        // Draw this menu's content
        this.drawBackground(ctx);
        this.drawButtonComponents(ctx);
        this.drawRegularObjects(ctx);

        // Only draw selection if this menu is active (no active children)
        if (this.activeChildIndex === -1) {
            this.drawSelection(ctx);
        }

        ctx.restore();

        // Draw child menus on top
        this.childMenus.forEach(childMenu => {
            if (childMenu.isVisible) {
                childMenu.draw(ctx);
            }
        });
    }


    drawBackground(ctx) {
        if (!this.menuData || !this.tilesetImages) return;

        this.menuData.layers.forEach(layer => {
            if (layer.type !== "tilelayer") return;

            const width = layer.width;

            layer.data.forEach((tileId, index) => {
                const rawTileId = tileId & 0x1FFFFFFF;
                if (rawTileId === 0) return;

                const drawTileId = this.getAnimatedTileId(rawTileId);

                const tilesetEntry = [...this.tilesetImages.entries()]
                    .reverse()
                    .find(([firstgid]) => drawTileId >= firstgid);

                if (!tilesetEntry) return;

                const [firstgid, { image, tileset }] = tilesetEntry;
                const localId = drawTileId - firstgid;
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
        // Save the current global alpha
        const originalAlpha = ctx.globalAlpha;

        // Set opacity based on enabled state
        if (!component.enabled) {
            ctx.globalAlpha = originalAlpha * 0.5; // 40% opacity for disabled buttons
        }

        // Only draw objects for the current state
        const stateObjects = component.states[component.currentState];

        if (stateObjects && stateObjects.length > 0) {
            stateObjects.forEach(obj => {
                this.drawStateObject(ctx, obj, component);
            });
        } else {
            // Fallback to normal state if current state has no objects
            component.states.normal.forEach(obj => {
                if (obj.visible) {
                    this.drawStateObject(ctx, obj, component);
                }
            });
        }

        // Restore the original global alpha
        ctx.globalAlpha = originalAlpha;
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

    // Method 2: If you want to check by individual object ID
    isTextObjectInHoveredButton(objectId) {
        if (!this.hoveredButtonId) return false;

        const hoveredComponent = this.buttonComponents.get(this.hoveredButtonId);
        if (!hoveredComponent) return false;

        // Check if this object ID exists in any state of the hovered button component
        for (const stateName of ['normal', 'hover', 'pressed']) {
            const found = hoveredComponent.states[stateName].find(obj => obj.id === objectId);
            if (found) return true;
        }
        return false;
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

        //use ctx opacity to dim text if not hovered
        // if (!this.isTextObjectInHoveredButton(obj.id)) {
        //     ctx.globalAlpha = 0.6;
        // } else {
        //     ctx.globalAlpha = 1.0;
        // }

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

        // Set up font
        const fontSize = obj.text.pixelsize || obj.text.fontsize || 10;
        const fontFamily = this.getFontFamily(obj.text.fontfamily) || 'Arial';

        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = obj.text.color || '#000000';
        ctx.textAlign = obj.text.halign || 'left';

        let textY = obj.y;

        if (obj.text.valign === 'center') {
            ctx.textBaseline = 'middle';
            textY = obj.y + (obj.height / 2);
            //hardcoded fix
            // textY = obj.position.y + (obj.size.height / 2) + 2;
        } else if (obj.text.valign === 'bottom') {
            ctx.textBaseline = 'bottom';
            textY = obj.y + obj.height;
        } else {
            ctx.textBaseline = 'top';
        }

        const text = obj.text.text || '';
        const maxWidth = obj.width;

        if (obj.text.wrap && maxWidth > 0) {
            this.drawWrappedTextButton(ctx, text, obj.x, textY, maxWidth);
        } else {
            ctx.fillText(text, obj.x, textY);
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
        // console.log("Selected element:", selectedElement.layer);
        if (!selectedElement) return;

        const x = selectedElement.position.x;
        const y = selectedElement.position.y;
        const width = selectedElement.size.width;
        const height = selectedElement.size.height;

        // Check if selection sprites are loaded
        const hasSprites = resources.images.selectionTopLeftCorner?.isLoaded &&
            resources.images.selectionTopRightCorner?.isLoaded &&
            resources.images.selectionBottomLeftCorner?.isLoaded &&
            resources.images.selectionBottomRightCorner?.isLoaded;

        if (selectedElement.layer === "MenuItem") {
            this.drawFallbackSelection(ctx, x, y, width, height);
            return;
        }
        if (hasSprites ) {
            this.drawAnimatedSpriteSelection(ctx, x, y, width, height);
        } else {
            this.drawFallbackSelection(ctx, x, y, width, height);
        }
    }

    drawSpriteSelection(ctx, x, y, width, height) {
        ctx.save();

        // Optional: Add subtle background highlight
        ctx.fillStyle = "rgba(255, 255, 0, 0.0)";
        ctx.fillRect(x, y, width, height);

        // Get corner sprites from resources
        const topLeft = resources.images.selectionTopLeftCorner.image;
        const topRight = resources.images.selectionTopRightCorner.image;
        const bottomLeft = resources.images.selectionBottomLeftCorner.image;
        const bottomRight = resources.images.selectionBottomRightCorner.image;

        // Assume all corners are same size (adjust if needed)
        const cornerSize = topLeft.width;
        const offset = cornerSize / 2;

        // Draw corner sprites
        ctx.drawImage(topLeft, x - offset, y - offset);
        ctx.drawImage(topRight, x + width - offset, y - offset);
        ctx.drawImage(bottomLeft, x - offset, y + height - offset);
        ctx.drawImage(bottomRight, x + width - offset, y + height - offset);

        ctx.restore();
    }

    // STEP 4: Keep fallback for when sprites aren't loaded
    drawFallbackSelection(ctx, x, y, width, height) {
        ctx.save();

        // Draw selection highlight
        ctx.fillStyle = "rgba(255, 255, 0, 0.0)";
        ctx.fillRect(x, y, width, height);

        // Draw selection border
        ctx.strokeStyle = "rgba(243, 229, 194, 1)";
        // ctx.strokeStyle = "rgba(232, 207, 166, 1)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        ctx.restore();
    }

    // OPTIONAL: Animated corners version
    drawAnimatedSpriteSelection(ctx, x, y, width, height) {
        ctx.save();

        // Simple pulse animation
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 3) * 0.1 + 1; // 0.9 to 1.1

        // Background with pulse
        ctx.globalAlpha = 0.1 + Math.sin(time * 2) * 0.05;
        // ctx.fillStyle = "#FFD700";
        ctx.fillStyle = "rgba(255, 255, 0, 0.0)";
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 1;

        // Get sprites
        const topLeft = resources.images.selectionTopLeftCorner.image;
        const topRight = resources.images.selectionTopRightCorner.image;
        const bottomLeft = resources.images.selectionBottomLeftCorner.image;
        const bottomRight = resources.images.selectionBottomRightCorner.image;

        const cornerSize = topLeft.width * pulse;
        const offset = cornerSize / 2;

        // Draw animated corners
        ctx.drawImage(topLeft, x - offset, y - offset, cornerSize, cornerSize);
        ctx.drawImage(topRight, x + width - offset, y - offset, cornerSize, cornerSize);
        ctx.drawImage(bottomLeft, x - offset, y + height - offset, cornerSize, cornerSize);
        ctx.drawImage(bottomRight, x + width - offset, y + height - offset, cornerSize, cornerSize);

        ctx.restore();
    }

}