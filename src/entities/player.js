import { CONFIG, RENDER_CONFIG } from "../config.js";
import { clamp, lerp } from "../utils.js";
import { updateBeam, updatePulse } from "../systems/abilities.js";

export class Player {
  constructor(game) {
    this.game = game;
    this.x = CONFIG.designW / 2;
    this.y = CONFIG.designH - 135;
    this.vx = 0;
    this.vy = 0;
    this.r = CONFIG.playerRadius;
    this.maxHp = 100;
    this.hp = 100;
    this.maxShield = 55;
    this.shield = 35;
    this.speed = 360;
    this.fireRate = 0.28;
    this.fireTimer = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.twin = 0;
    this.rocket = 0;
    this.zapper = 0;
    this.magnet = 0;
    this.shieldRegen = 2.2;
    this.bank = 0;
    // Signature abilities (0 = not unlocked)
    this.beam    = 0;
    this.pulse   = 0;
    this.barrage = 0;
  }

  update(dt) {
    const input = this.game.input;
    let tx = this.x;
    let ty = this.y;

    if (input.active && this.game.state === "playing") {
      tx = input.shipX;
      ty = input.shipY;
    }

    const oldX = this.x;
    this.x = lerp(this.x, tx, clamp(dt * 12, 0, 1));
    this.y = lerp(this.y, ty, clamp(dt * 12, 0, 1));
    this.vx = (this.x - oldX) / Math.max(dt, 0.001);
    this.bank = lerp(this.bank, clamp(this.vx / 520, -0.35, 0.35), clamp(dt * 9, 0, 1));

    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shield = clamp(this.shield + this.shieldRegen * dt, 0, this.maxShield);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireRate;
      this.fire();
    }

    updateBeam(this, dt);
    updatePulse(this, dt);
  }

  fire() {
    const g = this.game;
    const shots = this.twin > 0 ? [-9, 9] : [0];
    for (const off of shots) {
      g.spawnProjectile(this.x + off, this.y - 28, -Math.PI / 2, 640, 11 + this.twin * 1.5, "player", "laser");
    }

    if (this.rocket > 0) {
      const rocketChance = 0.18 + this.rocket * 0.04;
      if (Math.random() < rocketChance) {
        const count = this.barrage > 0 ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const delay = i * 0.07; // stagger rockets slightly via offset spawn position
          const ox = (i - (count - 1) / 2) * 9;
          const target = g.closestEnemy(this.x + ox, this.y, 420);
          const ang = target ? Math.atan2(target.y - this.y, target.x - this.x) + (i - 1) * 0.08 : -Math.PI / 2 + (i - 1) * 0.08;
          g.spawnProjectile(this.x + ox, this.y - 25, ang, 420 + i * 12, 22 + this.rocket * 4 + this.barrage * 5, "player", "rocket");
        }
      }
    }

    if (this.zapper > 0 && Math.random() < 0.11 + this.zapper * 0.025) {
      const target = g.closestEnemy(this.x, this.y, 300);
      if (target) {
        target.damage(12 + this.zapper * 5);
        g.spawnZap(this.x, this.y - 10, target.x, target.y);
      }
    }
  }

  damage(amount) {
    if (this.invuln > 0) return;
    let left = amount;
    if (this.shield > 0) {
      const used = Math.min(this.shield, left);
      this.shield -= used;
      left -= used;
    }
    this.hp -= left;
    this.hitFlash = 0.14;
    this.invuln = 0.28;
    this.game.shake = Math.max(this.game.shake, 4);
    this.game.burst(this.x, this.y, left > 0 ? CONFIG.colors.red : CONFIG.colors.cyan, 14);
    if (this.hp <= 0) this.game.endRun();
  }

  damageSprite() {
    const t = this.hp / this.maxHp;
    if (t > 0.72) return "playerFull";
    if (t > 0.44) return "playerSlight";
    if (t > 0.18) return "playerDamaged";
    return "playerVeryDamaged";
  }

  draw(ctx, img) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);

    // Engine flame — reacts to speed and pulses with fire timer
    const speed = Math.hypot(this.vx, this.vy);
    const speedBoost = clamp(speed / 320, 0, 1);
    const firePulse = clamp(1 - this.fireTimer / this.fireRate, 0, 1) * 0.22;
    const flame = 0.78 + Math.sin(this.game.time * 24) * 0.16 + speedBoost * 0.28 + firePulse;

    // Primary thruster cone
    ctx.globalAlpha = 0.78 + speedBoost * 0.14;
    const grad = ctx.createRadialGradient(0, 28, 1, 0, 40 + speedBoost * 10, 26 + speedBoost * 8);
    grad.addColorStop(0, "rgba(140,240,255,1)");
    grad.addColorStop(0.38, "rgba(54,140,255,0.65)");
    grad.addColorStop(1, "rgba(30,80,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 33 + speedBoost * 4, 12 * flame, 24 * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary wider glow — grows with movement
    ctx.globalAlpha = 0.22 + speedBoost * 0.14;
    const grad2 = ctx.createRadialGradient(0, 36, 1, 0, 52, 40);
    grad2.addColorStop(0, "rgba(88,200,255,0.85)");
    grad2.addColorStop(1, "rgba(30,80,255,0)");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.ellipse(0, 38, (20 + speedBoost * 7) * flame, (36 + speedBoost * 10) * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine overlay — 48×48 single frame, safe to draw
    const engine = img.get("playerEngine");
    ctx.globalAlpha = 0.7;
    if (engine) this.game.drawAsset(ctx, engine, 0, 20, RENDER_CONFIG.playerEngine.w, RENDER_CONFIG.playerEngine.h);

    // Weapon canvas icon — drawn behind ship body
    ctx.globalAlpha = 0.88;
    if (this.rocket > 0) {
      this.game.drawWeaponIcon(ctx, "rocket", 0, -18);
    } else if (this.zapper > 0) {
      this.game.drawWeaponIcon(ctx, "zapper", 0, -18);
    } else {
      this.game.drawWeaponIcon(ctx, "auto", 0, -18);
    }

    // Ship body
    const ship = img.get(this.damageSprite());
    ctx.globalAlpha = 1;
    if (ship) this.game.drawAsset(ctx, ship, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);
    else this.game.drawFallbackShip(ctx, 0, 0, 1);

    // Shield ring — canvas drawn, no strip needed
    if (this.shield > 4) {
      const shieldFrac = this.shield / this.maxShield;
      const pulse = Math.sin(this.game.time * 5);
      ctx.globalAlpha = (0.18 + 0.1 * pulse) * shieldFrac;
      ctx.strokeStyle = CONFIG.colors.cyan;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.stroke();
      // Subtle fill tint
      ctx.globalAlpha = 0.04 * shieldFrac;
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.hitFlash / 0.14;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
