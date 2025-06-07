import { Sprite } from "../Sprite.js";
import { Vector2 } from "../Vector2.js";
import { resources } from "../Resource.js";
import { Level } from "../objects/Level/Level.js";
import { gridCells } from "../helpers/grid.js";
import { Exit } from "../objects/Exit/Exit.js";
// import { Hero } from "../objects/Hero/Hero.js";
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
    console.log('Room1 constructor - heroPosition:', params.heroPosition);

    super({
      ...params,
      levelName: "Room 1",
      mapData: mapData,
      scale: 2,
    });

    const exit = new Exit(gridCells(36), gridCells(22))
    this.addChild(exit);

    // FIXED: Better position handling
    this.heroStartPosition = params.heroPosition || DEFAULT_HERO_POSITION;
    this.localPlayer = params.hero;

    console.log('Room1 - Setting player position to:', this.heroStartPosition);

    // FIXED: Set position immediately and ensure it sticks
    if (this.localPlayer) {
      // Stop any current movement or interpolation  
      this.localPlayer.isSolid = true;

      // Set position directly
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;

      // If your player has a setPosition method, use it
      if (typeof this.localPlayer.setPosition === 'function') {
        this.localPlayer.setPosition(this.heroStartPosition.x, this.heroStartPosition.y);
      }

      console.log('Room1 - Player position set to:', this.localPlayer.position);

      this.addChild(this.localPlayer);
      this.setLocalPlayer(this.localPlayer);
    }

    this.cameraEnabled = false;


    const rod = new Rod(gridCells(9), gridCells(6))
    // this.addChild(rod)

    const npc1 = new Npc(gridCells(33), gridCells(20), {
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


    // this.walls = new Set();
    // Add debug text display
    // Debug text setup
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

    // FIXED: Ensure player position is set after level is ready
    if (this.localPlayer && this.heroStartPosition) {
      console.log('Room1 ready - Final position set:', this.heroStartPosition);
      this.localPlayer.position.x = this.heroStartPosition.x;
      this.localPlayer.position.y = this.heroStartPosition.y;

      // Force position update event
      events.emit("HERO_POSITION", this.localPlayer.position);
    }

    // FIXED: Clean event binding
    events.off("HERO_EXITS", this); // Remove any existing listeners
    events.on("HERO_EXITS", this, () => {
      console.log('Room1 - HERO_EXITS triggered');
      this.cleanup();

      const newLevel = new MainMap({
        heroPosition: new Vector2(gridCells(23), gridCells(17)),
        multiplayerManager: this.multiplayerManager,
        hero: this.localPlayer
      });

      events.emit("CHANGE_LEVEL", newLevel);
    })

    events.emit("SET_CAMERA_MAP_BOUNDS", {
      width: this.mapData.width * TILE_SIZE,
      height: this.mapData.height * TILE_SIZE,
    });

    events.emit("SET_CAMERA_OPTIONS", {
      zoom: this.scale,
      enabled: this.cameraEnabled,
    })
  }

  updateDebugText() {
    if (!this.localPlayer) return;

    const tileX = Math.floor(this.localPlayer.position.x / TILE_SIZE);
    const tileY = Math.floor(this.localPlayer.position.y / TILE_SIZE);

    this.debugText.innerHTML = `
      <div>Level: ${this.levelName}</div>
      <div>Local Position: x:${Math.round(this.localPlayer.position.x)}, y:${Math.round(this.localPlayer.position.y)}</div>
      <div>Tile Position: x:${tileX}, y:${tileY}</div>
      <div>Camera Enabled: ${this.cameraEnabled}</div>
      <div>Level Ready: ${this.isReady}</div>
    `;
  }

  update(delta) {
    super.update(delta);
    this.updateDebugText();
  }

  cleanup() {
    console.log('Room1 cleanup called');

    // Remove debug display
    if (this.debugText && this.debugText.parentNode) {
      this.debugText.parentNode.removeChild(this.debugText);
    }

    // Call parent cleanup
    super.cleanup();
  }

}