import { TILE_SIZE } from "../constants/worldConstants";

export class TiledCollisionHandler {
    constructor(mapData) {
        this.mapData = mapData;
        this.collisionMap = new Map(); // Map to store collision state with layer info
        this.collisionTileIds = new Set();
        this.actionTileIds = new Set();
        this.finalWalls = new Set(); // Final set of walls after processing z-index
        this.finalActions = new Set();
        // First, identify which tile IDs have collision properties
        this.identifyCollisionTiles();
        this.identifyActionTiles();

        // Extract collision data considering layer order
        this.extractCollisionDataWithZIndex();

        // Generate the final walls set
        this.calculateFinalCollisions();
    }

    identifyCollisionTiles() {
        // Check if tilesets are available in the map data
        if (!this.mapData.tilesets || !this.mapData.tilesets.length) {
            console.warn("No tilesets found in map data");
            return;
        }

        // Go through each tileset
        this.mapData.tilesets.forEach(tileset => {
            // Check if the tileset has tile definitions with properties
            if (tileset.tiles) {
                // Go through each tile definition
                tileset.tiles.forEach(tile => {
                    // Check if this tile has the collide property
                    if (tile.properties && this.hasCollideProperty(tile.properties)) {
                        // Calculate the global tile ID by adding the first gid of the tileset
                        const globalTileId = tileset.firstgid + tile.id;
                        this.collisionTileIds.add(globalTileId);
                        console.log(`Tile ID ${globalTileId} has collision property`);
                    }
                });
            }
        });

        console.log(`Found ${this.collisionTileIds.size} collision tile types`);
    }

    identifyActionTiles() {
        // Check if tilesets are available in the map data
        if (!this.mapData.tilesets || !this.mapData.tilesets.length) {
            console.warn("No tilesets found in map data");
            return;
        }

        // Go through each tileset
        this.mapData.tilesets.forEach(tileset => {
            // Check if the tileset has tile definitions with properties
            if (tileset.tiles) {
                // Go through each tile definition
                tileset.tiles.forEach(tile => {
                    // Check if this tile has the collide property
                    if (tile.properties && this.hasActionProperty(tile.properties)) {
                        // Calculate the global tile ID by adding the first gid of the tileset
                        const globalTileId = tileset.firstgid + tile.id;
                        this.actionTileIds.add(globalTileId);
                        console.log(`Tile ID ${globalTileId} has action property`);
                    }
                });
            }
        });

        console.log(`Found ${this.actionTileIds.size} action tile types`);
    }

    extractCollisionDataWithZIndex() {
        // Process layers in their original order (bottom to top)
        this.mapData.layers.forEach((layer, layerIndex) => {
            // Skip layers that aren't tile layers or don't have data
            if (layer.type !== "tilelayer" || !Array.isArray(layer.data)) {
                return;
            }

            console.log(`Processing layer "${layer.name}" (index: ${layerIndex})`);

            // Check if this layer has a specifically defined z-order
            const zIndex = layer.properties?.find(prop => prop.name === "zIndex")?.value || layerIndex;

            // Check if this entire layer is marked as collision
            const isCollisionLayer = layer.properties && this.hasCollideProperty(layer.properties);

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

                let isCollisionTile = false;

                // Check if this tile ID has collision properties
                // Or if the entire layer has collision properties
                if (this.collisionTileIds.has(actualTileId) || isCollisionLayer) {
                    isCollisionTile = true;
                }

                // Store this tile's collision state with its z-index
                if (!this.collisionMap.has(posKey)) {
                    this.collisionMap.set(posKey, []);
                }

                // Add this tile to the position's list with its z-index and collision status
                this.collisionMap.get(posKey).push({
                    layerIndex: zIndex,
                    hasCollision: isCollisionTile,
                    tileId: actualTileId
                });
            });
        });
    }

    calculateFinalCollisions() {
        // For each position in our collision map
        for (const [posKey, tiles] of this.collisionMap.entries()) {
            // Sort tiles by z-index, highest (top) last
            tiles.sort((a, b) => a.layerIndex - b.layerIndex);

            // The topmost non-empty tile determines collision status
            const topmostTile = tiles[tiles.length - 1];

            if (topmostTile.hasCollision) {
                this.finalWalls.add(posKey);
                console.log(`Final collision at: ${posKey} (from layer ${topmostTile.layerIndex})`);
            } else {
                console.log(`No collision at: ${posKey} (overridden by layer ${topmostTile.layerIndex})`);
            }
        }

        console.log(`Total final collision tiles: ${this.finalWalls.size}`);
    }

    // Clear the Tiled tile flags to get the actual tile ID
    clearTileFlags(tileId) {
        // Tiled uses bits 29-31 for flipping/rotation flags
        // 0x1FFFFFFF = binary 00011111111111111111111111111111
        return tileId & 0x1FFFFFFF;
    }

    hasCollideProperty(properties) {
        return properties.some(prop => prop.name === "collide" && prop.value === true);
    }

    hasActionProperty(properties) {
        return properties.some(prop => prop.name === "action-1" && prop.value === true);
    }

    // Check if a given position has a collision
    hasCollision(x, y) {
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        return this.finalWalls.has(key);
    }

    getWalls() {
        return this.finalWalls;
    }
}

// Example usage:
/*
const collisionHandler = new TiledCollisionHandler(mapData);

// To check collisions in your game loop:
if (collisionHandler.hasCollision(playerX, playerY)) {
  // Handle collision
}
*/