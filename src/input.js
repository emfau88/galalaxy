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
      this.game.activateAudio();
      const p = this.getPoint(e);
      // Fullscreen APIs require the request to be made inside the original
      // user gesture. Unlike ordinary game taps, this cannot wait until the
      // next animation frame where consumeTap() is processed.
      const fullscreenZone = this.game._fullscreenBtnZone;
      if (this.game.fullscreenAvailable && fullscreenZone &&
          p.wx >= fullscreenZone.x && p.wx <= fullscreenZone.x + fullscreenZone.w &&
          p.wy >= fullscreenZone.y && p.wy <= fullscreenZone.y + fullscreenZone.h) {
        this.cancelMovement();
        this.game.toggleFullscreen();
        return;
      }
      // Upgrade cards are a modal UI: their tap must never become a ship
      // destination. This avoids a one-frame jump toward the selected card
      // when the game resumes immediately after the pick.
      if (this.game.state === "levelUp") {
        this.cancelMovement();
        this.justTapped = true;
        this.tapX = p.wx;
        this.tapY = p.wy;
        return;
      }
      if (this.game.state === "paused") {
        this.cancelMovement();
        this.justTapped = true;
        this.tapX = p.wx;
        this.tapY = p.wy;
        return;
      }
      // A second finger must never steal steering from the active pointer.
      // Utility zones remain available as tap-only controls while dragging.
      const isUtilityTap = this.exclusionZones.some(z =>
        p.wx >= z.x && p.wx <= z.x + z.w && p.wy >= z.y && p.wy <= z.y + z.h
      );
      if (this.active && e.pointerId !== this.pointerId && !isUtilityTap) return;
      // If tap lands inside a registered exclusion zone, fire as tap-only — no ship movement.
      if (isUtilityTap) {
        this.justTapped = true;
        this.tapX = p.wx;
        this.tapY = p.wy;
        return; // do NOT set active or update worldX/Y
      }
      this.active = true;
      this.pointerId = e.pointerId ?? 1;
      try { canvas.setPointerCapture?.(this.pointerId); } catch {}
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
      if (!this.active || e.pointerId !== this.pointerId || this.game.state !== "playing") return;
      e.preventDefault();
      const p = this.getPoint(e);
      this.x = p.x;
      this.y = p.y;
      this.worldX = p.wx;
      this.worldY = p.wy;
      this._applyOffset();
    };

    const up = e => {
      if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
      e.preventDefault();
      if (this.pointerId !== null) {
        try { canvas.releasePointerCapture?.(this.pointerId); } catch {}
      }
      this.active = false;
      this.pointerId = null;
    };

    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up, { passive: false });
    canvas.addEventListener("pointercancel", up, { passive: false });

    window.addEventListener("keydown", e => {
      if (e.repeat) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.game.activateAudio();
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

  cancelMovement() {
    if (this.pointerId !== null) {
      try { this.canvas.releasePointerCapture?.(this.pointerId); } catch {}
    }
    this.active = false;
    this.pointerId = null;
    this.isTouch = false;
    this.justTapped = false;
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
