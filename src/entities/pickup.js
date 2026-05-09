import { CONFIG } from "../config.js";
import { dist2, lerp } from "../utils.js";

export class XpPickup {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.r = 8 + Math.min(8, value);
    this.life = 12;
    this.dead = false;
    this.t = Math.random() * 10;
  }

  update(dt, game) {
    this.life -= dt;
    this.t += dt;
    const p = game.player;
    const magnet = 88 + p.magnet * 48;
    const d = Math.sqrt(dist2(this.x, this.y, p.x, p.y));
    if (d < magnet) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const s = lerp(120, 620, 1 - d / magnet);
      this.x += Math.cos(a) * s * dt;
      this.y += Math.sin(a) * s * dt;
    } else {
      this.y += Math.sin(this.t * 2) * 7 * dt;
    }
    if (d < p.r + this.r) {
      game.gainXp(this.value);
      game.burst(this.x, this.y, CONFIG.colors.green, 8);
      this.dead = true;
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(this.t * 8) * 0.12;
    ctx.fillStyle = CONFIG.colors.green;
    ctx.shadowColor = CONFIG.colors.green;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-2, -3, this.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
