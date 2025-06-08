import { PlayersInterface } from "../InterfaceObjects/PlayersInterface";
import { GameObject } from "../../GameObject";
import { Vector2 } from "../../Vector2";
import { Sprite } from "../../Sprite";
import { events } from "../../Events";
import { resources } from "../../Resource";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "../../constants/worldConstants";
// Menu.js - Main menu class
export class Menu extends GameObject {
    constructor({ multiplayerManager }) {
      super({
        position: new Vector2(0, 0)
      });

      this.canvas = document.getElementById('game-canvas');
      this.multiplayerManager = multiplayerManager;
      this.tileSize = TILE_SIZE;
      
      // Menu configuration
      this.menuWidth = this.tileSize * 10; // 160px
      this.menuHeight = this.tileSize * 12; // 128px
      this.menuItems = ["PROFILE", "PLAYERS", "OPTIONS", "EXIT"];
      this.selectedIndex = 0;
      this.isVisible = false;
      this.drawLayer = "HUD";
      
      // Position menu on the right side
      this.menuX = CANVAS_WIDTH - this.menuWidth + this.tileSize;
      this.menuY = this.tileSize;
      
      // Create menu backdrop sprite
      this.backdrop = new Sprite({
        resource: resources.images.menuBox,
        frameSize: new Vector2(this.menuWidth, this.menuHeight)
      });
      
      // Create interfaces
      this.interfaces = {
        players: new PlayersInterface({ multiplayerManager: this.multiplayerManager })
      };
      
      // Mouse tracking
      this.mouseX = 0;
      this.mouseY = 0;
      
      // Add mouse event listeners
      this.setupMouseListeners();
    }
    
    setupMouseListeners() {
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.mouseX = (e.clientX - rect.left) * scaleX;
        this.mouseY = (e.clientY - rect.top) * scaleY;
        
        // Check if mouse is over menu items when menu is visible
        if (this.isVisible) {
          this.checkMouseHover();
        }
      });
      
      this.canvas.addEventListener('click', (e) => {
        if (this.isVisible) {
          this.handleMouseClick();
        }
      });
    }
    
    checkMouseHover() {
      const itemHeight = this.tileSize * 1.5;
      const startY = this.menuY + this.tileSize * 1.5;
      
      for (let i = 0; i < this.menuItems.length; i++) {
        const itemY = startY + (i * itemHeight);
        const itemX = this.menuX + this.tileSize;
        
          if (this.mouseX >= itemX &&
              this.mouseX <= itemX + this.menuWidth - this.tileSize &&
              this.mouseY >= itemY - this.tileSize / 2 &&
              this.mouseY <= itemY + this.tileSize / 2) {
          this.selectedIndex = i;
          break;
        }
      }
    }
    
    handleMouseClick() {
      // Check if click is on a menu item
      const itemHeight = this.tileSize * 1.5;
      const startY = this.menuY + this.tileSize * 1.5;
      
      for (let i = 0; i < this.menuItems.length; i++) {
        const itemY = startY + (i * itemHeight);
        const itemX = this.menuX + this.tileSize;
        
        if (this.mouseX >= itemX && 
            this.mouseX <= itemX + this.menuWidth - this.tileSize * 2 &&
            this.mouseY >= itemY - this.tileSize / 2 && 
            this.mouseY <= itemY + this.tileSize / 2) {
          this.selectMenuItem();
          break;
        }
      }
    }
    
  show() {
    this.isVisible = true;
    this.selectedIndex = 0;
    events.emit("MENU_OPEN");

    //TODO Hide remote players
  }

  hide() {
    this.isVisible = false;
    events.emit("MENU_CLOSE");

    // Show remote players again
  }
    
    selectMenuItem() {
      const selectedItem = this.menuItems[this.selectedIndex];
      
      switch(selectedItem) {
        case "PLAYERS":
          this.hide();
          this.interfaces.players.open();
          break;
        case "PROFILE":
          console.log("Profile selected - not implemented yet");
          break;
        case "OPTIONS":
          console.log("Options selected - not implemented yet");
          break;
        case "EXIT":
          console.log("Exit selected");
          this.hide();
          break;
      }
    }
    
    step(delta, root) {
      // Toggle menu with Enter key
      if (root.input.getActionJustPressed("Enter")) {
        if (this.isVisible) {
          this.hide();
        } else {
          this.show();
        }
      }
      
      // Handle menu navigation when visible
      if (this.isVisible) {
        // Keyboard navigation
        if (root.input.getActionJustPressed("ArrowUp")) {
          this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
        }
        if (root.input.getActionJustPressed("ArrowDown")) {
          this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
        }
        
        // Select item with Space or Enter
        if (root.input.getActionJustPressed("Space") || 
            (root.input.getActionJustPressed("Enter") && this.isVisible)) {
          this.selectMenuItem();
        }
        
        // Close menu with Escape
        if (root.input.getActionJustPressed("Escape")) {
          this.hide();
        }
      }
      
      // Update interfaces
      Object.values(this.interfaces).forEach(interfaceObj => {
          interfaceObj.step(delta, root);
      });
    }
    
    draw(ctx, x, y) {
      // Draw interfaces first (they might be fullscreen)
        Object.values(this.interfaces).forEach(interfaceObj => {
            interfaceObj.draw(ctx, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
      });
      
      // Draw menu if visible
      if (!this.isVisible) return;
      
      // Save context state
      ctx.save();
      
      // Draw menu backdrop
      this.backdrop.draw(ctx, this.menuX
        , this.menuY-5);
      
      // Draw menu items
      ctx.font = "12px fontRetroGaming";
      
      const itemHeight = this.tileSize * 1.5;
      const startY = this.menuY + this.tileSize * 1.5;
      
      this.menuItems.forEach((item, index) => {
        const itemY = startY + (index * itemHeight);
        const itemX = this.menuX + this.tileSize * 2;
        
        // Highlight selected item
        if (index === this.selectedIndex) {
          // Draw selection indicator
          ctx.fillStyle = "#FFD700";
          ctx.fillText("►", this.menuX + this.tileSize, itemY);
          
          ctx.fillStyle = "#FFF";
        } else {
          ctx.fillStyle = "#CCC";
        }
        
        // Draw menu text
        ctx.fillText(item, itemX, itemY);
      });
      
      // Restore context state
      ctx.restore();
    }
  }
  
  // Usage in your main game class:
  // Initialize the menu in your game's constructor
  // this.menu = new Menu({ multiplayerManager: this.multiplayerManager });
  // this.children.push(this.menu);
  
  // Make sure to add the menu resources to your resource loader:
  // resources.images.menuBox = new Resource({ ... });
  // resources.images.interfaceBox = new Resource({ ... });