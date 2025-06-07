import { MOVING_THRESHOLD } from "./constants/worldConstants"

export const LEFT = "LEFT"
export const RIGHT = "RIGHT"
export const UP = "UP"
export const DOWN = "DOWN"

export class Input {
  constructor() {
    this.heldDirections = [];
    this.keys = {};
    this.lastKeys = {};

    // 🚨 NEW: Track timing for Pokemon-style movement
    this.directionTimings = new Map(); // direction -> timestamp when started
    this.movementThreshold = MOVING_THRESHOLD; // ms - threshold for movement vs facing

    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      // Check for dedicated direction list
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        this.onArrowPressed(UP);
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        this.onArrowPressed(DOWN);
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        this.onArrowPressed(LEFT);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        this.onArrowPressed(RIGHT);
      }
    })

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;

      // Check for dedicated direction list
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        this.onArrowReleased(UP);
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        this.onArrowReleased(DOWN);
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        this.onArrowReleased(LEFT);
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        this.onArrowReleased(RIGHT);
      }
    })
  }

  // 🚨 NEW: Get the current direction for facing (immediate)
  get facingDirection() {
    return this.heldDirections[0];
  }

  // 🚨 NEW: Get direction for movement (only after threshold)
  get movementDirection() {
    const currentDirection = this.heldDirections[0];
    if (!currentDirection) return null;

    const startTime = this.directionTimings.get(currentDirection);
    if (!startTime) return null;

    const holdTime = Date.now() - startTime;
    return holdTime >= this.movementThreshold ? currentDirection : null;
  }

  // 🚨 NEW: Check if direction was just pressed (for immediate facing)
  isDirectionJustPressed(direction) {
    if (!this.directionTimings.has(direction)) return false;

    const startTime = this.directionTimings.get(direction);
    const holdTime = Date.now() - startTime;
    return holdTime < 16; // Within one frame (assuming 60fps)
  }

  // 🚨 NEW: Check if direction just became eligible for movement
  isDirectionReadyForMovement(direction) {
    if (!this.directionTimings.has(direction)) return false;

    const startTime = this.directionTimings.get(direction);
    const holdTime = Date.now() - startTime;

    // Check if we just crossed the threshold
    return holdTime >= this.movementThreshold &&
      holdTime < this.movementThreshold + 16; // Within one frame of crossing
  }

  update() {
    // Diff the keys on previous frame to know when new ones are pressed
    this.lastKeys = { ...this.keys };
  }

  getActionJustPressed(keyCode) {
    let justPressed = false;
    if (this.keys[keyCode] && !this.lastKeys[keyCode]) {
      justPressed = true;
    }
    return justPressed;
  }

  onArrowPressed(direction) {
    // Add this arrow to the queue if it's new
    if (this.heldDirections.indexOf(direction) === -1) {
      this.heldDirections.unshift(direction);

      // 🚨 NEW: Record when this direction started being held
      this.directionTimings.set(direction, Date.now());
    }
  }

  onArrowReleased(direction) {
    const index = this.heldDirections.indexOf(direction);
    if (index === -1) {
      return;
    }

    // Remove this key from the list
    this.heldDirections.splice(index, 1);

    // 🚨 NEW: Remove timing record
    this.directionTimings.delete(direction);
  }

  reset() {
    // Clear all held directions and keys
    this.heldDirections = [];
    this.keys = {};
    this.lastKeys = {};
    this.directionTimings.clear(); // 🚨 NEW: Clear timings
  }
}
