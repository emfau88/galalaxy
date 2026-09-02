import { CONFIG, RENDER_CONFIG } from "../config.js";
import { clamp, lerp, dist2 } from "../utils.js";
import { ENEMY_WEAPON_PROFILES } from "../data/projectiles.js";
import { enemyVisualFor } from "../data/enemyVisuals.js";

const DEFAULT_WEAPON_PROFILE = {
  speed: 210,
  damage: 7,
  cooldown: 2.8,
  wideCooldown: 1.6,
  hitRadius: 5,
  life: 2.6,
  behavior: "straight",
};

export class Enemy {
  // flyby: optional { vx, vy, sineAmp, sineFreq } — if set, enemy uses fixed-velocity movement
  constructor(game, type, x, y, boss = false, speedMult = 1.0, flyby = null) {
    this.game = game;
    this.type = type;
    this.x = x;
    this.y = y;
    this.boss = boss;
    const def = Enemy.defs[type];
    this.r = boss ? def.r * 1.3 : def.r;
    this.maxHp = boss ? def.hp * 6 : def.hp;
    this.hp = this.maxHp;
    // speedMult only applies to regular enemies; boss speed is never reduced by sector tuning
    this.speed = boss ? def.speed * 0.45 : def.speed * speedMult;
    this.damagePower = boss ? def.damage * 1.8 : def.damage;
    this.score = boss ? def.score * 8 : def.score;
    this.imgKey = def.img;
    this.projVisual = Enemy._projVisual(type, boss);
    this.weaponProfile = ENEMY_WEAPON_PROFILES[this.projVisual] || DEFAULT_WEAPON_PROFILE;
    this.visual = type.startsWith("nairan") || type.startsWith("nautolan") ? null : enemyVisualFor(type);
    this.weaponAnimation = null;
    this.pendingShots = [];
    // Boss shields add a readable, authored defensive phase without making
    // ordinary swarm ships visually noisy.
    this.maxShield = boss ? Math.round(this.maxHp * 0.16) : 0;
    this.shield = this.maxShield;
    this.shieldFlash = 0;
    this.hitFlash = 0;
    this.fireTimer = boss ? 1.2 : 2.5 + Math.random() * 2;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
    // flyby stores { vx, vy, sineAmp, sineFreq } — null means normal chase behavior
    this.flyby = flyby || null;
    this._flybyT = 0; // local time accumulator for sine drift
  }

  _facingAngle() {
    if (this.flyby) return Math.atan2(this.flyby.vy, this.flyby.vx);
    const p = this.game.player;
    return Math.atan2(p.y - this.y, p.x - this.x);
  }

  _muzzlePosition(facingAngle, lane = 0) {
    const rc = RENDER_CONFIG.enemies[this.type] || { w: this.r * 2 };
    const renderedSize = this.boss ? rc.w * 1.85 : rc.w;
    // The source sprites contain transparent padding, so the visible nose sits
    // at roughly one third of the rendered square rather than at its edge.
    const forward = Math.max(12, renderedSize * 0.34);
    const laneGap = Math.min(7, renderedSize * 0.055);
    const sideAngle = facingAngle + Math.PI / 2;
    return {
      x: this.x + Math.cos(facingAngle) * forward + Math.cos(sideAngle) * lane * laneGap,
      y: this.y + Math.sin(facingAngle) * forward + Math.sin(sideAngle) * lane * laneGap,
    };
  }

  _spawnWeaponShot(angle, { speedMult = 1, damageMult = 1, lane = 0, facingAngle = null } = {}) {
    const profile = this.weaponProfile;
    const muzzle = this._muzzlePosition(facingAngle ?? this._facingAngle(), lane);
    this.game.spawnProjectile(
      muzzle.x,
      muzzle.y,
      angle,
      profile.speed * speedMult,
      profile.damage * damageMult,
      "enemy",
      "enemy",
      this.projVisual
    );
  }

