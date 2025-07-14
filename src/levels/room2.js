import { Vector2 } from "../Vector2.js";
import { Level } from "../objects/Level/Level.js";
import { gridCells } from "../helpers/grid.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { Npc } from "../objects/Npc/Npc.js";
import { TALKED_TO_A, TALKED_TO_B } from "../StoryFlags.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from "../constants/worldConstants.js";
import mapData from './json/room2.json';

// const DEFAULT_HERO_POSITION = new Vector2(gridCells(36), gridCells(21))
const DEFAULT_HERO_POSITION = new Vector2(MAP_WIDTH / 2, MAP_HEIGHT / 2);

export class Room2 extends Level {
    constructor(params = {}) {
        console.log('Room2 constructor - heroPosition:', params.heroPosition);

        super({
            ...params,
            levelName: "Room 2",
            mapData: mapData,
            scale: 2,
        });

        this.levelId = params.levelId || "room2";

        // Store player setup info (don't set position here)
        this.heroStartPosition = params.heroPosition || DEFAULT_HERO_POSITION;
        this.localPlayer = params.hero;
        this.setLocalPlayer(this.localPlayer);

        // Only add player to scene graph in constructor
        if (this.localPlayer) {
            this.addChild(this.localPlayer);
        }

        this.cameraEnabled = false;

        const npc1 = new Npc(gridCells(35), gridCells(19), "female", {
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

        const npc2 = new Npc(gridCells(35), gridCells(17), "youngWomanBack", {
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

    async ready() {
        await super.ready();

        this.setPlayerPosition();

        // FIXED: Clean event binding
        // events.unsubscribe(this); 
        events.off("HERO_EXITS", this); // Remove any existing listeners

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
      <div>Address: ${this.localPlayer.getAttribute('address') || 'N/A'}</div>
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