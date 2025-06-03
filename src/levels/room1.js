import { Sprite } from "../Sprite.js";
import { Vector2 } from "../Vector2.js";
import { resources } from "../Resource.js";
import { Level } from "../objects/Level/Level.js";
import { gridCells } from "../helpers/grid.js";
import { Exit } from "../objects/Exit/Exit.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { MainMap } from "./map.js";
import { Npc } from "../objects/Npc/Npc.js";
import { TALKED_TO_A, TALKED_TO_B } from "../StoryFlags.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from "../constants/worldConstants.js";
import mapData from './json/room1.json';

// const DEFAULT_HERO_POSITION = new Vector2(gridCells(36), gridCells(21))
const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class Room1 extends Level {
  constructor(params = {}) {
    super({
      ...params,
      levelName: "Room 1",
      mapData: mapData,
      scale: 2,
    });

    const exit = new Exit(gridCells(36), gridCells(22))
    this.addChild(exit);

    this.heroStartPosition = params.heroPosition ?? DEFAULT_HERO_POSITION;
    this.hero = new Hero(this.heroStartPosition.x, this.heroStartPosition.y);

    // toggle if the level is multiplayer or not
    // this.setLocalPlayer(this.hero);

    this.cameraEnabled = false; // Disable camera movement for this level

    const rod = new Rod(gridCells(9), gridCells(6))
    // this.addChild(rod)

    const npc1 = new Npc(gridCells(32), gridCells(20), {
      //content: "I am the first NPC!",
      content: [
        {
          string: "I just can't stand that guy.",
          requires: [TALKED_TO_B],
          bypass: [TALKED_TO_A],
          addsFlag: TALKED_TO_A,
        },
        {
          string: "He is just the worst!",
          requires: [TALKED_TO_A],
        },
        {
          string: "Grumble grumble. Another day at work.",
          requires: [],
        }
      ],
      portraitFrame: 1
    })
    this.addChild(npc1);

    const npc2 = new Npc(gridCells(32), gridCells(18), {
      content: [
        {
          string: "What a wonderful day at work in the cave!",
          requires: [],
          addsFlag: TALKED_TO_B
        }
      ],
      portraitFrame: 0
    })
    this.addChild(npc2);

    this.addChild(this.hero);

    // this.walls = new Set();
    // Add debug text display
    this.debugText = document.createElement('div');
    this.debugText.style.position = 'absolute';
    this.debugText.style.top = '10px';
    this.debugText.style.left = '10px';
    this.debugText.style.background = 'rgba(0,0,0,0.5)';
    this.debugText.style.color = 'white';
    this.debugText.style.padding = '10px';
    this.debugText.style.fontFamily = 'monospace';
    this.debugText.style.zIndex = '1000';
    document.body.appendChild(this.debugText);
  }

  // Set the local player for this level
  setLocalPlayer(player) {
    this.localPlayer = player;
    this.localPlayer.currentLevelName === this.levelName;

    // If multiplayer is enabled, notify the manager about the level change
    if (this.multiplayerManager) {
      this.multiplayerManager.setLevel(this);
    }
  }

  async ready() {
    await super.ready();

    events.on("HERO_EXITS", this, () => {
      this.cleanup();
      events.emit("CHANGE_LEVEL", new MainMap({
        heroPosition: new Vector2(gridCells(23), gridCells(17)),
        multiplayerManager: this.multiplayerManager, // Pass multiplayer manager to new level
        // position: null, // Reset position for new level
      }))
    })

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: this.mapData.width * TILE_SIZE,
      height: this.mapData.height * TILE_SIZE,
    });

    events.emit("SET_CAMERA_OPTIONS", {
      zoom: this.scale, // Set zoom level for this level
      enabled: this.cameraEnabled, // Disable camera movement for this level
      // position: DEFAULT_HERO_POSITION,
    })
  }

  updateDebugText() {

    const tileX = Math.floor(this.hero.position.x / TILE_SIZE);
    const tileY = Math.floor(this.hero.position.y / TILE_SIZE);

    this.debugText.innerHTML = `
      <div>Local Position: x:${Math.round(tileX)}, y:${Math.round(tileY)}</div>
    `;
  }

  // Called on each game tick from main.js
  update(delta) {
    // Call parent update first (handles basic multiplayer updates)
    super.update(delta);
    this.updateDebugText();
  }

  cleanup() {
    // Call parent cleanup
      // Remove debug display
      if (this.debugText && this.debugText.parentNode) {
        this.debugText.parentNode.removeChild(this.debugText);
      }

      // Call parent cleanup
    super.cleanup();
  }

}