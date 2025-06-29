class Resources {
  constructor() {
    // Everything we plan to download
    this.toLoad = {
      hero: "/sprites/hero-sheet.png",
      hero24x32: "/sprites/hero24x32.png",
      remoteHero: "/sprites/remoteHero.png",
      shadow: "/sprites/shadow.png",
      rod: "/sprites/rod.png",
      exit: "/sprites/exit.png",
      // Outdoor
      sky: "/sprites/sky.png",
      ground: "/sprites/ground.png",
      map: "/sprites/map.png",
      // Cave
      cave: "/sprites/cave.png",
      caveGround: "/sprites/cave-ground.png",
      // NPCs
      knight: "/sprites/knight-sheet-1.png",
      female: "/sprites/female-char.png",
      // HUD
      textBox: "/sprites/text-box.png",
      fontWhite: "/sprites/sprite-font-white.png",
      fontBlack: "/sprites/sprite-font-black.png",
      font: "/sprites/font.png",
      portraits: "/sprites/portraits-sheet.png",
      water: "/sprites/Water.png",
      dialogBox: "/sprites/dialogBox.png",
      menuBox: "/sprites/menu-dark.png",
      interfaceBox: "/sprites/menu.png",
      interface: "/sprites/interface.png",
      testButton: "/sprites/testButton.png",
      selectionTopLeftCorner: "/sprites/selectionTopLeftCorner.png",
      selectionTopRightCorner: "/sprites/selectionTopRightCorner.png",
      selectionBottomLeftCorner: "/sprites/selectionBottomLeftCorner.png",
      selectionBottomRightCorner: "/sprites/selectionBottomRightCorner.png",
    };

    // A bucket to keep all of our images
    this.images = {};

    // Load each image
    Object.keys(this.toLoad).forEach(key => {
      const img = new Image();
      img.src = this.toLoad[key];
      this.images[key] = {
        image: img,
        isLoaded: false
      }
      img.onload = () => {
        this.images[key].isLoaded = true;
      }
    })
  }
}

// Create one instance for the whole app to use
export const resources = new Resources();
