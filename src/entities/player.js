import { CONFIG, PLAYER_ENGINE_SPEEDS, PLAYER_SHIELD_RECHARGE_DELAYS, PLAYER_WEAPON_BALANCE, RENDER_CONFIG } from "../config.js";
import { clamp, lerp } from "../utils.js";
import { updateBeam, updatePulse } from "../systems/abilities.js";
import { emitRocketLaunch } from "../systems/fx.js";
import {
  PLAYER_ANIMATION_FPS,
  PLAYER_INVINCIBILITY_VISUAL,
  PLAYER_MODULE_FRAME,
  PLAYER_SHIELD_FRAME,
  PLAYER_WEAPON_VISUALS,
  playerEngineVisual,
  playerShieldVisual,
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
    this.speed = PLAYER_ENGINE_SPEEDS[0];
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
    this.shieldRechargeDelay = 0;
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
    // Passive defensive keystone. It only triggers when a hit would reach
    // the hull, so normal shield chip never wastes it.
    this.emergencyAegis = false;
    this.aegisCooldown = 0;
    this.aegisReadyFlash = 0;
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

  installedWeaponVisualKeys() {
    // Every Foozle weapon sheet shares the same 48px registration canvas.
    // They are authored as overlays, so acquired systems stay mounted instead
    // of replacing one another when a different weapon happens to fire.
    return [
      (this.fireLevel > 0 || this.twin > 0) ? "auto" : null,
      (this.rocket > 0 && !this.rocketDisabled) ? "rockets" : null,
      this.zapper > 0 ? "zapper" : null,
      this.beam > 0 ? "bigGun" : null,
    ].filter(Boolean);
  }

  triggerWeaponAnimation(key, cycleDuration = null, frameCount = null) {
    const visual = PLAYER_WEAPON_VISUALS[key];
    if (!visual) return 1 / PLAYER_ANIMATION_FPS;

    const now = this.game.state === "visualTest" ? (this.game.time || 0) : (this.game.simTime || 0);
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
    const now = this.game.state === "visualTest" ? (this.game.time || 0) : (this.game.simTime || 0);
    return Boolean(state && now < state.activeUntil);
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
      if (this.game.state !== "playing" && this.game.state !== "visualTest") return;
    }
  }

  // True movement-speed bonus by tier (total, not per-frame stack).
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

  shieldRechargeDelayDuration() {
    return PLAYER_SHIELD_RECHARGE_DELAYS[Math.min(PLAYER_SHIELD_RECHARGE_DELAYS.length - 1, this.shieldLevel)];
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
    const oldY = this.y;
    // Keep direction changes immediate; top speed is the only movement limit.
    const dx = tx - this.x;
    const dy = ty - this.y;
    const distance = Math.hypot(dx, dy);
    const maxStep = this.speed * this.getEvolutionMoveMultiplier() * dt;
    if (distance > 0.001) {
      const step = Math.min(distance, maxStep);
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
    this.vx = (this.x - oldX) / Math.max(dt, 0.001);
    this.vy = (this.y - oldY) / Math.max(dt, 0.001);
    this.bank = lerp(this.bank, clamp(this.vx / 520, -0.35, 0.35), clamp(dt * 9, 0, 1));

    this.invuln = Math.max(0, this.invuln - dt);
    this.aegisCooldown = Math.max(0, this.aegisCooldown - dt);
    this.aegisReadyFlash = Math.max(0, this.aegisReadyFlash - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shieldRechargeDelay = Math.max(0, this.shieldRechargeDelay - dt);
    if (this.shieldRechargeDelay <= 0) {
      this.shield = clamp(this.shield + this.shieldRegen * dt, 0, this.maxShield);
    }
    this.updatePendingWeaponShots(dt);
    if (this.game.state !== "playing") return;

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
    const authoredAutoUnlocked = this.fireLevel > 0 || this.twin > 0;
    const moduleVisible = authoredAutoUnlocked;

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
    const volleySize = offsets.length;
    for (let shotIndex = 0; shotIndex < volleySize; shotIndex++) {
      const offset = offsets[shotIndex];
      // A two-barrel burst remains perfectly parallel. Extra barrels form a
      // subtle fan and fire a few milliseconds apart, so a five-shot upgrade
      // reads as a physical salvo rather than a flat laser wall.
      const spreadRank = volleySize > 1 ? (shotIndex / (volleySize - 1)) * 2 - 1 : 0;
      const salvoDelay = volleySize > 2 ? Math.abs(spreadRank) * 0.044 : 0;
      const angle = -Math.PI / 2 + (volleySize > 2 ? spreadRank * 0.06 : 0);
      this.queueWeaponShot(delay + salvoDelay, () => {
        const scale = this.shipVisualScale();
        this.game.spawnProjectile(
          this.x + offset * scale,
          this.y + visual.muzzles[0].y * scale,
          angle,
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
    const balance = PLAYER_WEAPON_BALANCE.rocket;
    const chance = balance.baseChance + this.rocket * balance.chancePerLevel;
    if (!force && Math.random() >= chance) return;

    const visual = PLAYER_WEAPON_VISUALS.rockets;
    const count = this.barrage > 0 || force ? 3 : 1;
    // Frames 0–6 contain the first launch/recovery. The full 17-frame strip
    // is reserved for the authored three-shot barrage.
    const animationFrames = count > 1 ? visual.frameCount : 7;
    const frameDuration = this.triggerWeaponAnimation("rockets", null, animationFrames);
    const dmgMult = this.siegePayload ? 2.5 : 1;
    const damage = (
      balance.baseDamage +
      Math.max(1, this.rocket) * balance.damagePerLevel +
      this.barrage * balance.barrageDamagePerLevel
    ) * dmgMult;

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
        emitRocketLaunch(this.game, x, y, angle);
        this.game.shake = Math.max(this.game.shake, 0.55);
      });
    }
    this._rocketBarrel = (this._rocketBarrel + count) % visual.muzzles.length;
  }

  _tryFireZapper(force = false) {
    if ((!this.zapper && !force) || this.isWeaponAnimationActive("zapper")) return;
    const overcharged = this.keystoneId === "overcharged";
    const balance = PLAYER_WEAPON_BALANCE.zapper;
    // The full firing strip sets the practical cadence, so the ordinary
    // chance needs to be high enough for a level-one Zapper to feel reliable.
    const chance = overcharged ? 1 : balance.baseChance + this.zapper * balance.chancePerLevel;
    if (!force && Math.random() >= chance) return;

    const target = this.game.closestEnemy(this.x, this.y, 300);
    if (!target && !force) return;

    const visual = PLAYER_WEAPON_VISUALS.zapper;
    const frameDuration = this.triggerWeaponAnimation("zapper");
    const zapDmg = (
      balance.baseDamage + Math.max(1, this.zapper) * balance.damagePerLevel
    ) * (overcharged ? 2.2 : 1);
    // Level 2 unlocks the first jump; levels 4–5 earn a second. The
    // Overcharged Core extends that pattern once more for a true lightning
    // build, rather than merely raising a hidden damage value.
    const chainCount = overcharged ? 3 : Math.floor(this.zapper / 2);
    const chainRange = 180 + Math.max(0, this.zapper - 1) * 25;
    const zapIntensity = 1.16 + Math.max(0, this.zapper - 1) * 0.18 + (overcharged ? 0.28 : 0);

    this.queueWeaponShot(visual.releaseFrames[0] * frameDuration, () => {
      const scale = this.shipVisualScale();
      const muzzle = visual.muzzles[0];
      const x = this.x + muzzle.x * scale;
      const y = this.y + muzzle.y * scale;
      const currentTarget = target && !target.dead ? target : this.game.closestEnemy(x, y, 360);
      if (!currentTarget || currentTarget.dead) return;

      // The Zapper is an instantaneous lightning weapon, not a slow energy
      // projectile. Its visible first arc is therefore identical in language
      // to the later chain arcs and makes the whole upgrade read at a glance.
      currentTarget.damage(zapDmg);
      this.game.spawnZap(x, y, currentTarget.x, currentTarget.y, false, zapIntensity);
      this._chainZapperHit(currentTarget, zapDmg, chainCount, chainRange, zapIntensity);
    });
  }

  _chainZapperHit(primary, damage, chainCount, chainRange, intensity) {
    if (!chainCount) return;
    const visited = new Set([primary]);
    let last = primary;
    for (let c = 0; c < chainCount; c++) {
      let next = null;
      let bestDistance = chainRange * chainRange;
      for (const enemy of this.game.enemies) {
        if (enemy.dead || visited.has(enemy)) continue;
        const distance = this.game.dist2(last.x, last.y, enemy.x, enemy.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          next = enemy;
        }
      }
      if (!next) break;
      next.damage(damage * PLAYER_WEAPON_BALANCE.zapper.chainDamageMultiplier);
      this.game.spawnZap(last.x, last.y, next.x, next.y, true, intensity * 0.78);
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

  damage(amount, cause = { kind: "unknown" }) {
    if (this.invuln > 0) return;
    let left = amount;
    if (this.shield > 0) {
      const used = Math.min(this.shield, left);
      this.shield -= used;
      left -= used;
      this.shieldRechargeDelay = this.shieldRechargeDelayDuration();
    }
    if (left > 0 && this.emergencyAegis && this.aegisCooldown <= 0) {
      // The triggering hull hit is fully blocked, then the authored
      // invincibility-shield layer stays active for the protection window.
      this.invuln = 1.8;
      this.aegisCooldown = 18;
      this.aegisReadyFlash = 0.75;
      this.hitFlash = 0.24;
      this.game.shake = Math.max(this.game.shake, 6);
      this.game.burst(this.x, this.y, "#bc72ff", 24);
      this.game.sounds?.play("hit");
      return;
    }
    this.hp -= left;
    this.game.sounds?.play("hit");
    this.hitFlash = 0.14;
    this.invuln = 0.28;
    this.game.shake = Math.max(this.game.shake, 4);
    this.game.burst(this.x, this.y, left > 0 ? CONFIG.colors.red : CONFIG.colors.cyan, 14);
    if (this.hp <= 0) this.game.endRun(cause);
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
    const t      = this.game.state === "visualTest" ? this.game.time : this.game.simTime;
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
    if (showKeystone) this._drawKeystoneAura(ctx, t);
    if (showShield) this._drawShieldLayer(ctx, img, t);

    // Damage sprites, the hit flash and the temporary invulnerability shield
    // must never make permanently installed weapons appear to detach. Weapon
    // modules are physical exterior attachments, so they are the final ship
    // layer regardless of the hull's health state.
    if (this.hitFlash > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.hitFlash / 0.14;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showWeapon) {
      this._drawZapperCharge(ctx, t);
      this._drawWeaponLayer(ctx, img, t);
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
    for (const key of this.installedWeaponVisualKeys()) {
      const visual = PLAYER_WEAPON_VISUALS[key];
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
  }

  _drawZapperCharge(ctx, t) {
    if (!this.zapper) return;
    const level = Math.min(5, this.zapper);
    const prongs = 1 + Math.floor((level - 1) / 2);
    const spacing = 11;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.42 + level * 0.08;
    ctx.strokeStyle = "#e477ff";
    ctx.shadowColor = "#bd55ff";
    ctx.shadowBlur = this.game.lowEffects ? 0 : 7 + level * 2;
    ctx.lineWidth = 1.45 + level * 0.24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < prongs; i++) {
      const x = (i - (prongs - 1) / 2) * spacing;
      const flicker = Math.sin(t * 14 + i * 2.7) * 2;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + flicker, -28);
      ctx.lineTo(x - flicker * 0.6, -34 - level * 0.8);
      ctx.stroke();
    }
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
      aegis: "#bd76ff",
    };
    const color = colors[this.keystoneId];
    if (!color) return;

    // Aegis is an additional emergency layer. Ready-state brackets stay visible
    // around the installed shield; the full bubble is reserved for a hull hit.
    if (this.keystoneId === "aegis" && this.aegisCooldown <= 0) {
      ctx.save();
      ctx.strokeStyle = "#dca7ff";
      ctx.lineWidth = 2.2;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.game.lowEffects ? 0 : 8;
      for (let i = 0; i < 4; i++) {
        const angle = Math.PI / 4 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(0, 0, 49, angle - 0.19, angle + 0.19);
        ctx.stroke();
      }
      ctx.restore();
    }

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
