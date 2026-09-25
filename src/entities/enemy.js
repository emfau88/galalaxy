import { CONFIG, RENDER_CONFIG, SECTORS } from "../config.js";
import { clamp, lerp, dist2 } from "../utils.js";
import { ENEMY_WEAPON_PROFILES } from "../data/projectiles.js";
import { enemyVisualFor } from "../data/enemyVisuals.js";
import { bossProfileFor } from "../data/bosses.js";

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
    this.bossProfile = boss ? bossProfileFor(type) : null;
    this.r = boss ? def.r * 1.3 : def.r;
    this.maxHp = this.bossProfile?.maxHp ?? (boss ? def.hp * 6 : def.hp);
    this.hp = this.maxHp;
    // speedMult only applies to regular enemies; boss speed is never reduced by sector tuning
    this.speed = boss ? def.speed * 0.45 : def.speed * speedMult;
    this.damagePower = boss ? def.damage * 1.8 : def.damage;
    this.baseScore = boss ? def.score * 8 : def.score;
    this.score = boss
      ? this.baseScore
      : Math.round(this.baseScore * (SECTORS[game.currentSectorIndex]?.scoreMult ?? 1));
    this.imgKey = def.img;
    this.projVisual = Enemy._projVisual(type, boss);
    this.weaponProfile = ENEMY_WEAPON_PROFILES[this.projVisual] || DEFAULT_WEAPON_PROFILE;
    this.visual = enemyVisualFor(type);
    this.weaponAnimation = null;
    this.pendingShots = [];
    this.specialCharge = null;
    // Boss shields add a readable, authored defensive phase without making
    // ordinary swarm ships visually noisy.
    this.maxShield = this.bossProfile?.maxShield ?? (boss ? Math.round(this.maxHp * 0.16) : (def.shield ?? 0));
    this.shield = this.maxShield;
    this.shieldFlash = 0;
    this.hitFlash = 0;
    this.fireTimer = boss ? 1.2 : 2.5 + Math.random() * 2;
    this.fireLockedUntil = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
    // flyby stores { vx, vy, sineAmp, sineFreq } — null means normal chase behavior
    this.flyby = flyby || null;
    this._flybyT = 0; // local time accumulator for sine drift
    this.supportTargets = [];
    this.supportRefreshTimer = 0;
    this.bossPhase = 1;
    this.phaseTransitionUntil = 0;
    this.phaseTransitionStartedAt = 0;
    this.phaseTransitionDuration = 0;
    this._bossSupportSummoned = false;
    this.protectableBySupport = boss && type === "nautolanDreadnought";
  }

  _bossAura() {
    const phaseAuras = this.bossProfile?.phaseAuras;
    return phaseAuras?.[Math.min(phaseAuras.length - 1, this.bossPhase - 1)] ||
      this.bossProfile?.aura || CONFIG.colors.red;
  }

  _isPhaseTransitioning() {
    return this.boss && this.game.simTime < this.phaseTransitionUntil;
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

  _spawnWeaponShot(angle, { speedMult = 1, damageMult = 1, lane = 0, facingAngle = null, visualKey = this.projVisual, origin = null } = {}) {
    const profile = ENEMY_WEAPON_PROFILES[visualKey] || this.weaponProfile;
    const muzzle = origin || this._muzzlePosition(facingAngle ?? this._facingAngle(), lane);
    this.game.spawnProjectile(
      muzzle.x,
      muzzle.y,
      angle,
      profile.speed * speedMult,
      profile.damage * damageMult,
      "enemy",
      "enemy",
      visualKey
    );
  }

  _queueWeaponShot(angle, { delay = 0, delayIncludesAnimation = false, skipWeaponAnimation = false, ...options } = {}) {
    const weapon = skipWeaponAnimation ? null : this.visual?.weapon;
    if (!weapon) {
      if (delay <= 0) this._spawnWeaponShot(angle, options);
      else this.pendingShots.push({ at: this.game.simTime + delay, angle, options });
      return;
    }
    // A volley shares one authored animation; individual spread shots leave
    // on its release frame instead of appearing before the gun has fired.
    if (!this.weaponAnimation || this.game.simTime >= this.weaponAnimation.until) {
      this.weaponAnimation = {
        startedAt: this.game.simTime,
        until: this.game.simTime + weapon.frameCount / weapon.fps,
      };
    }
    const animationDelay = weapon ? weapon.releaseFrame / weapon.fps : 0;
    this.pendingShots.push({
      at: this.game.simTime + (delayIncludesAnimation ? Math.max(0, delay - animationDelay) : delay) + animationDelay,
      angle,
      options,
    });
  }

  _beginSpecialCharge(kind, delay, data = {}) {
    this.specialCharge = { kind, duration: delay, until: this.game.simTime + delay, ...data };
  }

  _fireKlaedBossPattern(player) {
    this._klaedPattern = (this._klaedPattern ?? 0) % 4 + 1;
    const facing = Math.atan2(player.y - this.y, player.x - this.x);

    if (this._klaedPattern <= 2) {
      this.fireTimer = 1.35;
      for (let lane = -1; lane <= 1; lane++) {
        this._queueWeaponShot(facing + lane * 0.18, {
          damageMult: 0.75,
          lane,
          facingAngle: facing,
        });
      }
      return;
    }

    if (this._klaedPattern === 3) {
      const charge = 0.46;
      this.fireTimer = 3.45;
      this._beginSpecialCharge("torpedo", charge);
      for (const lane of [-1, 1]) {
        this._queueWeaponShot(facing + lane * 0.09, {
          delay: charge,
          lane,
          facingAngle: facing,
          visualKey: "klaedTorpedo",
          skipWeaponAnimation: true,
        });
      }
      return;
    }

    // Three physical wave segments form a gate. The alternating broad safe
    // corridor is intentional: players read it first, then move into it.
    const charge = 0.72;
    const laneXs = [46, 128, 210, 292, 374];
    const safeLane = [0, 2, 4][(this._waveGateIndex = (this._waveGateIndex ?? -1) + 1) % 3];
    const activeLanes = safeLane === 0 ? [2, 3, 4] : safeLane === 2 ? [0, 1, 4] : [0, 1, 2];
    this.fireTimer = 4.9;
    this._beginSpecialCharge("wave", charge, { laneXs, activeLanes });
    for (const index of activeLanes) {
      this._queueWeaponShot(Math.PI / 2, {
        delay: charge,
        visualKey: "klaedWave",
        skipWeaponAnimation: true,
        // The gate forms below the dreadnought's hull, so every segment is
        // visible before it starts closing on the player.
        origin: { x: laneXs[index], y: this.y + 140 },
      });
    }
  }

  _fireNairanBossPattern(player) {
    this._bossPattern = (this._bossPattern ?? 0) + 1;
    const facing = Math.atan2(player.y - this.y, player.x - this.x);
    if (this.bossPhase === 1) {
      const charge = 0.72;
      this.fireTimer = 2.7;
      this._beginSpecialCharge("boss-target-lock", charge, {
        targetX: player.x, targetY: player.y, angle: facing,
      });
      for (const lane of [-1, 0, 1]) {
        this._queueWeaponShot(facing, {
          delay: charge,
          lane,
          facingAngle: facing,
          damageMult: lane === 0 ? 0.9 : 0.68,
          visualKey: "nairanBossPrecision",
          skipWeaponAnimation: true,
        });
      }
      return;
    }

    if (this.bossPhase === 2) {
      const charge = 0.98;
      const direction = this._bossPattern % 2 ? -1 : 1;
      const sweep = [-0.34, -0.17, 0, 0.17, 0.34].map(offset => offset * direction);
      this.fireTimer = 3.35;
      this._beginSpecialCharge("beam-sweep", charge, {
        angle: facing, offsets: sweep,
      });
      sweep.forEach((offset, index) => this._queueWeaponShot(facing + offset, {
        delay: charge + index * 0.11,
        facingAngle: facing + offset,
        damageMult: 0.68,
        visualKey: "nairanBossSweep",
        skipWeaponAnimation: true,
      }));
      return;
    }

    const laneXs = [46, 128, 210, 292, 374];
    const firstSafe = [1, 3, 2][(this._precisionGateIndex = (this._precisionGateIndex ?? -1) + 1) % 3];
    const secondSafe = firstSafe === 1 ? 3 : firstSafe === 3 ? 1 : (this._bossPattern % 2 ? 1 : 3);
    const safeSequence = [firstSafe, secondSafe];
    const charge = 0.92;
    this.fireTimer = 4.65;
    this._beginSpecialCharge("precision-salvo", charge + 0.72, {
      targetX: player.x, targetY: player.y, angle: facing, laneXs, safeSequence,
    });
    for (const offset of [-0.065, 0, 0.065]) {
      this._queueWeaponShot(facing + offset, {
        delay: charge,
        facingAngle: facing,
        damageMult: offset === 0 ? 0.84 : 0.6,
        visualKey: "nairanBossPrecision",
        skipWeaponAnimation: true,
      });
    }
    safeSequence.forEach((safeLane, waveIndex) => {
      laneXs.forEach((x, laneIndex) => {
        if (laneIndex === safeLane) return;
        this._queueWeaponShot(Math.PI / 2, {
          delay: charge + 0.38 + waveIndex * 0.44,
          damageMult: 0.62,
          visualKey: "nairanBossSweep",
          skipWeaponAnimation: true,
          origin: { x, y: this.y + 138 },
        });
      });
    });
  }

  _fireNautolanBossPattern(player) {
    this._bossPattern = (this._bossPattern ?? 0) + 1;
    if (this.bossPhase === 3) {
      const charge = 0.96;
      const laneXs = [46, 128, 210, 292, 374];
      const start = [1, 3, 2][(this._controlGateIndex = (this._controlGateIndex ?? -1) + 1) % 3];
      const direction = start === 3 ? -1 : 1;
      const safeSequence = Array.from({ length: 3 }, (_, step) =>
        1 + ((start - 1 + direction * step + 3) % 3));
      this.fireTimer = 5.1;
      this._beginSpecialCharge("wandering-control", charge + 1.0, { laneXs, safeSequence });
      safeSequence.forEach((safeLane, waveIndex) => {
        laneXs.forEach((x, laneIndex) => {
          if (laneIndex === safeLane) return;
          this._queueWeaponShot(Math.PI / 2, {
            delay: charge + waveIndex * 0.48,
            visualKey: "nautolanWave",
            skipWeaponAnimation: true,
            origin: { x, y: this.y + 136 },
          });
        });
      });
      return;
    }

    if (this.bossPhase === 2) {
      const charge = 0.82;
      const facing = Math.atan2(player.y - this.y, player.x - this.x);
      this.fireTimer = 3.9;
      this._beginSpecialCharge("support-barrage", charge, { angle: facing });
      for (const offset of [-0.42, -0.2, 0.2, 0.42]) {
        this._queueWeaponShot(facing + offset, {
          delay: charge + Math.abs(offset) * 0.32,
          facingAngle: facing,
          damageMult: 0.68,
          visualKey: "nautolanBoss",
          skipWeaponAnimation: true,
        });
      }
      return;
    }

    const charge = 0.68;
    const facing = Math.atan2(player.y - this.y, player.x - this.x);
    this.fireTimer = 3.35;
    this._beginSpecialCharge("anchor-bomb", charge, { targetX: player.x, targetY: player.y });
    for (const offset of [-0.18, 0, 0.18]) {
      this._queueWeaponShot(facing + offset, {
        delay: charge,
        facingAngle: facing,
        damageMult: 0.72,
        visualKey: "nautolanBoss",
        skipWeaponAnimation: true,
      });
    }
  }

  _fireVoidBossPattern(player) {
    this._bossPattern = (this._bossPattern ?? 0) + 1;
    if (this.bossPhase >= 2) {
      const charge = this.bossPhase === 3 ? 1.02 : 0.9;
      const laneXs = [48, 129, 210, 291, 372];
      const safeLane = [2, 1, 3][(this._voidGateIndex = (this._voidGateIndex ?? -1) + 1) % 3];
      const activeLanes = laneXs.map((_, index) => index).filter(index => index !== safeLane);
      const targetX = player.x;
      const targetY = player.y;
      const facing = Math.atan2(targetY - this.y, targetX - this.x);
      this.fireTimer = this.bossPhase === 3 ? 4.25 : 4.05;
      this._beginSpecialCharge(this.bossPhase === 3 ? "void-combo" : "void-rift", charge, {
        laneXs, activeLanes, safeLane, targetX, targetY, angle: facing,
      });
      for (const index of activeLanes) {
        this._queueWeaponShot(Math.PI / 2, {
          delay: charge,
          visualKey: "voidRift",
          skipWeaponAnimation: true,
          origin: { x: laneXs[index], y: this.y + 145 },
        });
      }
      if (this.bossPhase === 3) {
        for (const offset of [-0.065, 0, 0.065]) {
          this._queueWeaponShot(facing + offset, {
            delay: charge * 0.72,
            facingAngle: facing,
            damageMult: offset === 0 ? 0.78 : 0.56,
            visualKey: "voidLance",
            skipWeaponAnimation: true,
          });
        }
      }
      return;
    }

    const charge = 0.86;
    const targetX = player.x;
    const targetY = player.y;
    const facing = Math.atan2(targetY - this.y, targetX - this.x);
    this.fireTimer = 2.85;
    this._beginSpecialCharge("void-lock", charge, { targetX, targetY, angle: facing });
    for (const offset of [-0.07, 0, 0.07]) {
      this._queueWeaponShot(facing + offset, {
        delay: charge,
        facingAngle: facing,
        damageMult: offset === 0 ? 0.85 : 0.62,
        visualKey: "voidLance",
        skipWeaponAnimation: true,
      });
    }
  }

  _summonBossSupport() {
    if (this.type !== "nautolanDreadnought" || this._bossSupportSummoned) return;
    const existing = this.game.enemies.some(enemy => !enemy.dead && enemy.type === "nautolanSupport");
    this._bossSupportSummoned = true;
    if (existing) return;
    const side = this.bossPhase % 2 ? -1 : 1;
    const support = this.game.spawnEnemy("nautolanSupport", false, 1, null, {
      x: clamp(this.x + side * 112, 54, CONFIG.designW - 54),
      y: clamp(this.y + 12, 110, 330),
      fireLockedUntil: Number.POSITIVE_INFINITY,
      encounterId: "boss-support-phase",
    });
    support.fireTimer = Number.MAX_VALUE;
    support._refreshSupportTargets();
  }

  _syncBossPhase() {
    if (!this.boss || !this.bossProfile?.phaseThresholds?.length || this.dead || this.hp <= 0) return;
    const hpFraction = Math.max(0, this.hp / this.maxHp);
    const threshold = this.bossProfile.phaseThresholds[this.bossPhase - 1];
    if (threshold === undefined || hpFraction > threshold) return;
    this._enterBossPhase(this.bossPhase + 1);
  }

  _enterBossPhase(nextPhase) {
    if (!this.boss || nextPhase <= this.bossPhase) return;
    this.bossPhase = nextPhase;
    this.pendingShots = [];
    this.weaponAnimation = null;
    const pause = this.bossProfile?.phasePause ?? 1.25;
    this.phaseTransitionStartedAt = this.game.simTime;
    this.phaseTransitionDuration = pause;
    this.phaseTransitionUntil = this.game.simTime + pause;
    // The timer is frozen during the interruption; resume with only a short
    // readable beat before the new pattern begins.
    this.fireTimer = 0.35;
    this._beginSpecialCharge("phase-shift", pause, { phase: this.bossPhase });
    if (this.type === "nautolanDreadnought" && this.bossPhase === 2) {
      this.shield = Math.max(this.shield, this.maxShield * 0.35);
      this._summonBossSupport();
    } else if (this.type === "nautolanDreadnought" && this.bossPhase === 3) {
      for (const support of this.game.enemies.filter(enemy =>
        !enemy.dead && enemy.type === "nautolanSupport" && enemy.encounterId === "boss-support-phase")) {
        support.dead = true;
        for (const target of support.supportTargets) {
          if (target.supportSource === support) target.supportSource = null;
        }
        support.supportTargets = [];
      }
    }
    for (const projectile of this.game.projectiles) {
      if (projectile.owner === "enemy") projectile.dead = true;
    }
    const aura = this._bossAura();
    this.game.sounds?.play("phase");
    this.game.burst(this.x, this.y, aura, 32);
    this.game.shake = Math.max(this.game.shake, 7);
  }

  _updateBossMovement(dt) {
    const movement = this.bossProfile?.movement;
    let holdX = CONFIG.designW / 2;
    let holdY = 180;
    if (movement === "broad-sweep") {
      holdX += Math.sin(this.game.simTime * 0.44 + this.wobble) * 78;
      holdY = 178;
    } else if (movement === "lateral-lancer") {
      holdX += Math.sin(this.game.simTime * 0.72 + this.wobble) * 112;
      holdY = 170;
    } else if (movement === "anchored-control") {
      holdX += Math.sin(this.game.simTime * 0.28 + this.wobble) * 28;
      holdY = 174;
    } else if (movement === "void-orbit") {
      holdX += Math.sin(this.game.simTime * 0.38 + this.wobble) * 88;
      holdY = 160 + Math.sin(this.game.simTime * 0.57 + this.wobble) * 24;
    }
    this.x = lerp(this.x, holdX, clamp(dt * 1.25, 0, 1));
    this.y = lerp(this.y, holdY, clamp(dt * (this.y < 0 ? 2.2 : 0.82), 0, 1));
  }

  _releaseQueuedShots() {
    for (let i = this.pendingShots.length - 1; i >= 0; i--) {
      const shot = this.pendingShots[i];
      if (shot.at > this.game.simTime) continue;
      this.pendingShots.splice(i, 1);
      if (!this.dead) this._spawnWeaponShot(shot.angle, shot.options);
    }
  }

  _isFullyOnscreen() {
    return this.x - this.r >= 0 && this.x + this.r <= CONFIG.designW &&
      this.y - this.r >= 0 && this.y + this.r <= CONFIG.designH;
  }

  _refreshSupportTargets() {
    for (const target of this.supportTargets) {
      if (target.supportSource === this) target.supportSource = null;
    }
    const candidates = this.game.enemies
      .filter(enemy => enemy !== this && !enemy.dead && (!enemy.boss || enemy.protectableBySupport) && enemy.type !== "nautolanSupport")
      .filter(enemy => dist2(this.x, this.y, enemy.x, enemy.y) <= 210 ** 2)
      .sort((a, b) => (b.maxHp - a.maxHp) ||
        (dist2(this.x, this.y, a.x, a.y) - dist2(this.x, this.y, b.x, b.y)));
    this.supportTargets = candidates.slice(0, 1);
    for (const target of this.supportTargets) target.supportSource = this;
  }

  _updateSupportMovement(dt) {
    this.supportRefreshTimer -= dt;
    if (this.supportRefreshTimer <= 0 || this.supportTargets.some(target => target.dead)) {
      this.supportRefreshTimer = 0.2;
      this._refreshSupportTargets();
    }
    if (!this.supportTargets.length) {
      this.y = lerp(this.y, 220, clamp(dt * 0.8, 0, 1));
      return;
    }
    const centerX = this.supportTargets.reduce((sum, target) => sum + target.x, 0) / this.supportTargets.length;
    const centerY = this.supportTargets.reduce((sum, target) => sum + target.y, 0) / this.supportTargets.length;
    const side = Math.sin(this.wobble) < 0 ? -1 : 1;
    const targetX = clamp(centerX + side * 76, 58, CONFIG.designW - 58);
    const targetY = clamp(centerY - 8, 105, 390);
    this.x = lerp(this.x, targetX, clamp(dt * 1.15, 0, 1));
    this.y = lerp(this.y, targetY, clamp(dt * 1.15, 0, 1));
  }

  update(dt) {
    const p = this.game.player;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this._releaseQueuedShots();

    if (this.encounterId === "pursuit-pressure" && !this.flyby &&
        (this.game.simTime >= this.pursuitUntil || this.y > p.y + 48)) {
      // Hunters get one readable interception pass. Once they have crossed
      // behind the player or tracked for six seconds they disengage instead
      // of circling back into a permanent homing pile.
      const side = this.x < p.x ? -1 : 1;
      this.encounterId = "pursuit-exit";
      this.flyby = {
        vx: side * this.speed * 0.45,
        vy: this.speed * 1.05,
        sineAmp: 0,
        sineFreq: 0,
      };
      this._flybyT = 0;
    }

    if (this.type === "nautolanSupport") {
      this._updateSupportMovement(dt);
    } else if (this.boss) {
      this._updateBossMovement(dt);
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
      const side = Math.sin(this.game.simTime * 2 + this.wobble) * 28;
      this.x += Math.cos(a) * this.speed * dt + Math.cos(a + Math.PI / 2) * side * dt;
      this.y += Math.sin(a) * this.speed * dt + Math.sin(a + Math.PI / 2) * side * dt;
    }

    if (!this._isPhaseTransitioning()) this.fireTimer -= dt;
    if (this.boss && !this._isPhaseTransitioning() && this.fireTimer <= 0) {
      if (this.type === "dreadnought") this._fireKlaedBossPattern(p);
      else if (this.type === "nairanDreadnought") this._fireNairanBossPattern(p);
      else if (this.type === "nautolanDreadnought") this._fireNautolanBossPattern(p);
      else if (this.type === "voidSovereign") this._fireVoidBossPattern(p);
      else this.fireTimer = 1;
    } else if (!this.boss && this.game.simTime >= this.fireLockedUntil && Enemy._canFire(this.type) && this.fireTimer <= 0) {
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      const isKlaedBattlecruiser = this.type === "battlecruiser";
      const isNairanPrecision = this.type.startsWith("nairan");
      this._battlecruiserVolley = isKlaedBattlecruiser ? (this._battlecruiserVolley ?? 0) + 1 : 0;
      const firesTorpedo = isKlaedBattlecruiser && this._battlecruiserVolley % 3 === 0;
      this.fireTimer = firesTorpedo ? 4.2 : this.weaponProfile.cooldown;
      if (this.type === "nairanTorpedoShip") {
        if (!this._isFullyOnscreen()) {
          this.fireTimer = 0.18;
        } else {
          const charge = 1.05;
          const targetX = p.x;
          const targetY = p.y;
          const fixedAngle = Math.atan2(targetY - this.y, targetX - this.x);
          this.fireTimer = this.weaponProfile.cooldown;
          this._beginSpecialCharge("torpedo-lock", charge, { targetX, targetY, angle: fixedAngle });
          this._queueWeaponShot(fixedAngle, {
            delay: charge,
            delayIncludesAnimation: true,
            facingAngle: fixedAngle,
            visualKey: "nairanTorpedoShip",
          });
        }
      } else if (firesTorpedo) {
        const charge = 0.46;
        this._beginSpecialCharge("torpedo", charge);
        this._queueWeaponShot(ang, { delay: charge, visualKey: "klaedTorpedo", skipWeaponAnimation: true });
      } else if (isNairanPrecision) {
        // Nairan fire commits to the player's marked position. The short lock
        // rewards a late sidestep instead of constant movement or guessing.
        const charge = 0.42;
        this._beginSpecialCharge("precision", charge, { targetX: p.x, targetY: p.y });
        this._queueWeaponShot(ang, {
          delay: charge,
          skipWeaponAnimation: true,
          facingAngle: ang,
        });
      } else {
        this._queueWeaponShot(ang);
      }
    }

    if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
      p.damage(this.damagePower, { kind: "collision", type: this.type, boss: this.boss });
      if (this.game.state !== "playing") return;
      this.damage(this.boss ? 4 : 999);
    }

    if (!this.boss) {
      const margin = this.flyby ? 220 : 160;
      if (this.x < -margin || this.x > CONFIG.designW + margin ||
          this.y < -margin || this.y > CONFIG.designH + margin) {
        this.dead = true;
        this.game.runStats?.enemyEscape?.(this.game, this);
      }
    }
  }

  damage(amount) {
    if (this.dead) return;
    if (this._isPhaseTransitioning()) {
      this.shieldFlash = Math.max(this.shieldFlash, 0.2);
      return;
    }
    const support = this.supportSource;
    if (support && !support.dead && support.supportTargets.includes(this) &&
        dist2(this.x, this.y, support.x, support.y) <= 210 ** 2) {
      amount *= 0.55;
    }
    const absorbed = Math.min(this.shield, amount);
    this.shield -= absorbed;
    if (absorbed > 0) this.shieldFlash = 0.72;
    let hullDamage = amount - absorbed;
    if (this.boss && hullDamage > 0) {
      const nextThreshold = this.bossProfile?.phaseThresholds?.[this.bossPhase - 1];
      if (nextThreshold !== undefined) {
        const thresholdHp = this.maxHp * nextThreshold;
        hullDamage = Math.min(hullDamage, Math.max(0, this.hp - thresholdHp));
      }
    }
    this.hp -= hullDamage;
    this.hitFlash = 0.11;
    this.game.burst(this.x, this.y, CONFIG.colors.cyan, 5);
    this._syncBossPhase();
    if (this.hp <= 0) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this.type === "nautolanSupport") {
      for (const target of this.supportTargets) {
        if (target.supportSource === this) target.supportSource = null;
      }
      this.supportTargets = [];
    }
    this.game.spawnEnemyDestruction(this);
    this.game.score += this.score;
    this.game.kills++;
    this.game.runStats?.enemyKill?.(this.game, this);
    this.game.sounds?.play("kill");
    const wasBoss = this.boss;
    if (wasBoss) this.game.onBossKilled(this.x, this.y, this.bossProfile?.bossXp ?? 12, this.bossProfile);
    else {
      // Score escalation rewards later-sector execution without accelerating
      // XP progression or increasing utility-pickup frequency.
      this.game.dropXp(this.x, this.y, 1 + Math.floor(this.baseScore / 70));
      this.game.maybeDropCombatPickup(this);
    }
    if (this.type === "voidSovereign") {
      for (const [ox, oy, size] of [[0, 0, 64], [-48, 18, 28], [46, 12, 28], [0, -42, 34]]) {
        this.game.explosion(this.x + ox, this.y + oy, size);
        this.game.burst(this.x + ox, this.y + oy, "#b54878", Math.round(size * 0.36));
      }
    } else {
      this.game.explosion(this.x, this.y, wasBoss ? 42 : 22);
    }
    this.game.deathBurst(this);
    this.game.shake = Math.max(this.game.shake, wasBoss ? 10 : 3);
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

    this._drawStrip(ctx, img.get(this.visual?.engine?.assetKey), this.visual?.frame, this.visual?.engine, this.game.simTime, size);

    // Boss: tight pulsing aura behind sprite — no big bubble for normal enemies
    if (this.boss) {
      const pulse = 0.28 + Math.sin(this.game.simTime * 4) * 0.08;
      ctx.globalAlpha = pulse;
      const auraColor = this._bossAura();
      ctx.fillStyle = auraColor;
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (this.type === "voidSovereign") {
        ctx.save();
        ctx.rotate(this.game.simTime * 0.32);
        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = "#b34770";
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 12, 7, 11]);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.59, size * 0.46, 0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#6e244d";
        for (let i = 0; i < 3; i++) {
          const angle = i * Math.PI * 2 / 3;
          ctx.save();
          ctx.rotate(angle);
          ctx.translate(size * 0.60, 0);
          ctx.beginPath();
          ctx.moveTo(11, 0); ctx.lineTo(-8, -6); ctx.lineTo(-4, 0); ctx.lineTo(-8, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }

    if (this.specialCharge && this.game.simTime < this.specialCharge.until) {
      const progress = 1 - (this.specialCharge.until - this.game.simTime) /
        (this.specialCharge.duration || (this.specialCharge.kind === "wave" ? 0.72 : 0.46));
      ctx.save();
      // Draw telegraphs in world orientation after undoing the ship rotation.
      ctx.rotate(-drawAngle);
      ctx.globalCompositeOperation = "lighter";
      if (this.specialCharge.kind === "phase-shift") {
        ctx.globalAlpha = 0.26 + progress * 0.5;
        ctx.strokeStyle = this._bossAura();
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        for (const radius of [42 + progress * 34, 68 + progress * 48]) {
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (this.specialCharge.kind === "wave") {
        const alpha = 0.22 + progress * 0.38;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ff8b35";
        ctx.shadowColor = "#ff5428";
        ctx.shadowBlur = 7;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        for (const index of this.specialCharge.activeLanes) {
          const x = this.specialCharge.laneXs[index] - this.x;
          ctx.strokeRect(x - 29, 112, 58, CONFIG.designH - this.y - 102);
        }
        ctx.setLineDash([]);
      } else if (this.specialCharge.kind === "precision" || this.specialCharge.kind === "boss-target-lock") {
        const tx = this.specialCharge.targetX - this.x;
        const ty = this.specialCharge.targetY - this.y;
        ctx.globalAlpha = 0.22 + progress * 0.45;
        ctx.strokeStyle = "#d8a2ff";
        ctx.shadowColor = "#a84cff";
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 7]);
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, ty, 9 - progress * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tx - 13, ty); ctx.lineTo(tx - 5, ty);
        ctx.moveTo(tx + 5, ty); ctx.lineTo(tx + 13, ty);
        ctx.moveTo(tx, ty - 13); ctx.lineTo(tx, ty - 5);
        ctx.moveTo(tx, ty + 5); ctx.lineTo(tx, ty + 13);
        ctx.stroke();
        if (this.specialCharge.kind === "boss-target-lock") {
          ctx.globalAlpha = 0.16 + progress * 0.24;
          ctx.fillStyle = "#bd65ff";
          ctx.beginPath();
          ctx.arc(tx, ty, 20 - progress * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.specialCharge.kind === "beam-sweep") {
        const length = CONFIG.designH;
        ctx.globalAlpha = 0.16 + progress * 0.42;
        ctx.strokeStyle = "#dca7ff";
        ctx.shadowColor = "#a84cff";
        ctx.shadowBlur = 7;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 7]);
        for (const offset of this.specialCharge.offsets) {
          const angle = this.specialCharge.angle + offset;
          ctx.beginPath();
          ctx.moveTo(0, 22);
          ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else if (this.specialCharge.kind === "precision-salvo") {
        const tx = this.specialCharge.targetX - this.x;
        const ty = this.specialCharge.targetY - this.y;
        const activeStep = Math.min(1, Math.floor(progress * 2));
        const safeLane = this.specialCharge.safeSequence[activeStep];
        ctx.globalAlpha = 0.3 + progress * 0.38;
        ctx.strokeStyle = "#f1c5ff";
        ctx.shadowColor = "#b65cff";
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        for (let index = 0; index < this.specialCharge.laneXs.length; index++) {
          const x = this.specialCharge.laneXs[index] - this.x;
          if (index === safeLane) continue;
          ctx.strokeRect(x - 28, 112, 56, CONFIG.designH - this.y - 102);
        }
        const safeX = this.specialCharge.laneXs[safeLane] - this.x;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.18 + progress * 0.13;
        ctx.fillStyle = "#8060b8";
        ctx.fillRect(safeX - 34, 112, 68, CONFIG.designH - this.y - 102);
      } else if (this.specialCharge.kind === "support-barrage") {
        ctx.globalAlpha = 0.24 + progress * 0.48;
        ctx.strokeStyle = "#91ffe0";
        ctx.shadowColor = "#27d6a6";
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 7]);
        for (const offset of [-0.42, -0.2, 0.2, 0.42]) {
          const angle = this.specialCharge.angle + offset;
          ctx.beginPath();
          ctx.moveTo(0, 22);
          ctx.lineTo(Math.cos(angle) * CONFIG.designH, Math.sin(angle) * CONFIG.designH);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else if (this.specialCharge.kind === "wandering-control") {
        const activeStep = Math.min(2, Math.floor(progress * 3));
        const safeLane = this.specialCharge.safeSequence[activeStep];
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 6]);
        for (let index = 0; index < this.specialCharge.laneXs.length; index++) {
          const x = this.specialCharge.laneXs[index] - this.x;
          if (index === safeLane) continue;
          ctx.globalAlpha = 0.24 + progress * 0.36;
          ctx.strokeStyle = "#60f0c0";
          ctx.strokeRect(x - 28, 112, 56, CONFIG.designH - this.y - 102);
        }
        const safeX = this.specialCharge.laneXs[safeLane] - this.x;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.16 + progress * 0.12;
        ctx.fillStyle = "#36a985";
        ctx.fillRect(safeX - 34, 112, 68, CONFIG.designH - this.y - 102);
      } else if (["control-gate", "void-rift", "void-combo"].includes(this.specialCharge.kind)) {
        const voidGate = this.specialCharge.kind !== "control-gate";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        for (const index of this.specialCharge.activeLanes) {
          const x = this.specialCharge.laneXs[index] - this.x;
          ctx.globalAlpha = 0.20 + progress * 0.34;
          ctx.strokeStyle = voidGate ? "#e05b82" : "#60f0c0";
          ctx.strokeRect(x - 28, 112, 56, CONFIG.designH - this.y - 102);
        }
        const safeX = this.specialCharge.laneXs[this.specialCharge.safeLane] - this.x;
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.10 + progress * 0.12;
        ctx.fillStyle = voidGate ? "#8d3559" : "#36a985";
        ctx.fillRect(safeX - 34, 112, 68, CONFIG.designH - this.y - 102);
        if (this.specialCharge.kind === "void-combo") {
          const tx = this.specialCharge.targetX - this.x;
          const ty = this.specialCharge.targetY - this.y;
          ctx.globalAlpha = 0.48 + progress * 0.3;
          ctx.strokeStyle = "#ff9db7";
          ctx.shadowColor = "#d34768";
          ctx.shadowBlur = 7;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(0, 22);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (this.specialCharge.kind === "anchor-bomb") {
        const tx = this.specialCharge.targetX - this.x;
        const ty = this.specialCharge.targetY - this.y;
        ctx.globalAlpha = 0.28 + progress * 0.5;
        ctx.strokeStyle = "#78ffcf";
        ctx.shadowColor = "#22bf91";
        ctx.shadowBlur = 7;
        ctx.lineWidth = 2;
        for (const radius of [12, 22]) {
          ctx.beginPath();
          ctx.arc(tx, ty, radius - progress * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (this.specialCharge.kind === "torpedo-lock") {
        const length = CONFIG.designH * 1.05;
        const dirX = Math.cos(this.specialCharge.angle);
        const dirY = Math.sin(this.specialCharge.angle);
        const sideX = -dirY * 18;
        const sideY = dirX * 18;
        ctx.globalAlpha = 0.12 + progress * 0.18;
        ctx.fillStyle = "#d56cff";
        ctx.beginPath();
        ctx.moveTo(sideX, sideY);
        ctx.lineTo(dirX * length + sideX, dirY * length + sideY);
        ctx.lineTo(dirX * length - sideX, dirY * length - sideY);
        ctx.lineTo(-sideX, -sideY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.5 + progress * 0.35;
        ctx.strokeStyle = "#f1b1ff";
        ctx.shadowColor = "#b84cff";
        ctx.shadowBlur = 7;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 6]);
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sideX * sign, sideY * sign);
          ctx.lineTo(dirX * length + sideX * sign, dirY * length + sideY * sign);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else if (this.specialCharge.kind === "void-lock") {
        const length = CONFIG.designH * 1.05;
        const dirX = Math.cos(this.specialCharge.angle);
        const dirY = Math.sin(this.specialCharge.angle);
        const sideX = -dirY * 21;
        const sideY = dirX * 21;
        ctx.globalAlpha = 0.11 + progress * 0.20;
        ctx.fillStyle = "#a52f5c";
        ctx.beginPath();
        ctx.moveTo(sideX, sideY);
        ctx.lineTo(dirX * length + sideX, dirY * length + sideY);
        ctx.lineTo(dirX * length - sideX, dirY * length - sideY);
        ctx.lineTo(-sideX, -sideY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.48 + progress * 0.38;
        ctx.strokeStyle = "#f08aaa";
        ctx.setLineDash([8, 6]);
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sideX * sign, sideY * sign);
          ctx.lineTo(dirX * length + sideX * sign, dirY * length + sideY * sign);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        ctx.globalAlpha = 0.35 + progress * 0.45;
        ctx.fillStyle = "#ffb06a";
        ctx.shadowColor = "#ff5428";
        ctx.shadowBlur = 14;
        for (const x of [-15, 15]) {
          ctx.beginPath();
          ctx.arc(x, 28, 4 + progress * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
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
    if (weapon && this.weaponAnimation && this.game.simTime < this.weaponAnimation.until) {
      this._drawStrip(ctx, img.get(weapon.assetKey), this.visual.frame, weapon, this.game.simTime - this.weaponAnimation.startedAt, size);
    }

    if (this.visual?.shield && this.shield > 0 && this.shieldFlash > 0) {
      const shieldAlpha = (0.18 + 0.42 * (this.shield / this.maxShield)) * (this.shieldFlash / 0.72);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = shieldAlpha;
      this._drawStrip(ctx, img.get(this.visual.shield.assetKey), this.visual.frame, this.visual.shield, this.game.simTime, size * 1.12);
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
      ctx.globalAlpha = 0.5 + Math.sin(this.game.simTime * 5) * 0.15;
      ctx.strokeStyle = this._bossAura();
      ctx.lineWidth = 1.8;
      ctx.shadowColor = ctx.strokeStyle;
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
    const sourceFrame = animation.frameSize || frameSize;
    const frame = Math.min(animation.frameCount - 1, Math.floor(time * animation.fps) % animation.frameCount);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(image, frame * sourceFrame, 0, sourceFrame, sourceFrame, -targetSize / 2, -targetSize / 2, targetSize, targetSize);
    ctx.restore();
  }
}

Enemy._canFire = function(type) {
  return /bomber|frigate|battlecruiser|dreadnought|torpedoShip/i.test(type);
};

Enemy._projVisual = function(type, boss) {
  if (boss) {
    if (type === "voidSovereign") return "voidBoss";
    if (type.startsWith("nairan"))   return "nairanBoss";
    if (type.startsWith("nautolan")) return "nautolanBoss";
    return "klaedBoss";
  }
  // Per-class mapping (suffix after fleet prefix)
  const cls = type.replace(/^nairan|^nautolan/, "") || type; // bare klaed types have no prefix
  if (type.startsWith("nairan")) {
    if (cls === "TorpedoShip")  return "nairanTorpedoShip";
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
  nairanTorpedoShip:  { hp: 158, speed: 44,  r: 32, damage: 24, score: 185, img: "nairanTorpedoShip", shield: 44 },

  // Nautolan Fleet 3 — slower, tankier, heavier damage
  nautolanScout:        { hp: 32,  speed: 90,  r: 19, damage: 13, score: 30,  img: "nautolanScout" },
  nautolanFighter:      { hp: 58,  speed: 74,  r: 23, damage: 18, score: 58,  img: "nautolanFighter" },
  nautolanBomber:       { hp: 110, speed: 46,  r: 30, damage: 25, score: 115, img: "nautolanBomber" },
  nautolanFrigate:      { hp: 160, speed: 38,  r: 36, damage: 28, score: 165, img: "nautolanFrigate" },
  nautolanBattlecruiser:{ hp: 250, speed: 28,  r: 44, damage: 34, score: 280, img: "nautolanBattlecruiser" },
  nautolanDreadnought:  { hp: 360, speed: 22,  r: 54, damage: 40, score: 560, img: "nautolanDreadnought" },
  nautolanSupport:      { hp: 84,  speed: 48,  r: 29, damage: 12, score: 145, img: "nautolanSupport" },

  // The finale uses the Nautolan capital-ship layers as a base, then adds a
  // dedicated profile, larger silhouette and Void aura in the renderer.
  voidSovereign:        { hp: 520, speed: 25, r: 60, damage: 46, score: 900, img: "nautolanDreadnought" }
};
