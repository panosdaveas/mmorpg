import { Level } from "../objects/Level/Level.js";
import { Sprite } from "../Sprite.js";
import { resources } from "../Resource.js";
import { Vector2 } from "../Vector2.js";
import { Exit } from "../objects/Exit/Exit.js";
import { gridCells } from "../helpers/grid.js";
import { Hero } from "../objects/Hero/Hero.js";
import { Rod } from "../objects/Rod/Rod.js";
import { events } from "../Events.js";
import { CaveLevel1 } from "./CaveLevel1.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from "../constants/worldConstants.js";
import mapData from './json/map.json';
import { TiledPropertyHandler } from "../helpers/propertyHandler.js";
import { io } from "socket.io-client";

const DEFAULT_HERO_POSITION = new Vector2(gridCells(20), gridCells(21));

export class OutdoorLevel1 extends Level {
  constructor(params = {}) {
    super({});

    this.socket = io('http://localhost:3000');
    this.players = {}; // id -> Hero instances
    this.lastSentPosition = null;

    // Sky background
    this.background = new Sprite({
      resource: resources.images.sky,
      frameSize: new Vector2(CANVAS_WIDTH, CANVAS_HEIGHT)
    });

    // Ground
    const groundSprite = new Sprite({
      resource: resources.images.map,
      frameSize: new Vector2(MAP_WIDTH, MAP_HEIGHT)
    });
    this.addChild(groundSprite);

    // Local player (our hero)
    // this.heroStartPosition = params.heroPosition ?? DEFAULT_HERO_POSITION;
    this.heroStartPosition = DEFAULT_HERO_POSITION;
    this.localPlayer = new Hero(this.heroStartPosition.x, this.heroStartPosition.y, 'red');
    this.players['local'] = this.localPlayer;
    this.addChild(this.localPlayer);

    // Walls and interactions
    const propertyHandler = new TiledPropertyHandler(mapData);
    this.walls = propertyHandler.getWallTiles();
    this.actions = propertyHandler.getActionTiles();
    this.propertyHandler = propertyHandler;

    // Multiplayer setup
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    const socket = this.socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
    });

    socket.on('currentPlayers', players => {
      for (const [id, pos] of Object.entries(players)) {
        if (id !== socket.id && !this.players[id]) {
          const remote = new Hero(pos.x, pos.y, 'blue');
          this.players[id] = remote;
          this.addChild(remote);
        }
      }
    });

    socket.on('newPlayer', data => {
      if (!this.players[data.id] && data.id !== socket.id) {
        const remote = new Hero(data.x, data.y, 'blue');
        this.players[data.id] = remote;
        this.addChild(remote);
      }
    });

    socket.on('playerMoved', data => {
      if (data.id !== socket.id && this.players[data.id]) {
        this.players[data.id].x = data.x;
        this.players[data.id].y = data.y;
      }
    });

    socket.on('removePlayer', id => {
      if (this.players[id]) {
        this.removeChild(this.players[id]);
        delete this.players[id];
      }
    });
  }

  // Called on each game tick from main.js
  update(delta) {
    if (!this.localPlayer) return;

    // Update local player
    this.localPlayer.update?.(delta); // only if Hero supports update()

    // Send position to server if it changed
    const { x, y } = this.localPlayer;
    const last = this.lastSentPosition;
    if (!last || last.x !== x || last.y !== y) {
      this.socket.emit('move', { x, y });
      this.lastSentPosition = { x, y };
    }
  }

  ready() {
    events.on("HERO_EXITS", this, () => {
      events.emit("CHANGE_LEVEL", new CaveLevel1({
        heroPosition: new Vector2(gridCells(3), gridCells(6))
      }));
    });
  }
}
