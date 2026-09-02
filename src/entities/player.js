import { CONFIG, RENDER_CONFIG } from "../config.js";
import { clamp, lerp } from "../utils.js";
import { updateBeam, updatePulse } from "../systems/abilities.js";
import {
  PLAYER_ANIMATION_FPS,
  PLAYER_INVINCIBILITY_VISUAL,
  PLAYER_MODULE_FRAME,
  PLAYER_SHIELD_FRAME,
  PLAYER_WEAPON_VISUALS,
  playerEngineVisual,
  playerShieldVisual,
  playerWeaponVisualKey,
} from "../data/playerVisuals.js";

// Branch accent colors
const BRANCH_COLORS = {
  assault: { primary: "#c8d8ff", glow: "#aabbff" },
  energy:  { primary: "#88aaff", glow: "#88ccff" },
  siege:   { primary: "#ffb060", glow: "#ffaa40" },
};

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
    this.weaponAnimations = Object.create(null);
    this.pendingWeaponShots = [];
    this._autoBarrel = 0;
    this._rocketBarrel = 0;
  }

  // Returns 1–4 based on current sector
  shipTier() {
    return Math.min(4, this.game.currentSectorIndex + 1);
  }

  shipVisualScale() {
    const physicalUpgrades =
      Math.min(5, this.fireLevel) * 0.35 +
      Math.min(4, this.twin) * 0.75 +
      Math.min(5, this.rocket) * 0.65 +
      Math.min(5, this.zapper) * 0.65 +
      Math.min(3, this.speedLevel) * 0.8 +
      Math.min(3, this.shieldLevel) * 0.65 +
      Math.min(4, this.hpLevel) * 0.45 +
      Math.min(3, this.beam) * 0.8 +
      Math.min(3, this.pulse) * 0.45 +
      Math.min(3, this.barrage) * 0.45;
    return 1 + Math.min(0.1, physicalUpgrades * 0.006);
  }

  equippedWeaponVisualKey() {
    return playerWeaponVisualKey(this);
  }

  triggerWeaponAnimation(key, cycleDuration = null, frameCount = null) {
    const visual = PLAYER_WEAPON_VISUALS[key];
    if (!visual) return 1 / PLAYER_ANIMATION_FPS;

    const now = this.game.time || 0;
    const activeFrameCount = frameCount ?? visual.frameCount;
    const duration = cycleDuration ?? activeFrameCount / PLAYER_ANIMATION_FPS;
    const frameDuration = duration / activeFrameCount;
    this.weaponAnimations[key] = {
      startedAt: now,
      activeUntil: now + duration,
      frameDuration,
      frameCount: activeFrameCount,
    };
    return frameDuration;
  }

  isWeaponAnimationActive(key) {
    const state = this.weaponAnimations[key];
    return Boolean(state && (this.game.time || 0) < state.activeUntil);
  }

  queueWeaponShot(delay, fire) {
    this.pendingWeaponShots.push({ remaining: Math.max(0, delay), fire });
  }

  updatePendingWeaponShots(dt) {
    // Iterate backwards so callbacks can safely queue follow-up shots.
    for (let i = this.pendingWeaponShots.length - 1; i >= 0; i--) {
      const shot = this.pendingWeaponShots[i];
      shot.remaining -= dt;
      if (shot.remaining > 0) continue;
      this.pendingWeaponShots.splice(i, 1);
      shot.fire();
    }
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
    this.updatePendingWeaponShots(dt);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      // Evolution multiplier < 1 means faster effective fire rate; does not mutate base fireRate.
      this.fireTimer = this.fireRate * this.getEvolutionFireRateMultiplier();
      this.fire(this.fireTimer);
    }

    updateBeam(this, dt);
    updatePulse(this, dt);
  }

  fire(autoCycleDuration = this.fireRate * this.getEvolutionFireRateMultiplier()) {
    this._fireAuto(autoCycleDuration);
    this._tryFireRockets();
    this._tryFireZapper();
  }

  _fireAuto(cycleDuration) {
    const visual = PLAYER_WEAPON_VISUALS.auto;
    const frameDuration = this.triggerWeaponAnimation("auto", cycleDuration);
    const moduleVisible = this.equippedWeaponVisualKey() === "auto";
    const authoredAutoUnlocked = this.fireLevel > 0 || this.twin > 0;

    // twin 0: alternate the authored two barrels when the Auto Cannon is
    // mounted. Higher levels keep the established multi-shot spread.
    const twinOffsets = [
      [0],
      [-10, 10],
      [-12, 0, 12],
      [-16, -5, 5, 16],
      [-18, -9, 0, 9, 18],
    ];
    const offsets = [...twinOffsets[Math.min(this.twin, 4)]];
    if (moduleVisible && offsets.length === 1) {
      offsets[0] = visual.muzzles[this._autoBarrel % visual.muzzles.length].x;
      this._autoBarrel++;
    }

    const twinDmg = 11 + this.twin * 1.5;
    const delay = moduleVisible ? visual.releaseFrames[0] * frameDuration : 0;
    for (const offset of offsets) {
      this.queueWeaponShot(delay, () => {
        const scale = this.shipVisualScale();
        this.game.spawnProjectile(
          this.x + offset * scale,
          this.y + visual.muzzles[0].y * scale,
          -Math.PI / 2,
          640,
          twinDmg,
          "player",
          "laser",
          authoredAutoUnlocked ? visual.projectileKey : "laser",
        );
      });
    }
  }

  _tryFireRockets(force = false) {
    if ((!this.rocket && !force) || this.rocketDisabled || this.isWeaponAnimationActive("rockets")) return;
    const chance = 0.18 + this.rocket * 0.04;
    if (!force && Math.random() >= chance) return;

    const visual = PLAYER_WEAPON_VISUALS.rockets;
    const count = this.barrage > 0 || force ? 3 : 1;
    // Frames 0–6 contain the first launch/recovery. The full 17-frame strip
    // is reserved for the authored three-shot barrage.
    const animationFrames = count > 1 ? visual.frameCount : 7;
    const frameDuration = this.triggerWeaponAnimation("rockets", null, animationFrames);
    const dmgMult = this.siegePayload ? 2.5 : 1;
    const damage = (22 + Math.max(1, this.rocket) * 4 + this.barrage * 5) * dmgMult;

    for (let i = 0; i < count; i++) {
      const muzzle = visual.muzzles[(this._rocketBarrel + i) % visual.muzzles.length];
      const releaseFrame = visual.releaseFrames[Math.min(i, visual.releaseFrames.length - 1)];
      this.queueWeaponShot(releaseFrame * frameDuration, () => {
        const scale = this.shipVisualScale();
        const x = this.x + muzzle.x * scale;
        const y = this.y + muzzle.y * scale;
        const target = this.game.closestEnemy(x, y, 420);
        const spread = count > 1 ? (i - 1) * 0.08 : 0;
        const angle = target ? Math.atan2(target.y - y, target.x - x) + spread : -Math.PI / 2 + spread;
        this.game.spawnProjectile(x, y, angle, 420 + i * 12, damage, "player", "rocket", visual.projectileKey);
      });
    }
    this._rocketBarrel = (this._rocketBarrel + count) % visual.muzzles.length;
  }

  _tryFireZapper(force = false) {
    if ((!this.zapper && !force) || this.isWeaponAnimationActive("zapper")) return;
    const overcharged = this.keystoneId === "overcharged";
    const chance = overcharged ? 1 : 0.15 + this.zapper * 0.025;
    if (!force && Math.random() >= chance) return;

    const target = this.game.closestEnemy(this.x, this.y, 300);
    if (!target && !force) return;

    const visual = PLAYER_WEAPON_VISUALS.zapper;
    const frameDuration = this.triggerWeaponAnimation("zapper");
    const zapDmg = (20 + Math.max(1, this.zapper) * 5) * (overcharged ? 2.2 : 1);
    const chainCount = overcharged ? 2 : (this.zapper >= 2 ? 1 : 0);

    this.queueWeaponShot(visual.releaseFrames[0] * frameDuration, () => {
      const scale = this.shipVisualScale();
      const muzzle = visual.muzzles[0];
      const x = this.x + muzzle.x * scale;
      const y = this.y + muzzle.y * scale;
      const currentTarget = target && !target.dead ? target : this.game.closestEnemy(x, y, 360);
      const angle = currentTarget ? Math.atan2(currentTarget.y - y, currentTarget.x - x) : -Math.PI / 2;
      this.game.spawnProjectile(x, y, angle, 760, zapDmg, "player", "zapper", visual.projectileKey, {
        target: currentTarget,
        turnRate: 9,
        hitRadius: 5,
        life: 0.85,
        onHit: hit => this._chainZapperHit(hit, zapDmg, chainCount),
      });
    });
  }

  _chainZapperHit(primary, damage, chainCount) {
    if (!chainCount) return;
    const visited = new Set([primary]);
    let last = primary;
    for (let c = 0; c < chainCount; c++) {
      let next = null;
      let bestDistance = 200 * 200;
      for (const enemy of this.game.enemies) {
        if (enemy.dead || visited.has(enemy)) continue;
        const distance = this.game.dist2(last.x, last.y, enemy.x, enemy.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          next = enemy;
        }
      }
      if (!next) break;
      next.damage(damage * 0.6);
      this.game.spawnZap(last.x, last.y, next.x, next.y, true);
      visited.add(next);
      last = next;
    }
  }

  fireBigGun(force = false) {
    if (!this.beam && !force) return;
    const visual = PLAYER_WEAPON_VISUALS.bigGun;
    const frameDuration = this.triggerWeaponAnimation("bigGun");
    const damage = 48 + Math.max(1, this.beam) * 18;
    this.queueWeaponShot(visual.releaseFrames[0] * frameDuration, () => {
      const scale = this.shipVisualScale();
      const muzzle = visual.muzzles[0];
      this.game.spawnProjectile(
        this.x + muzzle.x * scale,
        this.y + muzzle.y * scale,
        -Math.PI / 2,
        360,
        damage,
        "player",
        "bigGun",
        visual.projectileKey,
        { piercing: true, hitRadius: 11, life: 2.4 },
      );
      this.game.shake = Math.max(this.game.shake, 2.5);
    });
  }

  previewWeaponFire(key) {
    if (key === "auto") this._fireAuto(0.7);
    else if (key === "rockets") this._tryFireRockets(true);
    else if (key === "zapper") this._tryFireZapper(true);
    else if (key === "bigGun") this.fireBigGun(true);
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

  draw(ctx, img, options = {}) {
    const {
      showWeapon = true,
      showShield = true,
      showPassive = true,
      showKeystone = true,
      forceEngineLevel = null,
    } = options;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);
    ctx.imageSmoothingEnabled = false;

    const branch = this.shipBranch();
    const bc     = BRANCH_COLORS[branch];
    const t      = this.game.time;
    const visualScale = this.shipVisualScale();
    ctx.scale(visualScale, visualScale);

    const speed = Math.hypot(this.vx, this.vy);
    const speedBoost = clamp(speed / 320, 0, 1);
    this._drawEngineLayers(ctx, img, t, speedBoost, forceEngineLevel);

    const ship = img.get(this.damageSprite());
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (ship) this.game.drawAsset(ctx, ship, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);
    else this.game.drawFallbackShip(ctx, 0, 0, 1);

    if (showPassive) this._drawPassiveUpgradeLayers(ctx, bc, t);
    if (showWeapon) this._drawWeaponLayer(ctx, img, t);
    if (showKeystone) this._drawKeystoneAura(ctx, t);
    if (showShield) this._drawShieldLayer(ctx, img, t);

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

  _drawEngineLayers(ctx, img, t, speedBoost, forceEngineLevel) {
    const engineLevel = forceEngineLevel ?? this.speedLevel;
    const engine = playerEngineVisual(engineLevel);
    const activeScene = this.game.state === "playing" || this.game.state === "visualTest";
    const powering = activeScene && (this.game.input.active || speedBoost > 0.08);
    const effect = powering ? engine.powering : engine.idle;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // The Foozle effect sheets include glow pixels inside the engine nozzle.
    // Draw the static module first so Burst/Base effects are not almost fully
    // hidden; the hull is drawn afterwards and still masks the inner overlap.
    const module = img.get(engine.moduleKey);
    if (module) this.game.drawAsset(ctx, module, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);

    this._drawStripFrame(
      ctx,
      img.get(effect.assetKey),
      PLAYER_MODULE_FRAME,
      PLAYER_MODULE_FRAME,
      effect.frameCount,
      t * PLAYER_ANIMATION_FPS,
      RENDER_CONFIG.player.w,
    );
    ctx.restore();
  }

  _drawPassiveUpgradeLayers(ctx, bc, t) {
    if (this.hpLevel > 0) this._drawHullPlates(ctx, bc);
    if (this.magnet > 0) this._drawMagnetCoils(ctx, t);
    if (this.pulse > 0 || this.pulseReactor) this._drawPulseReactor(ctx, t);
  }

  _drawWeaponLayer(ctx, img, t) {
    let key = this.equippedWeaponVisualKey();
    let activePriority = -1;
    for (const [candidate, state] of Object.entries(this.weaponAnimations)) {
      if (t >= state.activeUntil) continue;
      if (candidate === "auto" && this.fireLevel === 0 && this.twin === 0) continue;
      if (candidate === "rockets" && (this.rocket === 0 || this.rocketDisabled)) continue;
      if (candidate === "zapper" && this.zapper === 0) continue;
      if (candidate === "bigGun" && this.beam === 0) continue;
      const priority = PLAYER_WEAPON_VISUALS[candidate]?.activePriority ?? 0;
      if (priority > activePriority) {
        key = candidate;
        activePriority = priority;
      }
    }
    const visual = PLAYER_WEAPON_VISUALS[key];
    if (!visual) return;

    const state = this.weaponAnimations[key];
    const active = state && t < state.activeUntil;
    const frame = active
      ? Math.floor((t - state.startedAt) / state.frameDuration) % state.frameCount
      : 0;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    this._drawStripFrame(
      ctx,
      img.get(visual.assetKey),
      PLAYER_MODULE_FRAME,
      PLAYER_MODULE_FRAME,
      visual.frameCount,
      frame,
      RENDER_CONFIG.player.w,
    );
    ctx.restore();
  }

  _drawShieldLayer(ctx, img, t) {
    const invincible = this.invuln > 0;
    if (!invincible && (this.shield <= 0 || this.shieldLevel <= 0)) return;

    const visual = invincible ? PLAYER_INVINCIBILITY_VISUAL : playerShieldVisual(this.shieldLevel - 1);
    const shieldFraction = this.maxShield > 0 ? clamp(this.shield / this.maxShield, 0, 1) : 0;
    const targetSize = RENDER_CONFIG.playerShield.w;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = invincible ? 1 : 0.5 + shieldFraction * 0.45;
    this._drawStripFrame(
      ctx,
      img.get(visual.assetKey),
      PLAYER_SHIELD_FRAME,
      PLAYER_SHIELD_FRAME,
      visual.frameCount,
      t * PLAYER_ANIMATION_FPS,
      targetSize,
    );
    ctx.restore();
  }

  _drawKeystoneAura(ctx, t) {
    if (!this.keystoneId) return;

    const colors = {
      overcharged: "#cc66ff",
      siege: "#ff8800",
      reactor: "#00ffcc",
    };
    const color = colors[this.keystoneId];
    if (!color) return;

    const pulse = 0.55 + Math.sin(t * 3.5) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.1 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.42 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.stroke();
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

  _drawHullPlates(ctx, bc) {
    ctx.save();
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
    ctx.restore();
  }

  _drawMagnetCoils(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
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
    ctx.restore();
  }

  _drawPulseReactor(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
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
    ctx.restore();
  }
}
