import {GameObject} from "../../GameObject.js";
import {Sprite} from "../../Sprite.js";
import {resources} from "../../Resource.js";
import {Vector2} from "../../Vector2.js";
import {CANVAS_WIDTH, CANVAS_HEIGHT} from "../../constants/worldConstants.js";

export class TextBox extends GameObject {
  constructor() {
    super({
      position: new Vector2(CANVAS_WIDTH / 2 , CANVAS_HEIGHT - 8)
    });
    this.content = "Hi. How are ya? How are ya? How are ya?"
    this.backdrop = new Sprite({
      resource: resources.images.dialogBox,
      frameSize: new Vector2(320, 80)
    })
    this.drawLayer = "HUD";
  }

  drawImage(ctx, drawPosX, drawPosY) {
    // Draw backdrop first
    this.backdrop.drawImage(ctx, drawPosX, drawPosY)

    // Now we draw text...§
    ctx.font = "12px fontRetroGaming"; // set in style.css
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000";

    const MAX_WIDTH = 250;
    const LINE_HEIGHT = 16;
    const PADDING_LEFT = 65;
    const PADDING_TOP = 18;

    let words = this.content.split(" ");
    let line = "";

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + " ";
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;

      // If the test line exceeds the maximum width, and it's not the first word...
      if (testWidth > MAX_WIDTH && n > 0) {
        ctx.fillText(line, drawPosX + PADDING_LEFT, drawPosY + PADDING_TOP);
        // Reset the line to start with the current word.
        line = words[n] + " ";
        // Move our cursor downwards
        drawPosY += LINE_HEIGHT;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, drawPosX+PADDING_LEFT, drawPosY+PADDING_TOP)
  }

}