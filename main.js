import './style.css'
import { Vector2 } from "./src/Vector2.js";
import { GameLoop } from "./src/GameLoop.js";
import { Main } from "./src/objects/Main/Main.js";
import { MainMap } from './src/levels/map.js';
import { Hero } from './src/objects/Hero/Hero';
import { MAP_HEIGHT, MAP_WIDTH } from './src/constants/worldConstants';
import { ReactUIManager } from './src/UI/ReactUIManager.jsx';


// Add this to main.js for pixel-perfect scaling
// 16:9 Cover behavior - fills window, maintains aspect ratio, crops if needed
function setupGame16x9Cover() {
  const canvas = document.querySelector("#game-canvas");

  function resize() {
    const targetAspect = 16 / 9; // Your game's aspect ratio
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspect = windowWidth / windowHeight;

    let canvasWidth, canvasHeight;

    if (windowAspect > targetAspect) {
      // Window is wider than 16:9 → fit to width (crop top/bottom)
      canvasWidth = windowWidth;
      canvasHeight = windowWidth / targetAspect;
    } else {
      // Window is taller than 16:9 → fit to height (crop left/right)
      canvasHeight = windowHeight;
      canvasWidth = windowHeight * targetAspect;
    }

    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

  }

  window.addEventListener('resize', resize);
  resize();
}


// Grabbing the canvas to draw to
const canvas = document.querySelector("#game-canvas");

// Add this after your canvas is created
// setupGame16x9Cover();

const ctx = canvas.getContext("2d");

// Create instance of Hero
const DEFAULT_HERO_POSITION = new Vector2((MAP_WIDTH / 2) + 32, (MAP_HEIGHT / 2) + 32);
const hero = new Hero(DEFAULT_HERO_POSITION.x, DEFAULT_HERO_POSITION.y);

// Establish the root scene
const mainScene = new Main({
  position: new Vector2(0, 0)
})

// Set up the level with multiplayer support
const mainMap = new MainMap({
  hero,
  heroPosition: DEFAULT_HERO_POSITION
});
mainScene.setLevel(mainMap);

const reactUIManager = new ReactUIManager(mainScene);
// createTestRemotePlayers(mainScene.multiplayerManager);

// Establish update and draw loops
const update = (delta) => {
  mainScene.stepEntry(delta, mainScene);
  mainScene.input?.update();

  // Toggle menu with Enter key

  const level = mainScene.level;
  if (level?.update) {
    level.update(delta);
  }

  // Update remote players through multiplayer manager
  // mainScene.multiplayerManager.updateRemotePlayers(delta);
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
  ctx.webkitImageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  ctx.scale(zoom, zoom);
  if (mainScene.camera) {
    ctx.translate(mainScene.camera.position.x, mainScene.camera.position.y);
  }

  // 4. Draw objects (hero, NPCs, etc.)
  mainScene.drawBackground(ctx);
  mainScene.drawObjects(ctx);
  mainScene?.drawMiddleLayer(ctx);

  ctx.restore();

  // 5. Draw HUD/UI
  mainScene.drawForeground(ctx);
}

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  // multiplayerManager.disconnect();
  reactUIManager.cleanup();
  mainScene.cleanup();
});

// ✅ Wait for the map to fully load before starting game loop
(async () => {
  const level = mainScene?.level;
  await level.ready();

  const gameLoop = new GameLoop(update, draw);
  gameLoop.start();                  // Start game only when safe

  // setTimeout(() => {
  //   if (mainScene.multiplayerManager?.isSocketConnected()) {
  //     createTestRemotePlayers(mainScene.multiplayerManager, 1, {
  //       // spawnX: 320,
  //       // spawnY: 240,
  //     });
  //   }
  // }, 1000); // Give multiplayer 1 second to connect

  // if(!mainScene.multiplayerManager.isSocketConnected()) {
  //   removeTestPlayers(mainScene.multiplayerManager);
  // }
})();