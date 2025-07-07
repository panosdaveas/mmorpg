// SpriteSheet.js - Utility for splitting sprite sheets into individual sprites
export class SpriteSheet {
    constructor({
        resource, // Image URL or HTMLImageElement
        frameSize, // [width, height] or {width, height}
        hFrames, // number of horizontal frames
        vFrames, // number of vertical frames
        spacing = 0, // spacing between frames (optional)
        margin = 0 // margin around the sheet (optional)
    }) {
        this.resource = resource;
        this.frameWidth = Array.isArray(frameSize) ? frameSize[0] : frameSize.width || frameSize;
        this.frameHeight = Array.isArray(frameSize) ? frameSize[1] : frameSize.height || frameSize;
        this.hFrames = hFrames;
        this.vFrames = vFrames;
        this.spacing = spacing;
        this.margin = margin;

        this.sprites = []; // 2D array [row][col]
        this.isLoaded = false;
        this.image = null;

        this.init();
    }

    async init() {
        // Load the image if it's a URL
        if (typeof this.resource === 'string') {
            this.image = new Image();
            this.image.crossOrigin = 'anonymous'; // For canvas access

            return new Promise((resolve, reject) => {
                this.image.onload = () => {
                    this.extractSprites();
                    this.isLoaded = true;
                    resolve(this);
                };
                this.image.onerror = reject;
                this.image.src = this.resource;
            });
        } else {
            // Assume it's already an HTMLImageElement
            this.image = this.resource;
            this.extractSprites();
            this.isLoaded = true;
        }
    }

    extractSprites() {
        // Create a canvas to extract individual frames
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = this.frameWidth;
        canvas.height = this.frameHeight;

        // Initialize 2D array
        this.sprites = [];

        for (let row = 0; row < this.vFrames; row++) {
            this.sprites[row] = [];

            for (let col = 0; col < this.hFrames; col++) {
                // Clear canvas
                ctx.clearRect(0, 0, this.frameWidth, this.frameHeight);

                // Calculate source position on sprite sheet
                const srcX = this.margin + col * (this.frameWidth + this.spacing);
                const srcY = this.margin + row * (this.frameHeight + this.spacing);

                // Draw the specific frame onto the canvas
                ctx.drawImage(
                    this.image,
                    srcX, srcY, this.frameWidth, this.frameHeight, // source
                    0, 0, this.frameWidth, this.frameHeight // destination
                );

                // Convert to data URL and store
                this.sprites[row][col] = canvas.toDataURL('image/png');
            }
        }
    }

    // Get a specific sprite by row/col
    getSprite(row, col) {
        if (!this.isLoaded) {
            console.warn('SpriteSheet not loaded yet');
            return null;
        }

        if (row >= this.vFrames || col >= this.hFrames || row < 0 || col < 0) {
            console.warn(`Sprite coordinates out of bounds: [${row}][${col}]`);
            return null;
        }

        return this.sprites[row][col];
    }

    // Get sprite states for a GameUIComponent (common pattern)
    getSpriteStates({ normal, hover, pressed, disabled }) {
        return {
            normal: normal ? this.getSprite(normal[0], normal[1]) : null,
            hover: hover ? this.getSprite(hover[0], hover[1]) : null,
            pressed: pressed ? this.getSprite(pressed[0], pressed[1]) : null,
            disabled: disabled ? this.getSprite(disabled[0], disabled[1]) : null
        };
    }

    // Get all sprites in a row
    getRow(row) {
        if (!this.isLoaded || row >= this.vFrames || row < 0) {
            return [];
        }
        return this.sprites[row];
    }

    // Get all sprites in a column
    getColumn(col) {
        if (!this.isLoaded || col >= this.hFrames || col < 0) {
            return [];
        }
        return this.sprites.map(row => row[col]);
    }

    // Get all sprites as flat array
    getAllSprites() {
        return this.sprites.flat();
    }
}

// Helper function for easy sprite sheet creation
export const createSpriteSheet = async (config) => {
    const spriteSheet = new SpriteSheet(config);
    await spriteSheet.init();
    return spriteSheet;
};
