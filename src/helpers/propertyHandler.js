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
        this.toLoad = {};      // Track image paths by a key
        this.images = {};      // Store loaded images and status
        const loaders = [];

        tilesets.forEach(tileset => {
            const cleanPath = tileset.image.replace(/\\/g, "/");
            const imagePath = basePath + cleanPath;
            const key = cleanPath; // Use relative path as unique key

            this.toLoad[key] = imagePath;

            const img = new Image();
            this.images[key] = {
                image: img,
                isLoaded: false,
                tileset,
                firstgid: tileset.firstgid
            };

            const loader = new Promise((resolve, reject) => {
                img.onload = () => {
                    this.images[key].isLoaded = true;
                    resolve();
                };
                img.onerror = () => {
                    console.error("Failed to load", imagePath);
                    reject();
                };
                img.src = imagePath;
            });

            loaders.push(loader);
        });

        await Promise.all(loaders);

        // Build map of firstgid -> { image, tileset }
        const tilesetMap = new Map();
        Object.values(this.images).forEach(entry => {
            tilesetMap.set(entry.firstgid, {
                image: entry.image,
                tileset: entry.tileset
            });
        });

        return tilesetMap;
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