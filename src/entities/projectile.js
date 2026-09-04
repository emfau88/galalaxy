import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";
import { ENEMY_WEAPON_PROFILES, PROJECTILE_VISUALS } from "../data/projectiles.js";

export class Projectile {
  constructor(x, y, a, speed, dmg, owner, kind, visualKey = null, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.dmg = dmg;
    this.owner = owner;
    this.kind = kind;
    this.visualKey = visualKey || (owner === "player" ? kind : "klaedNormal");
    this.weaponProfile = owner === "enemy" ? ENEMY_WEAPON_PROFILES[this.visualKey] : null;
    this.r = options.hitRadius ?? this.weaponProfile?.hitRadius ?? (kind === "rocket" ? 6 : kind === "enemy" ? 5 : 4);
    this.hitWidth = options.hitWidth ?? this.weaponProfile?.hitWidth ?? null;
    this.hitHeight = options.hitHeight ?? this.weaponProfile?.hitHeight ?? null;
    this.life = options.life ?? this.weaponProfile?.life ?? (kind === "rocket" ? 1.9 : (kind === "enemy" && owner === "enemy") ? 2.6 : 1.25);
    this.target = options.target || null;
    this.turnRate = options.turnRate || 0;
    this.piercing = options.piercing || false;
    this.hitTargets = new Set();
    this.onHit = typeof options.onHit === "function" ? options.onHit : null;
    this.age = 0;
    this.dead = false;
  }

  update(dt, game) {
    this.age += dt;

    if (this.kind === "rocket" && this.owner === "player") {
      const t = game.closestEnemy(this.x, this.y, 220);
      if (t) {
        this._steerToward(t.x, t.y, 3.4, dt);
      }
    } else if (this.kind === "zapper" && this.owner === "player") {
      if (!this.target || this.target.dead) this.target = game.closestEnemy(this.x, this.y, 360);
      if (this.target) this._steerToward(this.target.x, this.target.y, this.turnRate || 8, dt);
    } else if (this.owner === "enemy" && this.weaponProfile?.behavior === "homing" &&
      (this.weaponProfile.homingDuration === undefined || this.age <= this.weaponProfile.homingDuration)) {
      const p = game.player;
      this._steerToward(p.x, p.y, this.weaponProfile.turnRate ?? 0.5, dt);
    }

    if (this.weaponProfile?.acceleration) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0) {
        const nextSpeed = speed + this.weaponProfile.acceleration * dt;
        const mult = nextSpeed / speed;
        this.vx *= mult;
        this.vy *= mult;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -70 || this.x > CONFIG.designW + 70 || this.y < -80 || this.y > CONFIG.designH + 80) {
      this.dead = true;
    }
  }

  _steerToward(x, y, turnRate, dt) {
    const desired = Math.atan2(y - this.y, x - this.x);
    const current = Math.atan2(this.vy, this.vx);
    let delta = desired - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const nextAngle = current + clamp(delta, -dt * turnRate, dt * turnRate);
    const speed = Math.hypot(this.vx, this.vy);
    this.vx = Math.cos(nextAngle) * speed;
    this.vy = Math.sin(nextAngle) * speed;
  }

  hitsCircle(x, y, radius) {
    if (!this.hitWidth || !this.hitHeight) {
      const dx = this.x - x, dy = this.y - y;
      return dx * dx + dy * dy < (this.r + radius) ** 2;
    }
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const dirX = this.vx / speed, dirY = this.vy / speed;
    const dx = x - this.x, dy = y - this.y;
    const forward = dx * dirX + dy * dirY;
    const lateral = -dx * dirY + dy * dirX;
    return Math.abs(lateral) < this.hitWidth / 2 + radius &&
      Math.abs(forward) < this.hitHeight / 2 + radius;
  }

  _drawAssetFrame(ctx, img, vis) {
    const imageW = img.naturalWidth || img.width;
    const imageH = img.naturalHeight || img.height;
    const frameW = vis.frameW || imageW;
    const frameH = vis.frameH || imageH;
    if (!imageW || !imageH || !frameW || !frameH) return false;

    const availableFrames = Math.max(1, Math.floor(imageW / frameW));
    const frameCount = Math.min(vis.frameCount || 1, availableFrames);
    const frameIndex = frameCount > 1
      ? Math.floor(this.age * (vis.fps || 12)) % frameCount
      : 0;
    const scale = Math.min(vis.w / frameW, vis.h / frameH);
    const drawW = frameW * scale * (vis.scaleX || 1);
    const drawH = frameH * scale * (vis.scaleY || 1);
    ctx.drawImage(
      img,
      frameIndex * frameW, 0, frameW, frameH,
      -drawW / 2, -drawH / 2, drawW, drawH
    );
    return true;
  }

  draw(ctx, game) {
    const vis = PROJECTILE_VISUALS[this.visualKey];
    const angle = Math.atan2(this.vy, this.vx);
    const glow = amount => game.lowEffects ? 0 : amount;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle + (vis ? vis.rotOffset : 0));

    if (vis && vis.assetKey) {
      const img = game.loader.get(vis.assetKey);
      if (img) {
        // Preserve the authored palette. Additive blending washed the Foozle
        // sprites toward white and made different projectile families converge.
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.shadowColor = vis.glowColor;
        ctx.shadowBlur = glow(7);
        if (this._drawAssetFrame(ctx, img, vis)) {
          ctx.restore();
          return;
        }
      }
    }

    // Canvas fallback
    ctx.globalCompositeOperation = "lighter";
    if (this.owner === "player") {
      if (this.kind === "rocket") {
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = glow(16);
        ctx.beginPath();
        ctx.roundRect(-10, -3.5, 22, 7, 4);
        ctx.fill();
        ctx.fillStyle = "#fff8e0";
        ctx.shadowBlur = glow(6);
        ctx.beginPath();
        ctx.roundRect(-6, -1.5, 10, 3, 2);
        ctx.fill();
      } else {
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = glow(16);
        ctx.beginPath();
        ctx.roundRect(-9, -3.5, 18, 7, 4);
        ctx.fill();
        ctx.fillStyle = "#e8ffff";
        ctx.shadowBlur = glow(4);
        ctx.beginPath();
        ctx.roundRect(-7, -1.5, 12, 3, 2);
        ctx.fill();
      }
    } else {
      const col = vis ? vis.color : CONFIG.colors.red;
      const glowColor = vis ? vis.glowColor : "#ff2040";
      ctx.fillStyle = col;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = glow(18);
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffaaaa";
      ctx.shadowBlur = glow(6);
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