  _queueWeaponShot(angle, options = {}) {
    const weapon = this.visual?.weapon;
    if (!weapon) {
      this._spawnWeaponShot(angle, options);
      return;
    }
    // A volley shares one authored animation; individual spread shots leave
    // on its release frame instead of appearing before the gun has fired.
    if (!this.weaponAnimation || this.game.time >= this.weaponAnimation.until) {
      this.weaponAnimation = {
        startedAt: this.game.time,
        until: this.game.time + weapon.frameCount / weapon.fps,
      };
    }
    this.pendingShots.push({
      at: this.game.time + weapon.releaseFrame / weapon.fps,
      angle,
      options,
    });
  }

  _releaseQueuedShots() {
    for (let i = this.pendingShots.length - 1; i >= 0; i--) {
      const shot = this.pendingShots[i];
      if (shot.at > this.game.time) continue;
      this.pendingShots.splice(i, 1);
      if (!this.dead) this._spawnWeaponShot(shot.angle, shot.options);
    }
  }

  update(dt) {
    const p = this.game.player;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this._releaseQueuedShots();

    if (this.boss) {
      // Boss enters arena and holds position in upper-middle area
      const holdY = 185;
      const holdX = CONFIG.designW / 2 + Math.sin(this.game.time * 0.55 + this.wobble) * 72;
      this.x = lerp(this.x, holdX, clamp(dt * 1.4, 0, 1));
      this.y = lerp(this.y, holdY, clamp(dt * (this.y < 0 ? 2.2 : 0.9), 0, 1));
    } else if (this.flyby) {
      // Flyby: fixed velocity + optional perpendicular sine drift — does NOT chase player
      this._flybyT += dt;
      const f = this.flyby;
      // Perpendicular axis to travel direction for the sine wiggle
      const len = Math.hypot(f.vx, f.vy) || 1;
      const px = -f.vy / len; // perpendicular unit x
      const py =  f.vx / len; // perpendicular unit y
      const sineOffset = Math.sin(this._flybyT * (f.sineFreq ?? 2.2) + this.wobble) * (f.sineAmp ?? 0);
      this.x += (f.vx + px * sineOffset) * dt;
      this.y += (f.vy + py * sineOffset) * dt;
    } else {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const side = Math.sin(this.game.time * 2 + this.wobble) * 28;
      this.x += Math.cos(a) * this.speed * dt + Math.cos(a + Math.PI / 2) * side * dt;
      this.y += Math.sin(a) * this.speed * dt + Math.sin(a + Math.PI / 2) * side * dt;
    }

    this.fireTimer -= dt;
    if (this.boss && this.fireTimer <= 0) {
      // Alternating rhythm: tight burst (3 shots) then wide spread (5 shots)
      this._bossVolley = (this._bossVolley ?? 0) + 1;
      const isBurst = this._bossVolley % 3 !== 0; // every 3rd volley is the wide spread
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      if (isBurst) {
        this.fireTimer = this.weaponProfile.cooldown;
        const spread = 0.18;
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * spread;
          this._queueWeaponShot(a, { damageMult: 0.75, lane: i, facingAngle: ang });
        }
      } else {
        this.fireTimer = this.weaponProfile.wideCooldown ?? 1.6;
        const spread = 0.30;
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * spread;
          this._queueWeaponShot(a, {
            speedMult: i === 0 ? 0.85 : 0.72,
            damageMult: i === 0 ? 1 : 0.6,
            lane: i,
            facingAngle: ang,
          });
        }
      }
    } else if (!this.boss && Enemy._canFire(this.type) && this.fireTimer <= 0) {
      this.fireTimer = this.weaponProfile.cooldown;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this._queueWeaponShot(ang);
    }

    if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
      p.damage(this.damagePower);
      this.damage(this.boss ? 4 : 999);
    }

    if (!this.boss) {
      const margin = this.flyby ? 220 : 160;
      if (this.x < -margin || this.x > CONFIG.designW + margin ||
          this.y < -margin || this.y > CONFIG.designH + margin) this.dead = true;
    }
  }

  damage(amount) {
    const absorbed = Math.min(this.shield, amount);
    this.shield -= absorbed;
    if (absorbed > 0) this.shieldFlash = 0.72;
    this.hp -= amount - absorbed;
    this.hitFlash = 0.11;
    this.game.burst(this.x, this.y, CONFIG.colors.cyan, 5);
    if (this.hp <= 0) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.game.spawnEnemyDestruction(this);
    this.game.score += this.score;
    this.game.kills++;
    this.game.dropXp(this.x, this.y, this.boss ? 12 : 1 + Math.floor(this.score / 70));
    const wasBoss = this.boss;
    this.game.explosion(this.x, this.y, wasBoss ? 42 : 22);
    this.game.deathBurst(this);
    this.game.shake = Math.max(this.game.shake, wasBoss ? 10 : 3);
    if (wasBoss) this.game.onBossKilled();
  }

  draw(ctx, img) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const p = this.game.player;
    // Flyby enemies face their travel direction; chase/boss enemies face the player.
    const drawAngle = this._facingAngle() + Math.PI / 2;
    ctx.rotate(drawAngle);

    const image = img.get(this.imgKey);
    const rc = RENDER_CONFIG.enemies[this.type] || { w: this.r * 2, h: this.r * 2 };
    const size = this.boss ? rc.w * 1.85 : rc.w;

    this._drawStrip(ctx, img.get(this.visual?.engine?.assetKey), this.visual?.frame, this.visual?.engine, this.game.time, size);

    // Boss: tight pulsing aura behind sprite — no big bubble for normal enemies
    if (this.boss) {
      const pulse = 0.28 + Math.sin(this.game.time * 4) * 0.08;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.shadowColor = CONFIG.colors.red;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    // Tight drop shadow directly behind sprite for separation from background
    if (!this.boss) {
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;
    }
    if (image) this.game.drawAsset(ctx, image, 0, 0, size, size);
    else this.game.drawFallbackEnemy(ctx, 0, 0, this.r, this.boss);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const weapon = this.visual?.weapon;
    if (weapon && this.weaponAnimation && this.game.time < this.weaponAnimation.until) {
      this._drawStrip(ctx, img.get(weapon.assetKey), this.visual.frame, weapon, this.game.time - this.weaponAnimation.startedAt, size);
    }

    if (this.visual?.shield && this.shield > 0 && this.shieldFlash > 0) {
      const shieldAlpha = (0.18 + 0.42 * (this.shield / this.maxShield)) * (this.shieldFlash / 0.72);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = shieldAlpha;
      this._drawStrip(ctx, img.get(this.visual.shield.assetKey), this.visual.frame, this.visual.shield, this.game.time, size * 1.12);
      ctx.restore();
    }

    // Hit flash — brightens the sprite on damage
    if (this.hitFlash > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.hitFlash / 0.11;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss ring — thin animated outline
    if (this.boss) {
      ctx.globalCompositeOperation = "source-over";
      ctx.rotate(-(Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2));
      ctx.globalAlpha = 0.5 + Math.sin(this.game.time * 5) * 0.15;
      ctx.strokeStyle = CONFIG.colors.red;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = CONFIG.colors.red;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawStrip(ctx, image, frameSize, animation, time, targetSize) {
    if (!image || !frameSize || !animation) return;
    const frame = Math.min(animation.frameCount - 1, Math.floor(time * animation.fps) % animation.frameCount);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(image, frame * frameSize, 0, frameSize, frameSize, -targetSize / 2, -targetSize / 2, targetSize, targetSize);
    ctx.restore();
  }
}

Enemy._canFire = function(type) {
  return /bomber|frigate|battlecruiser|dreadnought/i.test(type);
};

Enemy._projVisual = function(type, boss) {
  if (boss) {
    if (type.startsWith("nairan"))   return "nairanBoss";
    if (type.startsWith("nautolan")) return "nautolanBoss";
    return "klaedBoss";
  }
  // Per-class mapping (suffix after fleet prefix)
  const cls = type.replace(/^nairan|^nautolan/, "") || type; // bare klaed types have no prefix
  if (type.startsWith("nairan")) {
    if (cls === "Bomber")       return "nairanBomber";
    if (cls === "Frigate")      return "nairanFrigate";
    if (cls === "Battlecruiser" || cls === "Dreadnought") return "nairanBattlecruiser";
    return "nairanBomber";
  }
  if (type.startsWith("nautolan")) {
    if (cls === "Bomber")       return "nautolanBomber";
    if (cls === "Frigate")      return "nautolanFrigate";
    if (cls === "Battlecruiser" || cls === "Dreadnought") return "nautolanBattlecruiser";
    return "nautolanBomber";
  }
  // Kla'ed (no prefix)
  if (type === "frigate")      return "klaedFrigate";
  if (type === "battlecruiser" || type === "dreadnought") return "klaedBattlecruiser";
  return "klaedBomber"; // bomber (and fallback)
};

Enemy.defs = {
  // Kla'ed Fleet 1
  scout:              { hp: 18,  speed: 106, r: 17, damage: 10, score: 18,  img: "enemyScout" },
  fighter:            { hp: 34,  speed: 86,  r: 21, damage: 14, score: 35,  img: "enemyFighter" },
  bomber:             { hp: 76,  speed: 52,  r: 28, damage: 20, score: 80,  img: "enemyBomber" },
  frigate:            { hp: 110, speed: 45,  r: 34, damage: 24, score: 120, img: "enemyFrigate" },
  battlecruiser:      { hp: 180, speed: 34,  r: 42, damage: 30, score: 210, img: "enemyBattlecruiser" },
  dreadnought:        { hp: 260, speed: 28,  r: 52, damage: 34, score: 420, img: "enemyDreadnought" },

  // Nairan Fleet 2 — faster, midrange, more aggressive fire rate
  nairanScout:        { hp: 24,  speed: 118, r: 17, damage: 11, score: 24,  img: "nairanScout" },
  nairanFighter:      { hp: 44,  speed: 98,  r: 21, damage: 16, score: 46,  img: "nairanFighter" },
  nairanBomber:       { hp: 88,  speed: 60,  r: 28, damage: 22, score: 95,  img: "nairanBomber" },
  nairanFrigate:      { hp: 130, speed: 50,  r: 34, damage: 26, score: 140, img: "nairanFrigate" },
  nairanBattlecruiser:{ hp: 210, speed: 38,  r: 42, damage: 32, score: 240, img: "nairanBattlecruiser" },
  nairanDreadnought:  { hp: 300, speed: 30,  r: 52, damage: 36, score: 480, img: "nairanDreadnought" },

  // Nautolan Fleet 3 — slower, tankier, heavier damage
  nautolanScout:        { hp: 32,  speed: 90,  r: 19, damage: 13, score: 30,  img: "nautolanScout" },
  nautolanFighter:      { hp: 58,  speed: 74,  r: 23, damage: 18, score: 58,  img: "nautolanFighter" },
  nautolanBomber:       { hp: 110, speed: 46,  r: 30, damage: 25, score: 115, img: "nautolanBomber" },
  nautolanFrigate:      { hp: 160, speed: 38,  r: 36, damage: 28, score: 165, img: "nautolanFrigate" },
  nautolanBattlecruiser:{ hp: 250, speed: 28,  r: 44, damage: 34, score: 280, img: "nautolanBattlecruiser" },
  nautolanDreadnought:  { hp: 360, speed: 22,  r: 54, damage: 40, score: 560, img: "nautolanDreadnought" }
};
