import { CONFIG } from "./config.js";

export class Input {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.active = false;
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.worldX = 0;
    this.worldY = 0;
    this.justTapped = false;
    this.tapX = 0;
    this.tapY = 0;

    const down = e => {
      e.preventDefault();
      const p = this.getPoint(e);
      this.active = true;
      this.pointerId = e.pointerId ?? 1;
      this.x = p.x;
      this.y = p.y;
      this.worldX = p.wx;
      this.worldY = p.wy;
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
