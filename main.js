import './style.css'
import { Vector2 } from "./src/Vector2.js";
import { GameLoop } from "./src/GameLoop.js";
import { Main } from "./src/objects/Main/Main.js";
import { MainMap } from './src/levels/map.js';
import { Room1 } from './src/levels/room1.js';
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
 
  if (!mainScene.level?.isReady) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText("Loading map...", 20, 40);
    return; // or draw a loading screen
  }

  // 1. Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw sky and animated tilemap (covers the whole canvas)

  // 3. Apply camera movement
  const zoom = mainScene.level?.scale ?? 1;
  ctx.save();
  ctx.imageSmoothingEnabled = false; // 👈 Keep pixel-perfect
  ctx.scale(zoom, zoom);
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
// const gameLoop = new GameLoop(update, draw);
// gameLoop.start();

// ✅ Wait for the map to fully load before starting game loop
(async () => {
  await mainMap.ready();              // Wait for map tiles & tilesets to load

  const gameLoop = new GameLoop(update, draw);
  gameLoop.start();                  // Start game only when safe
})();