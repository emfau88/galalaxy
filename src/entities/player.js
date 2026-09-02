import { CONFIG, RENDER_CONFIG } from "../config.js";
import { clamp, lerp } from "../utils.js";
import { updateBeam, updatePulse } from "../systems/abilities.js";

// Branch accent colors
const BRANCH_COLORS = {
  assault: { primary: "#c8d8ff", engine: "rgba(180,200,255,1)", glow: "#aabbff" },
  energy:  { primary: "#88aaff", engine: "rgba(120,160,255,1)", glow: "#88ccff" },
  siege:   { primary: "#ffb060", engine: "rgba(255,160,60,1)",  glow: "#ffaa40" },
};

const SHIP_TIER_SCALE = [0, 1, 1.06, 1.12, 1.18];

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
    this.fireLevel = 0;
    this.fireTimer = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.twin = 0;
    this.rocket = 0;
    this.zapper = 0;
    this.magnet = 0;
    this.shieldRegen = 2.2;
    this.speedLevel = 0;
    this.shieldLevel = 0;
    this.hpLevel = 0;
    this.bank = 0;
    // Signature abilities (0 = not unlocked)
    this.beam    = 0;
    this.pulse   = 0;
    this.barrage = 0;
    // Keystone state (at most one per run)
    this.keystoneId    = null;
    this.rocketDisabled = false;
    this.siegePayload  = false;
    this.pulseReactor  = false;
  }

  // Returns 1–4 based on current sector
  shipTier() {
    return Math.min(4, this.game.currentSectorIndex + 1);
  }

  shipVisualScale() {
    return SHIP_TIER_SCALE[this.shipTier()] || 1;
  }

  // Movement responsiveness bonus by tier (total, not per-frame stack).
  // T1: ×1.00, T2: ×1.05, T3: ×1.08, T4: ×1.10
  getEvolutionMoveMultiplier() {
    const t = this.shipTier();
    if (t >= 4) return 1.10;
    if (t >= 3) return 1.08;
    if (t >= 2) return 1.05;
    return 1.0;
  }

  // Auto-fire efficiency bonus by tier (multiplier < 1 means faster firing).
  // T1: ×1.00, T2: ×0.94, T3: ×0.90, T4: ×0.86
  getEvolutionFireRateMultiplier() {
    const t = this.shipTier();
    if (t >= 4) return 0.86;
    if (t >= 3) return 0.90;
    if (t >= 2) return 0.94;
    return 1.0;
  }

  // Returns "assault"|"energy"|"siege" based on build affinity
  shipBranch() {
    const zapScore    = this.zapper + this.beam * 2;
    const rocketScore = this.rocket + this.barrage * 2;
    const pulseScore  = this.pulse * 2;
    const max = Math.max(zapScore, rocketScore, pulseScore);
    if (max < 2) return "assault"; // default until a branch is established
    if (pulseScore >= max)  return "energy";
    if (rocketScore >= max) return "siege";
    return "energy"; // zapper/beam → energy frame
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
    // speed 360 (base) → followRate 12. Evolution adds a small tier bonus on top.
    const followRate = clamp(12 * (this.speed / 360) * this.getEvolutionMoveMultiplier(), 8, 18);
    this.x = lerp(this.x, tx, clamp(dt * followRate, 0, 1));
    this.y = lerp(this.y, ty, clamp(dt * followRate, 0, 1));
    this.vx = (this.x - oldX) / Math.max(dt, 0.001);
    this.bank = lerp(this.bank, clamp(this.vx / 520, -0.35, 0.35), clamp(dt * 9, 0, 1));

    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shield = clamp(this.shield + this.shieldRegen * dt, 0, this.maxShield);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      // Evolution multiplier < 1 means faster effective fire rate; does not mutate base fireRate.
      this.fireTimer = this.fireRate * this.getEvolutionFireRateMultiplier();
      this.fire();
    }

    updateBeam(this, dt);
    updatePulse(this, dt);
  }

  fire() {
    const g = this.game;
    const visualScale = this.shipVisualScale();
    // twin 0: single center | 1: two barrels | 2: three | 3: four | 4: five
    const twinOffsets = [
      [0],
      [-10, 10],
      [-12, 0, 12],
      [-16, -5, 5, 16],
      [-18, -9, 0, 9, 18],
    ];
    const shots = twinOffsets[Math.min(this.twin, 4)];
    const twinDmg = 11 + this.twin * 1.5;
    for (const off of shots) {
      g.spawnProjectile(this.x + off * visualScale, this.y - 28 * visualScale, -Math.PI / 2, 640, twinDmg, "player", "laser");
    }

    if (this.rocket > 0 && !this.rocketDisabled) {
      const rocketChance = 0.18 + this.rocket * 0.04;
      if (Math.random() < rocketChance) {
        const count = this.barrage > 0 ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const ox = (i - (count - 1) / 2) * 9;
          const target = g.closestEnemy(this.x + ox, this.y, 420);
          const ang = target ? Math.atan2(target.y - this.y, target.x - this.x) + (i - 1) * 0.08 : -Math.PI / 2 + (i - 1) * 0.08;
          const dmgMult = this.siegePayload ? 2.5 : 1;
          g.spawnProjectile(this.x + ox * visualScale, this.y - 25 * visualScale, ang, 420 + i * 12, (22 + this.rocket * 4 + this.barrage * 5) * dmgMult, "player", "rocket");
        }
      }
    }

    if (this.zapper > 0) {
      const overcharged = this.keystoneId === "overcharged";
      const chance = overcharged ? 1.0 : 0.15 + this.zapper * 0.025;
      if (Math.random() < chance) {
        // Base 20 dmg: reliably one-shots a scout (hp 18) at zapper level 1.
        // Each extra level adds 5 dmg; fighters (hp 34) die in ~2 zaps at level 1.
        const zapDmg = (20 + this.zapper * 5) * (overcharged ? 2.2 : 1);
        const primary = g.closestEnemy(this.x, this.y, 300);
        if (primary) {
          primary.damage(zapDmg);
          g.spawnZap(this.x, this.y - 10 * visualScale, primary.x, primary.y);
          // Chain from zapper level 2 (was 3); range 200 (was 140) — visibly useful on mobile.
          const chainCount = overcharged ? 2 : (this.zapper >= 2 ? 1 : 0);
          if (chainCount > 0) {
            let last = primary;
            for (let c = 0; c < chainCount; c++) {
              const next = g.closestEnemyExcluding(last.x, last.y, 200, last);
              if (!next) break;
              next.damage(zapDmg * 0.6);
              g.spawnZap(last.x, last.y, next.x, next.y, true);
              last = next;
            }
          }
        }
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

    const tier   = this.shipTier();
    const branch = this.shipBranch();
    const bc     = BRANCH_COLORS[branch];
    const t      = this.game.time;
    const visualScale = this.shipVisualScale();
    ctx.scale(visualScale, visualScale);

    const speed = Math.hypot(this.vx, this.vy);
    const speedBoost = clamp(speed / 320, 0, 1);
    const firePulse  = clamp(1 - this.fireTimer / this.fireRate, 0, 1) * 0.22;
    const flame      = 0.78 + Math.sin(t * 24) * 0.16 + speedBoost * 0.28 + firePulse;

    // === T3/T4: side engine nozzles (drawn first, behind everything) ===
    if (tier >= 3) {
      this._drawSideEngines(ctx, tier, bc, speedBoost, flame, t);
    }

    // === Primary thruster cone ===
    ctx.globalAlpha = 0.78 + speedBoost * 0.14;
    const engineColor = tier >= 2 ? bc.engine : "rgba(140,240,255,1)";
    const grad = ctx.createRadialGradient(0, 28, 1, 0, 40 + speedBoost * 10, 26 + speedBoost * 8);
    grad.addColorStop(0, engineColor);
    grad.addColorStop(0.38, "rgba(54,140,255,0.65)");
    grad.addColorStop(1, "rgba(30,80,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 33 + speedBoost * 4, 12 * flame, 24 * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary wider glow
    ctx.globalAlpha = 0.22 + speedBoost * 0.14;
    const grad2 = ctx.createRadialGradient(0, 36, 1, 0, 52, 40);
    grad2.addColorStop(0, "rgba(88,200,255,0.85)");
    grad2.addColorStop(1, "rgba(30,80,255,0)");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.ellipse(0, 38, (20 + speedBoost * 7) * flame, (36 + speedBoost * 10) * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine module evolves permanently with Engine Boost stacks.
    const engineKeys = ["playerEngine", "playerEnginePulse", "playerEngineBurst", "playerEngineSuper"];
    const engine = img.get(engineKeys[Math.min(3, this.speedLevel)]);
    ctx.globalAlpha = 0.82;
    if (engine) this.game.drawAsset(ctx, engine, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);

    // MK-II+ silhouette extensions sit behind the original hull artwork.
    if (tier >= 2) this._drawEvolutionFrame(ctx, tier, bc);

    // === T3+: side cannon stubs (behind ship body) ===
    if (tier >= 3) {
      this._drawSideCannons(ctx, tier, bc);
    }

    // Ship body
    const ship = img.get(this.damageSprite());
    ctx.globalAlpha = 1;
    if (ship) this.game.drawAsset(ctx, ship, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);
    else this.game.drawFallbackShip(ctx, 0, 0, 1);

    // Permanent upgrade modules. Weapon layers share the source ship's 48×48
    // registration, so they stay aligned at every visual tier.
    this._drawUpgradeModules(ctx, img, tier, bc, t);

    // === T4: energy core orb (drawn over ship body) ===
    if (tier >= 4) {
      this._drawEnergyCore(ctx, bc, t);
    }

    // Shield ring — branch-colored at T2+
    if (this.shield > 4) {
      const shieldFrac = this.shield / this.maxShield;
      const pulse = Math.sin(t * 5);
      const shieldColor = tier >= 2 ? bc.glow : CONFIG.colors.cyan;
      ctx.globalAlpha = (0.18 + 0.1 * pulse) * shieldFrac;
      ctx.strokeStyle = shieldColor;
      ctx.lineWidth = (tier >= 3 ? 3 : 2.5) + Math.min(2, this.shieldLevel * 0.35);
      ctx.shadowColor = shieldColor;
      ctx.shadowBlur = tier >= 3 ? 14 : 10;
      ctx.beginPath();
      const shieldRadius = 44 + Math.min(5, this.shieldLevel);
      ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.04 * shieldFrac;
      ctx.fillStyle = shieldColor;
      ctx.beginPath();
      ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Keystone visual aura
    if (this.keystoneId) {
      const kPulse = 0.55 + Math.sin(t * 3.5) * 0.2;
      if (this.keystoneId === "overcharged") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.12 * kPulse;
        ctx.fillStyle = "#cc66ff";
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.55 * kPulse;
        ctx.strokeStyle = "#cc66ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.keystoneId === "siege") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.14 * kPulse;
        ctx.fillStyle = "#ff8800";
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.keystoneId === "reactor") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.12 * kPulse;
        ctx.fillStyle = "#00ffcc";
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
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

  _drawStripFrame(ctx, image, frameW, frameH, frameCount, frameIndex, targetSize) {
    if (!image) return;
    const imageW = image.naturalWidth || image.width;
    const imageH = image.naturalHeight || image.height;
    if (!imageW || !imageH) return;
    const available = Math.max(1, Math.floor(imageW / frameW));
    const frame = Math.min(frameCount, available) > 1
      ? Math.abs(Math.floor(frameIndex)) % Math.min(frameCount, available)
      : 0;
    const scale = Math.min(targetSize / frameW, targetSize / frameH);
    const dw = frameW * scale, dh = frameH * scale;
    ctx.drawImage(image, frame * frameW, 0, frameW, frameH, -dw / 2, -dh / 2, dw, dh);
  }

  _drawEvolutionFrame(ctx, tier, bc) {
    const extension = tier === 2 ? 3 : tier === 3 ? 7 : 11;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = bc.primary;
    ctx.strokeStyle = bc.glow;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = bc.glow;
    ctx.shadowBlur = tier >= 4 ? 8 : 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 17, -12);
      ctx.lineTo(side * (27 + extension), -2);
      ctx.lineTo(side * (25 + extension), 15);
      ctx.lineTo(side * 15, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (tier >= 3) {
        ctx.fillStyle = "rgba(8,18,40,0.95)";
        ctx.fillRect(side * (27 + extension) - (side > 0 ? 4 : 0), 2, side * 4, 12);
        ctx.fillStyle = bc.primary;
      }
    }
    ctx.restore();
  }

  _drawUpgradeModules(ctx, img, tier, bc, t) {
    const size = RENDER_CONFIG.player.w;
    const effectiveRate = this.fireRate * this.getEvolutionFireRateMultiplier();
    const shotPhase = clamp(1 - this.fireTimer / Math.max(0.001, effectiveRate), 0, 0.999);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Auto-cannon animation remains mounted at all times.
    ctx.globalAlpha = 0.88;
    this._drawStripFrame(ctx, img.get("weaponAuto"), 48, 48, 7, shotPhase * 7, size);

    // Multi Cannon levels are represented by the same 1–5 hardpoints that fire.
    const barrelOffsets = [[0], [-10, 10], [-12, 0, 12], [-16, -5, 5, 16], [-18, -9, 0, 9, 18]];
    const barrels = barrelOffsets[Math.min(4, this.twin)];
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 5 + Math.min(5, this.fireLevel);
    ctx.globalAlpha = 0.82;
    for (const ox of barrels) {
      ctx.beginPath();
      ctx.roundRect(ox - 1.5, -31, 3, 10 + Math.min(4, this.fireLevel), 1.5);
      ctx.fill();
    }

    // Rocket and zapper modules can coexist; neither hides the other.
    if (this.rocket > 0 && !this.rocketDisabled) {
      ctx.globalAlpha = 0.82;
      this._drawStripFrame(ctx, img.get("weaponRockets"), 48, 48, 17, 0, size);
      if (this.barrage > 0) this._drawBarrageRacks(ctx, this.barrage);
    }
    if (this.zapper > 0) {
      ctx.globalAlpha = 0.72 + Math.sin(t * 5) * 0.08;
      this._drawStripFrame(ctx, img.get("weaponZapper"), 48, 48, 14, 0, size);
    }

    if (this.hpLevel > 0) this._drawHullPlates(ctx, bc);
    if (this.magnet > 0) this._drawMagnetCoils(ctx, t);
    if (this.beam > 0) this._drawBeamEmitter(ctx, t);
    if (this.pulse > 0 || this.pulseReactor) this._drawPulseReactor(ctx, t);

    ctx.restore();
  }

  _drawBarrageRacks(ctx, level) {
    ctx.fillStyle = CONFIG.colors.orange;
    ctx.shadowColor = CONFIG.colors.orange;
    ctx.shadowBlur = 7;
    ctx.globalAlpha = 0.9;
    const rows = Math.min(3, level);
    for (const side of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        ctx.beginPath();
        ctx.arc(side * (25 + row * 2), -7 + row * 7, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawHullPlates(ctx, bc) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = bc.primary;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55 + Math.min(0.3, this.hpLevel * 0.06);
    const width = 4 + Math.min(4, this.hpLevel);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 14, -13);
      ctx.lineTo(side * (14 + width), -7);
      ctx.lineTo(side * (14 + width), 13);
      ctx.lineTo(side * 13, 17);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "lighter";
  }

  _drawMagnetCoils(ctx, t) {
    const pulse = 0.65 + Math.sin(t * 4) * 0.2;
    ctx.strokeStyle = CONFIG.colors.pink;
    ctx.shadowColor = CONFIG.colors.pink;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.4 + Math.min(1.2, this.magnet * 0.2);
    ctx.globalAlpha = pulse;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 27, 8, 4 + Math.min(3, this.magnet), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawBeamEmitter(ctx, t) {
    const pulse = 0.75 + Math.sin(t * 8) * 0.2;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 10 + this.beam * 3;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.roundRect(-2.5 - this.beam * 0.35, -36, 5 + this.beam * 0.7, 13, 2.5);
    ctx.fill();
  }

  _drawPulseReactor(ctx, t) {
    const pulse = 0.72 + Math.sin(t * 6) * 0.22;
    const radius = 5 + this.pulse * 1.1;
    ctx.strokeStyle = "#3addc8";
    ctx.fillStyle = "rgba(58,221,200,0.35)";
    ctx.shadowColor = "#3addc8";
    ctx.shadowBlur = 10 + this.pulse * 2;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(0, -3, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // T3/T4: flanking engine nozzles
  _drawSideEngines(ctx, tier, bc, speedBoost, flame, t) {
    const offsets = [-22, 22];
    const nozzleSize = tier >= 4 ? 1.3 : 1.0;
    for (const ox of offsets) {
      ctx.globalAlpha = 0.55 + speedBoost * 0.2;
      const sg = ctx.createRadialGradient(ox, 32, 0, ox, 42, 14 * nozzleSize);
      sg.addColorStop(0, bc.engine);
      sg.addColorStop(0.5, "rgba(54,140,255,0.5)");
      sg.addColorStop(1, "rgba(30,80,255,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(ox, 34 + speedBoost * 3, (6 + speedBoost * 2) * flame * nozzleSize, (13 + speedBoost * 4) * flame * nozzleSize, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // T3+: side cannon stubs — small rectangles flanking the ship
  _drawSideCannons(ctx, tier, bc) {
    const offsets = [-24, 24];
    const len = tier >= 4 ? 18 : 13;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = bc.primary;
    ctx.shadowColor = bc.glow;
    ctx.shadowBlur = 6;
    for (const ox of offsets) {
      ctx.beginPath();
      ctx.roundRect(ox - 3, -22, 6, len, 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // T4: pulsing energy core at ship center
  _drawEnergyCore(ctx, bc, t) {
    const pulse = 0.7 + Math.sin(t * 6.5) * 0.3;
    // Outer glow
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = bc.glow;
    ctx.shadowColor = bc.glow;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -4, 16 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // Bright inner orb
    ctx.globalAlpha = 0.55 * pulse;
    ctx.beginPath();
    ctx.arc(0, -4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
