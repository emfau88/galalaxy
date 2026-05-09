import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";
import { PROJECTILE_VISUALS } from "../data/projectiles.js";

export class Projectile {
  constructor(x, y, a, speed, dmg, owner, kind, visualKey = null) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.dmg = dmg;
    this.owner = owner;
    this.kind = kind;
    this.visualKey = visualKey || (owner === "player" ? kind : "klaedNormal");
    this.r = kind === "rocket" ? 6 : kind === "enemy" ? 5 : 4;
    this.life = kind === "rocket" ? 1.9 : (kind === "enemy" && owner === "enemy") ? 2.6 : 1.25;
    this.dead = false;
  }

  update(dt, game) {
    if (this.kind === "rocket" && this.owner === "player") {
      const t = game.closestEnemy(this.x, this.y, 220);
      if (t) {
        const desired = Math.atan2(t.y - this.y, t.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let d = desired - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + clamp(d, -dt * 3.4, dt * 3.4);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -70 || this.x > CONFIG.designW + 70 || this.y < -80 || this.y > CONFIG.designH + 80) {
      this.dead = true;
    }
  }

  draw(ctx, game) {
    const vis = PROJECTILE_VISUALS[this.visualKey];
    const angle = Math.atan2(this.vy, this.vx);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle + (vis ? vis.rotOffset : 0));

    if (vis && vis.assetKey) {
      const img = game.loader.get(vis.assetKey);
      if (img) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.92;
        game.drawAsset(ctx, img, 0, 0, vis.w, vis.h);
        ctx.restore();
        return;
      }
    }

    // Canvas fallback
    ctx.globalCompositeOperation = "lighter";
    if (this.owner === "player") {
      if (this.kind === "rocket") {
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(-10, -3.5, 22, 7, 4);
        ctx.fill();
        ctx.fillStyle = "#fff8e0";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(-6, -1.5, 10, 3, 2);
        ctx.fill();
      } else {
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(-9, -3.5, 18, 7, 4);
        ctx.fill();
        ctx.fillStyle = "#e8ffff";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(-7, -1.5, 12, 3, 2);
        ctx.fill();
      }
    } else {
      const col = vis ? vis.color : CONFIG.colors.red;
      const glow = vis ? vis.glowColor : "#ff2040";
      ctx.fillStyle = col;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffaaaa";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
