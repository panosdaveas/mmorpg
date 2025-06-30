import {GameObject} from "../../GameObject.js";
import {Vector2} from "../../Vector2.js";
import {resources} from "../../Resource.js";
import {Sprite} from "../../Sprite.js";
import {storyFlags} from "../../StoryFlags.js";

export class Npc extends GameObject {
  constructor(x, y, character, textConfig={}) {
    super({
      position: new Vector2(x, y)
    });

    // Opt into being solid
    this.isSolid = true;
    this.isInteractive = true;
    this.character = resources.images[character ?? "female"];

    // Say something when talking
    this.textContent = textConfig.content;
    this.textPortraitFrame = textConfig.portraitFrame;

    // Shadow under feet
    const shadow = new Sprite({
      resource: resources.images.shadow,
      frameSize: new Vector2(32, 32),
      position: new Vector2(-8, -19),
    })
    this.addChild(shadow);

    // Body sprite
    const body = new Sprite({
      resource: this.character,
      frameSize: new Vector2(24, 32),
      hFrames: 2,
      vFrames: 1,
      position: new Vector2(-4, -20),
    })
    this.addChild(body)
  }

  getContent() {

    // Maybe expand with story flag logic, etc
    const match = storyFlags.getRelevantScenario(this.textContent);
    if (!match) {
      console.warn("No matches found in this list!", this.textContent);
      return null;
    }

    return {
      portraitFrame: this.textPortraitFrame,
      string: match.string,
      addsFlag: match.addsFlag ?? null
    }
  }

}