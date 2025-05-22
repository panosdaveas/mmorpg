import './style.css'
import { Vector2 } from "./src/Vector2.js";
import { GameLoop } from "./src/GameLoop.js";
import { Main } from "./src/objects/Main/Main.js";
import { MainMap } from './src/levels/map.js';
import { MultiplayerManager } from './src/client/multiplayerManager.js';

// Grabbing the canvas to draw to
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");

// Create multiplayer manager instance
const multiplayerManager = new MultiplayerManager();

// Connect to multiplayer server
multiplayerManager.connect('http://localhost:3000');

// Establish the root scene
const mainScene = new Main({
  position: new Vector2(0, 0)
})

// Set up the level with multiplayer support
const mainMap = new MainMap({ multiplayerManager });
mainScene.setLevel(mainMap);

// Set the current level in multiplayer manager
multiplayerManager.setLevel(mainMap);

// Establish update and draw loops
const update = (delta) => {
  mainScene.stepEntry(delta, mainScene);
  mainScene.input?.update();
  const level = mainScene.level;
  if (level?.update) {
    level.update(delta);
  }

  // Update remote players through multiplayer manager
  multiplayerManager.updateRemotePlayers(delta);
};

const draw = () => {
  // 1. Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw sky and animated tilemap (covers the whole canvas)

  // 3. Apply camera movement
  ctx.save();
  if (mainScene.camera) {
    ctx.translate(mainScene.camera.position.x, mainScene.camera.position.y);
  }

  // 4. Draw objects (hero, NPCs, etc.)
  mainScene.drawBackground(ctx);
  mainScene.drawObjects(ctx);
  ctx.restore();

  // 5. Draw HUD/UI
  mainScene.drawForeground(ctx);
}

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  multiplayerManager.disconnect();
});

// Start the game!
const gameLoop = new GameLoop(update, draw);
gameLoop.start();