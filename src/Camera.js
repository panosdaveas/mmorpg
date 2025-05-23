import { GameObject } from "./GameObject.js";
import { events } from "./Events.js";
import { Vector2 } from "./Vector2.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE } from "./constants/worldConstants.js";

export class Camera extends GameObject {
  constructor(deadZoneOptions = {}) {
    super({});

    // Default dead zone settings
    this.deadZone = {
      enabled: deadZoneOptions.enabled ?? true,
      width: deadZoneOptions.width ?? TILE_SIZE * 3, // 3 tiles (assuming 16px tiles)
      height: deadZoneOptions.height ?? TILE_SIZE * 3 // 3 tiles
    };

    // Store the target position and the last position we centered on
    this.targetPosition = null;
    this.lastCenteredPosition = null;
    this.mapPixelWidth = null;
    this.mapPixelHeight = null;
    
    events.on("HERO_POSITION", this, heroPosition => {
      this.updateCameraPosition(heroPosition);
    });

    // Camera knows when a new level starts
    events.on("CHANGE_LEVEL", this, (newMap) => {
      // On level change, immediately center on hero without using dead zone
      this.lastCenteredPosition = null; // Reset last position
      this.targetPosition = newMap.heroStartPosition;
      this.centerPositionOnTarget(this.targetPosition);
    });

    events.on("SET_CAMERA_MAP_BOUNDS", this, bounds => {
      this.mapPixelWidth = bounds.width;
      this.mapPixelHeight = bounds.height;
    });
  }

  updateCameraPosition(targetPosition) {
    this.targetPosition = targetPosition;

    // If there's no last centered position yet, center immediately
    if (!this.lastCenteredPosition) {
      this.centerPositionOnTarget(targetPosition);
      this.lastCenteredPosition = new Vector2(targetPosition.x, targetPosition.y);
      return;
    }

    // Check if target has moved outside of the dead zone
    if (this.deadZone.enabled && this.isOutsideDeadZone(targetPosition)) {
      this.calculateNewCameraPosition(targetPosition);
    }
  }

  isOutsideDeadZone(targetPosition) {
    const deltaX = Math.abs(targetPosition.x - this.lastCenteredPosition.x);
    const deltaY = Math.abs(targetPosition.y - this.lastCenteredPosition.y);

    return deltaX > this.deadZone.width / 2 || deltaY > this.deadZone.height / 2;
  }

  calculateNewCameraPosition(targetPosition) {
    // Calculate how far the target has moved outside the dead zone
    const dx = targetPosition.x - this.lastCenteredPosition.x;
    const dy = targetPosition.y - this.lastCenteredPosition.y;

    // Calculate the amount to move the camera
    let moveX = 0;
    let moveY = 0;

    if (Math.abs(dx) > this.deadZone.width / 2) {
      // Move camera by the amount that exceeds the dead zone
      moveX = dx > 0 ?
        dx - this.deadZone.width / 2 :
        dx + this.deadZone.width / 2;
    }

    if (Math.abs(dy) > this.deadZone.height / 2) {
      // Move camera by the amount that exceeds the dead zone
      moveY = dy > 0 ?
        dy - this.deadZone.height / 2 :
        dy + this.deadZone.height / 2;
    }

    // Update last centered position
    this.lastCenteredPosition.x += moveX;
    this.lastCenteredPosition.y += moveY;

    // Center on the new position
    this.centerPositionOnTarget(this.lastCenteredPosition);
  }

  centerPositionOnTarget(pos) {
    const personHalf = 8;
    const canvasWidth = CANVAS_WIDTH;
    const canvasHeight = CANVAS_HEIGHT;

    const halfWidth = -personHalf + canvasWidth / 2;
    const halfHeight = -personHalf + canvasHeight / 2;

    // Initial camera position centered on hero
    let x = -pos.x + halfWidth;
    let y = -pos.y + halfHeight;

    // Clamp the camera position so it stays inside map bounds
    if (this.mapPixelWidth && this.mapPixelHeight) {
      const minX = canvasWidth - this.mapPixelWidth;
      const minY = canvasHeight - this.mapPixelHeight;

      x = Math.max(minX, Math.min(x, 0));
      y = Math.max(minY, Math.min(y, 0));
    }

    this.position = new Vector2(x, y);
  }

  // Method to enable/disable or adjust the dead zone
  setDeadZone(options = {}) {
    if (options.enabled !== undefined) this.deadZone.enabled = options.enabled;
    if (options.width !== undefined) this.deadZone.width = options.width;
    if (options.height !== undefined) this.deadZone.height = options.height;

    // Reset center position to force camera update
    if (this.targetPosition) {
      this.lastCenteredPosition = null;
      this.updateCameraPosition(this.targetPosition);
    }
  }
}