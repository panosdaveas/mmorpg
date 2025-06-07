import {GameObject} from "../../GameObject.js";
import {Vector2} from "../../Vector2.js";
import {Sprite} from "../../Sprite.js";
import {resources} from "../../Resource.js";
import {events} from "../../Events.js";

export class Rod extends GameObject {
  constructor(x,y) {
    super({
      name: "Rod",
      position: new Vector2(x,y)
    });
    const sprite = new Sprite({
      resource: resources.images.rod,
      position: new Vector2(0, -5) // nudge upwards visually
    })
    this.addChild(sprite);
    this.hasBeenPickedUp = false;

  }

  ready() {
    events.on("HERO_POSITION", this, pos => {
      if (this.hasBeenPickedUp) {
        return;
      }
      // detect overlap...
      const roundedHeroX = Math.round(pos.x);
      const roundedHeroY = Math.round(pos.y);
      if (roundedHeroX === this.position.x && roundedHeroY === this.position.y) {
        this.onCollideWithHero();
      }
    })
  }

  onCollideWithHero() {
    if (this.hasBeenPickedUp) {
      return; // Already being processed
    }
    this.hasBeenPickedUp = true;
    // Remove this instance from the scene
    this.destroy();

    // Alert other things that we picked up a rod
    events.emit("HERO_PICKS_UP_ITEM", {
      type: "ROD",
      image: resources.images.rod,
      position: this.position
    })
  }

}