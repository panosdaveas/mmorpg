import { GameObject } from "../../GameObject.js";
import { resources } from "../../Resource.js";
import { Vector2 } from "../../Vector2.js";
import { Sprite } from "../../Sprite.js";
import { events } from "../../Events.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../constants/worldConstants.js";

export class SpriteTextString extends GameObject {
  constructor(config = {}) {
    super({
      // 🚨 FIXED: Use original constants instead of dynamic positioning
      position: new Vector2(CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT - 96)
    });

    this.drawLayer = "HUD";

    // Text content and settings
    this.fullText = config.string ?? "Default text";
    this.portraitFrame = config.portraitFrame ?? 0;

    // Pagination settings
    this.maxLinesPerPage = 3;
    this.pages = [];
    this.currentPage = 0;
    this.currentPageText = "";

    // Typewriter effect settings
    this.showingIndex = 0;
    this.textSpeed = 80;
    this.timeUntilNextShow = this.textSpeed;
    this.isPageComplete = false;
    this.isAllPagesComplete = false;

    // Dialog styling - FIXED VALUES
    this.dialogWidth = 320;
    this.dialogHeight = 80;
    this.textStartX = 66;
    this.textStartY = 18;
    this.maxTextWidth = 240; // Fixed max width
    this.lineHeight = 16;

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

    // 🚨 Process text into pages (no canvas measurement issues)
    this.processTextIntoPages();
    this.startCurrentPage();
  }

  // 🚨 SIMPLIFIED: Process text without canvas measurement
  processTextIntoPages() {
    // Simple word-based splitting instead of canvas measurement
    const words = this.fullText.split(' ');
    const allLines = [];
    let currentLine = '';
    const maxCharsPerLine = 28; // Approximate characters per line for 12px font

    for (let word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;

      // Simple character-based line breaking
      if (testLine.length > maxCharsPerLine && currentLine) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      allLines.push(currentLine);
    }

    // Group lines into pages (max 3 lines per page)
    this.pages = [];
    for (let i = 0; i < allLines.length; i += this.maxLinesPerPage) {
      const pageLines = allLines.slice(i, i + this.maxLinesPerPage);
      const pageText = pageLines.join('\n');
      this.pages.push({
        text: pageText,
        lines: pageLines
      });
    }

  }

  startCurrentPage() {
    if (this.currentPage < this.pages.length) {
      this.currentPageText = this.pages[this.currentPage].text;
      this.showingIndex = 0;
      this.isPageComplete = false;
      this.timeUntilNextShow = this.textSpeed;

    } else {
      this.isAllPagesComplete = true;
    }
  }

  nextPage() {
    this.currentPage++;
    if (this.currentPage < this.pages.length) {
      this.startCurrentPage();
    } else {
      this.isAllPagesComplete = true;
    }
  }

  step(delta, root) {
    const input = root.input;

    if (input?.getActionJustPressed("Space")) {
      if (!this.isPageComplete) {
        // Skip typewriter - show rest of current page
        this.showingIndex = this.currentPageText.length;
        this.isPageComplete = true;
        return;
      }

      if (this.currentPage < this.pages.length - 1) {
        // More pages to show - go to next page
        this.nextPage();
        return;
      } else {
        // All pages complete - close dialog
        events.emit("END_TEXT_BOX");
        return;
      }
    }

    // Typewriter effect for current page
    if (this.showingIndex < this.currentPageText.length) {
      this.timeUntilNextShow -= delta;
      if (this.timeUntilNextShow <= 0) {
        this.showingIndex += 1;
        this.timeUntilNextShow = this.textSpeed;

        if (this.showingIndex >= this.currentPageText.length) {
          this.isPageComplete = true;
        }
      }
    }
  }

  drawImage(ctx, drawPosX, drawPosY) {
    // Draw backdrop
    this.backdrop.drawImage(ctx, drawPosX, drawPosY);

    // Draw portrait
    this.portrait.drawImage(ctx, drawPosX + 16, drawPosY + 16);

    // Draw current page text
    this.drawText(ctx, drawPosX, drawPosY);

    // Draw page indicator if multiple pages
    if (this.pages.length > 1) {
      this.drawPageIndicator(ctx, drawPosX, drawPosY);
    }
  }

  drawText(ctx, drawPosX, drawPosY) {
    ctx.save();
    ctx.font = "12px fontRetroGaming";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000";

    const textX = drawPosX + this.textStartX;
    const textY = drawPosY + this.textStartY;

    // Display current page text with typewriter effect
    const displayText = this.currentPageText.substring(0, this.showingIndex);

    // Draw line by line
    const lines = displayText.split('\n');
    lines.forEach((line, index) => {
      const lineY = textY + (index * this.lineHeight);
      ctx.fillText(line, textX, lineY);
    });

    ctx.restore();
  }

  drawPageIndicator(ctx, drawPosX, drawPosY) {
    ctx.save();
    // ctx.font = "10px fontRetroGaming";
    // ctx.textAlign = "right";
    // ctx.textBaseline = "bottom";
    // ctx.fillStyle = "#666";

    // const indicatorText = `${this.currentPage + 1}/${this.pages.length}`;
    // const indicatorX = drawPosX + this.dialogWidth - 10;
    // const indicatorY = drawPosY + this.dialogHeight - 5;

    // ctx.fillText(indicatorText, indicatorX, indicatorY);

    // Show continuation arrow if more pages
    if (this.isPageComplete && this.currentPage < this.pages.length - 1) {
      ctx.fillStyle = "#000";
      ctx.font = "12px fontRetroGaming";
      ctx.textAlign = "center";
      const arrowX = drawPosX + this.dialogWidth - 23;
      const arrowY = drawPosY + this.dialogHeight - 18;
      ctx.fillText("▼", arrowX, arrowY);
    }

    ctx.restore();
  }

  // 🚨 REMOVED: No more dynamic positioning or event listeners
  // destroy() {
  //   super.destroy();
  // }
}
