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
    }

    parseAnimatedTiles(tilesets) {
        const animatedTiles = new Map();

        tilesets.forEach(tileset => {
            if (!tileset.tiles) return;

            tileset.tiles.forEach(tile => {
                if (tile.animation) {
                    const globalTileId = tileset.firstgid + tile.id;
                    animatedTiles.set(globalTileId, {
                        frames: tile.animation.map(frame => ({
                            tileid: tileset.firstgid + frame.tileid,
                            duration: frame.duration,
                        })),
                        currentFrameIndex: 0,
                        elapsedTime: 0
                    });
                }
            });
        });

        return animatedTiles;
    }

    async loadTilesetImages(tilesets, basePath = "") {
        const images = new Map();

        const loaders = tilesets.map(tileset => {
            return new Promise((resolve, reject) => {
                const imagePath = basePath + tileset.image.replace(/\\/g, "/");
                const img = new Image();
                img.onload = () => {
                    images.set(tileset.firstgid, { image: img, tileset });
                    resolve();
                };
                img.onerror = () => {
                    console.error("Failed to load", imagePath);
                    reject();
                };
                img.src = imagePath;
            });
        });

        await Promise.all(loaders);
        return images; // Map of firstgid -> { image, tileset }
    }

    findTilesetForTile(tileId, tilesetMap) {
        let match = null;
        for (let [firstgid, entry] of tilesetMap.entries()) {
            if (tileId >= firstgid) {
                if (!match || firstgid > match.firstgid) {
                    match = { ...entry, firstgid };
                }
            }
        }
        return match;
    }

    extractTileProperties() {
        if (!this.mapData.tilesets || !this.mapData.tilesets.length) return;

        this.mapData.tilesets.forEach(tileset => {
            if (!tileset.tiles) return;

            tileset.tiles.forEach(tile => {
                if (!tile.properties) return;

                const globalTileId = tileset.firstgid + tile.id;
                const tileProperties = {};

                tile.properties.forEach(prop => {
                    tileProperties[prop.name] = prop.value;
                });

                this.tilePropertiesMap.set(globalTileId, tileProperties);
              });
        });
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

    getPropertiesForTile(tileId) {
        return this.tilePropertiesMap.get(this.clearTileFlags(tileId)) || {};
      }

    // Add a new property to track
    addTrackedProperty(propertyName) {
        if (!this.trackedProperties.includes(propertyName)) {
            this.trackedProperties.push(propertyName);
            // Re-process everything if map data is available
            if (this.mapData) {
                this.extractTileProperties();
                // this.processLayersWithZIndex();
                // this.calculateFinalTiles();
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