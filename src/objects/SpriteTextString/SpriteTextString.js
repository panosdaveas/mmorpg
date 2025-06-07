// Replace your SpriteTextString with this simplified version
// src/objects/SpriteTextString/SpriteTextString.js

import { GameObject } from "../../GameObject.js";
import { resources } from "../../Resource.js";
import { Vector2 } from "../../Vector2.js";
import { Sprite } from "../../Sprite.js";
import { events } from "../../Events.js";

export class SpriteTextString extends GameObject {
  constructor(config = {}) {
    super({
      position: new Vector2(0, 0) // Will be set dynamically
    });

    this.drawLayer = "HUD";

    // Text content and settings
    this.text = config.string ?? "Default text";
    this.portraitFrame = config.portraitFrame ?? 0;

    // Typewriter effect settings
    this.showingIndex = 0;
    this.textSpeed = 50; // ms between characters
    this.timeUntilNextShow = this.textSpeed;
    this.isComplete = false;

    // Dialog styling
    this.dialogWidth = 320;
    this.dialogHeight = 80;
    this.textStartX = 68;  // After portrait
    this.textStartY = 18;  // Top padding
    this.maxTextWidth = 240; // Available text width
    this.lineHeight = 14;

    // 🚨 Responsive positioning
    this.updatePosition();
    this.resizeHandler = () => this.updatePosition();
    window.addEventListener('resize', this.resizeHandler);

    // Create backdrop and portrait
    this.backdrop = new Sprite({
      resource: resources.images.dialogBox,
      frameSize: new Vector2(this.dialogWidth, this.dialogHeight)
    });

    this.portrait = new Sprite({
      resource: resources.images.portraits,
      hFrames: 4,
      frame: this.portraitFrame
    });
  }

  updatePosition() {
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const scale = Math.min(scaleX, scaleY);

    const effectiveWidth = rect.width / scale;
    const effectiveHeight = rect.height / scale;

    // Center horizontally, position near bottom
    this.position.x = effectiveWidth / 2 - this.dialogWidth / 2;
    this.position.y = effectiveHeight - this.dialogHeight - 16;
  }

  step(delta, root) {
    // Listen for user input
    const input = root.input;
    if (input?.getActionJustPressed("Space")) {
      if (this.showingIndex < this.text.length) {
        // Skip typewriter - show all text immediately
        this.showingIndex = this.text.length;
        this.isComplete = true;
        return;
      }

      // Done with the textbox
      events.emit("END_TEXT_BOX");
    }

    // Typewriter effect
    if (this.showingIndex < this.text.length) {
      this.timeUntilNextShow -= delta;
      if (this.timeUntilNextShow <= 0) {
        this.showingIndex += 1;
        this.timeUntilNextShow = this.textSpeed;

        if (this.showingIndex >= this.text.length) {
          this.isComplete = true;
        }
      }
    }
  }

  drawImage(ctx, drawPosX, drawPosY) {
    // Draw the backdrop
    this.backdrop.drawImage(ctx, drawPosX, drawPosY);

    // Draw the portrait
    this.portrait.drawImage(ctx, drawPosX + 16, drawPosY + 16);

    // 🚨 Draw text using canvas font
    this.drawText(ctx, drawPosX, drawPosY);
  }

  drawText(ctx, drawPosX, drawPosY) {
    // Set up font styling
    ctx.save();
    ctx.font = "12px fontRetroGaming";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000"; // Black text

    // Calculate text position
    const textX = drawPosX + this.textStartX;
    const textY = drawPosY + this.textStartY;

    // Get the text to display (typewriter effect)
    const displayText = this.text.substring(0, this.showingIndex);

    // Word wrap and draw text
    this.drawWrappedText(ctx, displayText, textX, textY, this.maxTextWidth, this.lineHeight);

    ctx.restore();
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== '') {
        // Line is too long, draw current line and start new one
        ctx.fillText(line.trim(), x, currentY);
        line = words[i] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    // Draw the last line
    if (line.trim().length > 0) {
      ctx.fillText(line.trim(), x, currentY);
    }
  }

  destroy() {
    // Clean up event listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    super.destroy();
  }
}