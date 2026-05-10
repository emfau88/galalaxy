import { CONFIG, CONTROL_CONFIG } from "./config.js";

export class Input {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.active = false;
    this.pointerId = null;
    this.isTouch = false;   // true when the active pointer is touch/pen
    this.x = 0;
    this.y = 0;
    this.worldX = CONFIG.designW / 2; // start centered so title ship has no initial tilt
    this.worldY = CONFIG.designH / 2;
    this.shipX = 0;         // offset-adjusted target for the ship
    this.shipY = 0;
    this.justTapped = false;
    this.tapX = 0;
    this.tapY = 0;
    this.exclusionZones = []; // { x, y, w, h } in design-space — taps here skip ship movement

    const down = e => {
      e.preventDefault();
      const p = this.getPoint(e);
      // If tap lands inside a registered exclusion zone, fire as tap-only — no ship movement.
      if (this.exclusionZones.some(z =>
        p.wx >= z.x && p.wx <= z.x + z.w && p.wy >= z.y && p.wy <= z.y + z.h
      )) {
        this.justTapped = true;
        this.tapX = p.wx;
        this.tapY = p.wy;
        return; // do NOT set active or update worldX/Y
      }
      this.active = true;
      this.pointerId = e.pointerId ?? 1;
      this.isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      this.x = p.x;
      this.y = p.y;
      this.worldX = p.wx;
      this.worldY = p.wy;
      this._applyOffset();
      this.justTapped = true;
      this.tapX = p.wx;
      this.tapY = p.wy;
    };

    const move = e => {
      if (!this.active) return;
      e.preventDefault();
      const p = this.getPoint(e);
      this.x = p.x;
      this.y = p.y;
      this.worldX = p.wx;
      this.worldY = p.wy;
      this._applyOffset();
    };

    const up = e => {
      e.preventDefault();
      this.active = false;
      this.pointerId = null;
    };

    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up, { passive: false });
    canvas.addEventListener("pointercancel", up, { passive: false });

    window.addEventListener("keydown", e => {
      if (e.key === " " || e.key === "Enter") {
        this.justTapped = true;
        this.tapX = CONFIG.designW / 2;
        this.tapY = CONFIG.designH / 2;
      }
      if (e.key.toLowerCase() === "p") game.togglePause();
    });
  }

  _applyOffset() {
    const ox = this.isTouch ? CONTROL_CONFIG.touchOffsetX : 0;
    const oy = this.isTouch ? CONTROL_CONFIG.touchOffsetY : CONTROL_CONFIG.mouseOffsetY;
    // Clamp so ship stays within the same play-area bounds player.update enforces (36, 88 … W-36, H-38)
    this.shipX = Math.max(36, Math.min(CONFIG.designW - 36, this.worldX + ox));
    this.shipY = Math.max(88, Math.min(CONFIG.designH - 38, this.worldY - oy));
  }

  getPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    return {
      x,
      y,
      wx: (x - this.game.offsetX) / this.game.scale,
      wy: (y - this.game.offsetY) / this.game.scale
    };
  }

  consumeTap() {
    if (!this.justTapped) return null;
    this.justTapped = false;
    return { x: this.tapX, y: this.tapY };
  }
}
