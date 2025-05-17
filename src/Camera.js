import {GameObject} from "./GameObject.js";
import {events} from "./Events.js";
import {Vector2} from "./Vector2.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants/worldConstants.js";

export class Camera extends GameObject {
  constructor() {
    super({});

    events.on("HERO_POSITION", this, heroPosition => {
      this.centerPositionOnTarget(heroPosition)
    })

    // Camera knows when a new level starts
    events.on("CHANGE_LEVEL", this, (newMap) => {
      this.centerPositionOnTarget(newMap.heroStartPosition)
    })
  }

  centerPositionOnTarget(pos) {
    // Create a new position based on the incoming position
    const personHalf = 8;
    const canvasWidth = CANVAS_WIDTH;
    const canvasHeight = CANVAS_HEIGHT;
    const halfWidth = -personHalf + canvasWidth / 2;
    const halfHeight = -personHalf + canvasHeight / 2;
    this.position = new Vector2(
      -pos.x + halfWidth,
      -pos.y + halfHeight,
    )
  }


}