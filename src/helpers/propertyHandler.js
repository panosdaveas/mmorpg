import { TILE_SIZE } from "../constants/worldConstants";

export class TiledPropertyHandler {
    constructor(mapData) {
        this.mapData = mapData;
        this.tilePropertiesMap = new Map(); // Map of tileId -> properties
        this.layerTileData = new Map(); // Position -> array of tile data with layer info
        this.finalWalls = new Set(); // Final set of collision walls
        this.finalActions = []; // Final array of action tiles with their properties

        // Properties we want to track
        this.trackedProperties = ["collide", "action-1", "action-2", "interactable", "npc"];

        // Extract properties from tilesets
        this.extractTileProperties();

        // Process layers considering z-index
        this.processLayersWithZIndex();

        // Calculate final collision and action tiles
        this.calculateFinalTiles();
    }

    extractTileProperties() {
        // Check if tilesets are available
        if (!this.mapData.tilesets || !this.mapData.tilesets.length) {
            // console.warn("No tilesets found in map data");
            return;
        }

        // Go through each tileset
        this.mapData.tilesets.forEach(tileset => {
            // Skip tilesets without tile definitions
            if (!tileset.tiles) return;

            // Process each tile definition in this tileset
            tileset.tiles.forEach(tile => {
                // Skip tiles without properties
                if (!tile.properties) return;

                // Calculate the global tile ID
                const globalTileId = tileset.firstgid + tile.id;

                // Extract all relevant properties for this tile
                const tileProperties = {};
                let hasTrackedProperty = false;

                tile.properties.forEach(prop => {
                    // Check if this is a property we want to track
                    if (this.trackedProperties.includes(prop.name)) {
                        tileProperties[prop.name] = prop.value;
                        hasTrackedProperty = true;
                    }
                });

                // Only store tiles with tracked properties
                if (hasTrackedProperty) {
                    this.tilePropertiesMap.set(globalTileId, tileProperties);
                    // console.log(`Tile ID ${globalTileId} has properties:`, tileProperties);
                }
            });
        });

        // console.log(`Found ${this.tilePropertiesMap.size} tiles with tracked properties`);
    }

    processLayersWithZIndex() {
        // Process layers in their original order (bottom to top)
        this.mapData.layers.forEach((layer, layerIndex) => {
            // Skip layers that aren't tile layers or don't have data
            if (layer.type !== "tilelayer" || !Array.isArray(layer.data)) {
                return;
            }

            // console.log(`Processing layer "${layer.name}" (index: ${layerIndex})`);

            // Check if this layer has a specifically defined z-order
            const zIndex = layer.properties?.find(prop => prop.name === "zIndex")?.value || layerIndex;

            // Extract layer-level properties
            const layerProperties = {};
            let hasLayerProperties = false;

            if (layer.properties) {
                layer.properties.forEach(prop => {
                    if (this.trackedProperties.includes(prop.name)) {
                        layerProperties[prop.name] = prop.value;
                        hasLayerProperties = true;
                    }
                });
            }

            const width = layer.width;

            // Process each tile in the layer
            layer.data.forEach((tileId, index) => {
                const actualTileId = this.clearTileFlags(tileId);

                // Skip empty tiles
                if (actualTileId === 0) return;

                // Calculate x,y from the index
                const x = index % width;
                const y = Math.floor(index / width);
                const posKey = `${x * TILE_SIZE},${y * TILE_SIZE}`;

                // Get tile properties (either from the tile or from the layer)
                let tileProperties = this.tilePropertiesMap.get(actualTileId) || {};

                // Merge with layer properties (layer properties take precedence)
                if (hasLayerProperties) {
                    tileProperties = { ...tileProperties, ...layerProperties };
                }

                // Store this tile's data with position and layer info
                if (!this.layerTileData.has(posKey)) {
                    this.layerTileData.set(posKey, []);
                }

                this.layerTileData.get(posKey).push({
                    layerIndex: zIndex,
                    tileId: actualTileId,
                    properties: tileProperties,
                    x: x,
                    y: y,
                    position: posKey
                });
            });
        });
    }

    calculateFinalTiles() {
        // For each position in our tile data map
        for (const [posKey, tiles] of this.layerTileData.entries()) {
            // Sort tiles by z-index, highest (top) last
            tiles.sort((a, b) => a.layerIndex - b.layerIndex);

            // The topmost tile determines collision and action status
            const topmostTile = tiles[tiles.length - 1];

            // Check for collision
            if (topmostTile.properties.collide) {
                this.finalWalls.add(posKey);
                // console.log(`Final collision at: ${posKey}`);
            }

            // Check for action tiles
            const actionProperties = Object.entries(topmostTile.properties)
                .filter(([key, value]) => key !== "collide" && value);

            if (actionProperties.length > 0) {
                // Add to actions array with all properties
                this.finalActions.push({
                    id: posKey,
                    x: topmostTile.x,
                    y: topmostTile.y,
                    tileId: topmostTile.tileId,
                    properties: Object.fromEntries(actionProperties)
                });

                // console.log(`Action tile at: ${posKey} with properties:`,
                //     Object.fromEntries(actionProperties));
            }
        }

        // console.log(`Total collision tiles: ${this.finalWalls.size}`);
        // console.log(`Total action tiles: ${this.finalActions.length}`);
    }

    // Clear the Tiled tile flags to get the actual tile ID
    clearTileFlags(tileId) {
        // Tiled uses bits 29-31 for flipping/rotation flags
        // 0x1FFFFFFF = binary 00011111111111111111111111111111
        return tileId & 0x1FFFFFFF;
    }

    // Get all walls for collision detection
    getWallTiles() {
        return this.finalWalls;
    }

    // Get all action tiles with their properties
    getActionTiles() {
        return this.finalActions;
    }

    // Check if a given position has a collision
    hasCollision(x, y) {
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        return this.finalWalls.has(key);
    }

    // Get actions at a specific position
    getActionsAt(x, y) {
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        return this.finalActions.find(action => action.id === key);
    }

    // Add a new property to track
    addTrackedProperty(propertyName) {
        if (!this.trackedProperties.includes(propertyName)) {
            this.trackedProperties.push(propertyName);
            // Re-process everything if map data is available
            if (this.mapData) {
                this.extractTileProperties();
                this.processLayersWithZIndex();
                this.calculateFinalTiles();
            }
        }
    }
}

// Example usage:
/*
const propertyHandler = new TiledPropertyHandler(mapData);

// Get all walls for collision detection
const walls = propertyHandler.getWalls();

// Get all action tiles
const actionTiles = propertyHandler.getActionTiles();

// Check for collision
if (propertyHandler.hasCollision(playerX, playerY)) {
    // Handle collision
}

// Check for action at player position
const actionAtPlayer = propertyHandler.getActionsAt(playerX, playerY);
if (actionAtPlayer) {
    if (actionAtPlayer.properties["action-1"]) {
        // Handle action-1
    }
    if (actionAtPlayer.properties.interactable) {
        // Handle interactable object
    }
}
*/