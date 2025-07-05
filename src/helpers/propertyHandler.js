// --- Fixed propertyHandler.js with Layer Priority ---

import { TILE_SIZE } from "../constants/worldConstants.js";

export class TiledPropertyHandler {
    constructor(mapData) {
        this.mapData = mapData;
        this.tilePropertiesMap = new Map();
        this.extractTileProperties();
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

    parseLayerTiles(tilesetImages, animatedTiles) {
        const walls = new Set();
        const actions = new Map();
        const processedPositions = new Set(); // Track positions that have been processed

        // Process layers in REVERSE order (top layer first, bottom layer last)
        // This ensures higher layers override lower layers
        const reversedLayers = [...this.mapData.layers].reverse();

        reversedLayers.forEach(layer => {
            if (layer.type !== "tilelayer") return;

            const width = layer.width;

            layer.data.forEach((tileId, index) => {
                const rawTileId = tileId & 0x1FFFFFFF;
                if (rawTileId === 0) return; // Empty tile

                const x = index % width;
                const y = Math.floor(index / width);
                const posKey = `${x * TILE_SIZE},${y * TILE_SIZE}`;

                // Skip if this position has already been processed by a higher layer
                if (processedPositions.has(posKey)) {
                    return;
                }

                let tileProps = this.tilePropertiesMap.get(rawTileId);
                if (!tileProps) {
                    const anim = animatedTiles.get(rawTileId);
                    if (anim?.frames?.length > 0) {
                        const baseTileId = anim.frames[0].tileid;
                        tileProps = this.tilePropertiesMap.get(baseTileId);
                    }
                }

                // Mark this position as processed
                processedPositions.add(posKey);

                // Add collision if this tile has collide property
                if (tileProps?.collide || tileProps?.door) {
                    walls.add(posKey);
                }

                // Add actions if this tile has action properties
                if (
                    tileProps
                    && Object.keys(tileProps).length > 0
                    && Object.keys(tileProps).includes('action')
                ) {
                    actions.set(posKey, {
                        x,
                        y,
                        tileId: rawTileId,
                        properties: tileProps
                    });
                }
            });
        });

        return { walls, actions };
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

                // ✅ Enhanced loading with multiple event listeners
                const cleanup = () => {
                    img.onload = null;
                    img.onerror = null;
                    img.onabort = null;
                };

                img.onload = () => {
                    // ✅ Double-check the image is actually ready
                    if (img.complete && img.naturalWidth > 0) {
                        images.set(tileset.firstgid, { image: img, tileset });
                        cleanup();
                        resolve();
                    } else {
                        // ✅ Image loaded but not properly - retry once
                        setTimeout(() => {
                            if (img.complete && img.naturalWidth > 0) {
                                images.set(tileset.firstgid, { image: img, tileset });
                                cleanup();
                                resolve();
                            } else {
                                console.error("Image loaded but not ready:", imagePath);
                                cleanup();
                                reject(new Error(`Image not ready: ${imagePath}`));
                            }
                        }, 100);
                    }
                };

                img.onerror = (error) => {
                    console.error("Failed to load", imagePath, error);
                    cleanup();
                    reject(new Error(`Failed to load: ${imagePath}`));
                };

                img.onabort = () => {
                    console.warn("Image loading aborted:", imagePath);
                    cleanup();
                    reject(new Error(`Loading aborted: ${imagePath}`));
                };

                // ✅ Add crossOrigin if needed and start loading
                img.crossOrigin = "anonymous";
                img.src = imagePath;

                // ✅ Timeout fallback
                setTimeout(() => {
                    if (!img.complete) {
                        console.warn("Image loading timeout:", imagePath);
                        cleanup();
                        reject(new Error(`Loading timeout: ${imagePath}`));
                    }
                }, 10000); // 10 second timeout
            });
        });

        try {
            await Promise.all(loaders);
            console.log(`✅ All ${images.size} tilesets loaded successfully`);
            return images;
        } catch (error) {
            console.error("Failed to load some tileset images:", error);
            // ✅ Return what we have instead of failing completely
            return images;
        }
    }
}