import {GameObject} from "../../GameObject.js";
import {Vector2} from "../../Vector2.js";
import {Sprite} from "../../Sprite.js";
import {resources} from "../../Resource.js";
import {events} from "../../Events.js";

export class Exit extends GameObject {
  constructor(x, y, exitId = 'default') {
    super({
      position: new Vector2(x,y)
    });

    this.exitId = exitId;
    this.drawLayer = "FLOOR";
  }

  ready() {
    events.on("HERO_POSITION", this, pos => {
      // detect overlap...
      const roundedHeroX = Math.round(pos.x);
      const roundedHeroY = Math.round(pos.y);
      if (roundedHeroX === this.position.x && roundedHeroY === this.position.y) {
        events.emit("HERO_EXITS", {
          exitId: this.exitId,
          exitPosition: this.position
        })
      }
    })
  }

  // 🚨 CRITICAL FIX: Clean up event listeners when destroyed
  // destroy() {
  //   // Remove the specific event subscription
  //   if (this.heroPositionSubscription) {
  //     events.off(this.heroPositionSubscription);
  //     this.heroPositionSubscription = null;
  //   }

  //   // Alternative/backup cleanup - remove ALL events for this object
  //   events.unsubscribe(this);

  //   // Call parent destroy
  //   super.destroy();
  // }
}