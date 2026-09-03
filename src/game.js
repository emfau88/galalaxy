import { CONFIG, RENDER_CONFIG, STRIP_RATIO, SECTORS } from "./config.js";
import { ASSETS } from "./assets.js";
import { $, clamp, fmtTime } from "./utils.js";
import { AssetLoader } from "./assetLoader.js";
import { SaveSystem } from "./saveSystem.js";
import { Input } from "./input.js";
import { Player } from "./entities/player.js";
import { Enemy } from "./entities/enemy.js";
import { Projectile } from "./entities/projectile.js";
import { XpPickup } from "./entities/pickup.js";
import { Particle } from "./entities/particle.js";
import { UpgradeSystem } from "./systems/upgrades.js";
import { FLEETS, pickFleetEnemy, pickSoloEnemy } from "./data/fleets.js";
import { emitTrail, spawnHitSparks, spawnDeathBurst, emitSectorDust, spawnBossEntrance } from "./systems/fx.js";
import { drawPulse } from "./systems/abilities.js";
import { enemyVisualFor } from "./data/enemyVisuals.js";

const PLAYER_VISUAL_TEST_STAGES = [
  { title: "STARTER SHIP", detail: "Base Engine · integrated starter weapon · no shield module", player: {} },
  { title: "ENGINE BOOST I", detail: "Big Pulse Engine · powered exhaust", player: { speedLevel: 1 } },
  { title: "ENGINE BOOST II", detail: "Burst Engine · powered exhaust", player: { speedLevel: 2 } },
  { title: "ENGINE BOOST III", detail: "Supercharged Engine · powered exhaust", player: { speedLevel: 3 } },
  { title: "AUTO CANNON", detail: "Appears after Fire Rate or Multi Cannon", weapon: "auto", player: { fireLevel: 1 } },
  { title: "SHIELD UPGRADE I", detail: "Front Shield", player: { shieldLevel: 1 } },
  { title: "SHIELD UPGRADE II", detail: "Front and Side Shield", player: { shieldLevel: 2 } },
  { title: "SHIELD UPGRADE III", detail: "Round Shield", player: { shieldLevel: 3 } },
  { title: "ROCKET BUILD", detail: "Rocket launcher firing cycle", weapon: "rockets", player: { rocket: 3, barrage: 2, speedLevel: 2, shieldLevel: 1 } },
  { title: "ZAPPER BUILD", detail: "Zapper firing cycle", weapon: "zapper", player: { zapper: 4, speedLevel: 2, shieldLevel: 2 } },
  { title: "BIG SPACE GUN", detail: "Big Space Gun firing cycle", weapon: "bigGun", player: { beam: 2, speedLevel: 3, shieldLevel: 2 } },
  { title: "INVINCIBILITY", detail: "Invincibility Shield hit state", player: { speedLevel: 3, shieldLevel: 2, invuln: 999 } },
];

export class Game {
  constructor() {
    this.canvas = $("game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.loader = new AssetLoader(ASSETS);
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.state = "loading";
    this.prevState = "title";
    this.last = performance.now();
    this.time = 0;
    const searchParams = new URLSearchParams(window.location.search);
    this.visualTestMode = searchParams.get("test") === "upgrade-visuals";
    this.upgradeCardTestMode = searchParams.get("test") === "upgrade-cards";
    this.klaedTestMode = searchParams.get("test") === "klaed-combat";
    this.nairanTestMode = searchParams.get("test") === "nairan-combat";
    this.nautolanTestMode = searchParams.get("test") === "nautolan-combat";
    this.hudTestMode = searchParams.get("test") === "hud-layout";
    this.upgradeCardTestRocketMode = searchParams.get("upgradeFamily") === "rocket";
    if (searchParams.has("test")) window.__galalaxyTestGame = this;
    const requestedStage = Number.parseInt(searchParams.get("stage"), 10);
    this.visualTestStartIndex = Number.isFinite(requestedStage)
      ? Math.max(0, Math.min(PLAYER_VISUAL_TEST_STAGES.length - 1, requestedStage))
      : 0;
    this.visualTestIndex = 0;
    this.visualTestTimer = 0;
    this.visualTestWeaponTimer = 0;
    this.runTime = 0;
    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 8;
    this.best = SaveSystem.best();
    this.shake = 0;
    this.spawnTimer = 0;
    this.currentSectorIndex = 0;
    this.sectorTimer = SECTORS[0].duration;
    this.bossActive = false;
    this.bossWarning = 0;
    this.sectorTransition = 0;
    this.bossRewardTimer = 0;
    this.bossRewardData = null;
    this.titleTime = 0;
    this.musicMuted = false;
    this._music = new Audio("assets/music/track1.ogg");
    this._music.loop = true;
    this._music.volume = 0.28;
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.zaps = [];
    this.enemyDeaths = [];
    this.stars = [];
    this.asteroids = [];
    this.upgrades = new UpgradeSystem(this);
    this.input = new Input(this.canvas, this);

    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") {
        this.prevState = this.state;
        this.state = "paused";
      }
    });

    // Mute button exclusion zone — bottom-right, 48×48 design-px hit area
    const MBX = CONFIG.designW - 52, MBY = CONFIG.designH - 52;
    this._muteBtnZone = { x: MBX, y: MBY, w: 48, h: 48 };
    this.input.exclusionZones.push(this._muteBtnZone);

    this.initStars();
    this.loader.load().then(() => {
      if (this.state !== "loading") return;
      if (this.visualTestMode) this.startVisualTest();
      else if (this.upgradeCardTestMode) this.startUpgradeCardTest();
      else if (this.klaedTestMode) this.startKlaedCombatTest();
      else if (this.nairanTestMode) this.startFleetCombatTest("nairan");
      else if (this.nautolanTestMode) this.startFleetCombatTest("nautolan");
      else if (this.hudTestMode) this.startHudLayoutTest();
      else this.state = "title";
    });

    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    const deviceDpr = window.devicePixelRatio || 1;
    // On phones the expensive part is not simulation, but compositing many
    // glow-heavy sprites at a full 2× canvas. Pixel art remains crisp at 1.5×
    // while this cuts the backing-store work by roughly 44% versus 2×.
    this.lowEffects = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    this.renderDpr = Math.min(this.lowEffects ? 1.5 : 2, deviceDpr);
    this.particleCap = this.lowEffects ? 96 : CONFIG.particleCap;
    this.zapCap = this.lowEffects ? 10 : 28;
    this.canvas.width = Math.floor(window.innerWidth * this.renderDpr);
    this.canvas.height = Math.floor(window.innerHeight * this.renderDpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.renderDpr, this.renderDpr);

    const sw = window.innerWidth;
    const sh = window.innerHeight;
    this.scale = Math.min(sw / CONFIG.designW, sh / CONFIG.designH);
    this.offsetX = (sw - CONFIG.designW * this.scale) / 2;
    this.offsetY = (sh - CONFIG.designH * this.scale) / 2;
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * CONFIG.designW,
        y: Math.random() * CONFIG.designH,
        s: Math.random() * 1.8 + 0.5,
        v: Math.random() * 26 + 10,
        a: Math.random() * 0.7 + 0.25
      });
    }
    this.asteroids = [];
    for (let i = 0; i < 8; i++) {
      this.asteroids.push({
        x: Math.random() * CONFIG.designW,
        y: Math.random() * CONFIG.designH,
        s: Math.random() * 42 + 26,
        v: Math.random() * 18 + 8,
        r: Math.random() * Math.PI
      });
    }
  }

  startRun() {
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.zaps = [];
    this.enemyDeaths = [];
    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 8;
    this.runTime = 0;
    this.spawnTimer = 0.6;
    this.currentSectorIndex = 0;
    this.sectorTimer = SECTORS[0].duration;
    this.bossActive = false;
    this.bossWarning = 0;
    this.sectorTransition = 0;
    this.evolutionFlash = 0;
    this.bossRewardTimer = 0;
    this.bossRewardData = null;
    this.shake = 0;
    this.upgrades._pickCount = 0;
    this.state = "playing";
  }

  startVisualTest() {
    this.state = "visualTest";
    this.visualTestIndex = this.visualTestStartIndex;
    this._applyVisualTestStage();
  }

  startUpgradeCardTest() {
    this.player = new Player(this);
    Object.assign(this.player, { speedLevel: 1, shieldLevel: 1, fireLevel: 1, rocket: 1, zapper: 1 });
    this.player.speed = 386;
    this.player.maxShield = 67;
    this.player.shield = this.player.maxShield;
    const wanted = new Set(this.upgradeCardTestRocketMode
      ? ["rocket", "hp", "magnet"]
      : ["speed", "shield", "beam"]);
    this.upgrades.choices = this.upgrades.pool.filter(upgrade => wanted.has(upgrade.id));
    const w = 370, h = 142;
    this.upgrades.cards = this.upgrades.choices.map((_, index) => ({
      x: (CONFIG.designW - w) / 2, y: 190 + index * 155, w, h,
    }));
    this.state = "levelUp";
  }

  startKlaedCombatTest() {
    this.startFleetCombatTest("");
  }

  startFleetCombatTest(fleet) {
    this.startRun();
    this.bossActive = true; // prevent the normal sector spawner in this QA scene
    this.currentSectorIndex = fleet === "nairan" ? 1 : fleet === "nautolan" ? 2 : 0;
    this.sectorTimer = SECTORS[this.currentSectorIndex].duration;
    this.player.x = CONFIG.designW / 2;
    this.player.y = 620;
    // The QA ship observes rather than clearing the fleet, so the authored
    // weapon timings and projectile release frames remain visible.
    this.player.fireTimer = Number.MAX_VALUE;
    this.player.invuln = Number.POSITIVE_INFINITY;
    this.player.shieldLevel = 2;
    this.player.maxShield = 79;
    this.player.shield = this.player.maxShield;
    const type = name => `${fleet}${name}`;
    this.enemies = [
      new Enemy(this, type("frigate"), 90, 230),
      new Enemy(this, type("battlecruiser"), 330, 270),
      new Enemy(this, type("dreadnought"), 210, 105, true),
    ];
    for (const enemy of this.enemies) enemy.fireTimer = 0.35;
  }

  startHudLayoutTest() {
    this.startRun();
    this.currentSectorIndex = 2;
    this.sectorTimer = SECTORS[this.currentSectorIndex].duration;
    Object.assign(this.player, {
      x: CONFIG.designW / 2,
      y: 620,
      speedLevel: 3,
      shieldLevel: 3,
      fireLevel: 2,
      twin: 1,
      rocket: 2,
      zapper: 2,
      beam: 1,
      pulse: 1,
      hpLevel: 1,
      magnet: 1,
      speed: 438,
      maxShield: 103,
      shield: 74,
      fireTimer: Number.MAX_VALUE,
      invuln: Number.POSITIVE_INFINITY,
      _beamCooldown: 2.6,
      _pulseCooldown: 5.4,
    });
    this.bossActive = true;
    this.enemies = [new Enemy(this, "nautolanDreadnought", CONFIG.designW / 2, 150, true)];
    this.enemies[0].fireTimer = 0.4;
  }

  _applyVisualTestStage() {
    const stage = PLAYER_VISUAL_TEST_STAGES[this.visualTestIndex];
    this.player = new Player(this);
    this.player.x = CONFIG.designW / 2;
    this.player.y = 430;
    Object.assign(this.player, stage.player);
    this.player.speed = 360 + this.player.speedLevel * 26;
    this.player.maxShield = 55 + this.player.shieldLevel * 12;
    this.player.shield = this.player.maxShield;
    this.player.vx = 120;
    this.projectiles = [];
    this.zaps = [];
    if (stage.weapon) this.player.previewWeaponFire(stage.weapon);
    this.visualTestTimer = 0;
    this.visualTestWeaponTimer = 1.9;
  }

  nextVisualTestStage() {
    this.visualTestIndex = (this.visualTestIndex + 1) % PLAYER_VISUAL_TEST_STAGES.length;
    this._applyVisualTestStage();
  }

  updateVisualTest(dt) {
    this.visualTestTimer += dt;
    this.visualTestWeaponTimer -= dt;
    this.player.vx = 120;
    this.player.bank = Math.sin(this.time * 1.8) * 0.06;
    this.player.updatePendingWeaponShots(dt);
    for (const projectile of this.projectiles) {
      projectile.update(dt, this);
      emitTrail(this, projectile);
    }
    this.projectiles = this.projectiles.filter(projectile => !projectile.dead);

    if (this.visualTestWeaponTimer <= 0) {
      const stage = PLAYER_VISUAL_TEST_STAGES[this.visualTestIndex];
      if (stage.weapon) this.player.previewWeaponFire(stage.weapon);
      this.visualTestWeaponTimer = 1.9;
    }
    if (this.visualTestTimer >= 3.4) this.nextVisualTestStage();
  }

  endRun() {
    SaveSystem.setBest(this.score);
    this.best = SaveSystem.best();
    this.state = "gameOver";
  }

  togglePause() {
    if (this.state === "playing") {
      this.prevState = "playing";
      this.state = "paused";
    } else if (this.state === "paused") {
      this.state = this.prevState || "playing";
    }
  }

  loop(now) {
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(CONFIG.maxDt, Math.max(0, rawDt));
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt;

    const tap = this.input.consumeTap();
    if (tap) this.handleTap(tap.x, tap.y);

    if (this.state === "visualTest") this.updateVisualTest(dt);

    if (this.state === "playing") {
      this.runTime += dt;
      this.score += dt * 2.4;
      this.player.update(dt);
      this.updateSpawning(dt);
      this.updateCollections(dt);
      this.handleCollisions();
      this.cleanup();
      // FX: projectile trails + atmosphere dust
      for (const pr of this.projectiles) emitTrail(this, pr);
      emitSectorDust(this, dt);
    }

    if (this.state === "title") this.titleTime += dt;

    if (this.state === "bossReward") {
      this.bossRewardTimer -= dt; // counts down to 0 then stops — player must tap to continue
    }

    for (const p of this.particles) p.update(dt);
    for (const z of this.zaps) z.life -= dt;
    for (const death of this.enemyDeaths) death.age += dt;
    this.particles = this.particles.filter(p => !p.dead).slice(-this.particleCap);
    this.zaps = this.zaps.filter(z => z.life > 0).slice(-this.zapCap);

    this.shake = Math.max(0, this.shake - dt * 20);
    this.bossWarning = Math.max(0, this.bossWarning - dt);
    this.sectorTransition = Math.max(0, this.sectorTransition - dt);
    this.evolutionFlash = Math.max(0, this.evolutionFlash - dt);
  }

  _tryStartMusic() {
    if (!this.musicMuted && this._music.paused) {
      this._music.play().catch(() => {});
    }
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicMuted) {
      this._music.pause();
    } else {
      this._music.play().catch(() => {});
    }
  }

  handleTap(x, y) {
    // Mute button — bottom-right, matches exclusion zone
    const mz = this._muteBtnZone;
    if (x >= mz.x && x <= mz.x + mz.w && y >= mz.y && y <= mz.y + mz.h) {
      this.toggleMusic();
      return;
    }
    this._tryStartMusic();

    if (this.state === "title") {
      if (y > 500 && y < 610) this.startRun();
    } else if (this.state === "gameOver") {
      if (y > 510 && y < 610) this.startRun();
    } else if (this.state === "victory") {
      if (y > 510 && y < 610) this.startRun();
    } else if (this.state === "levelUp") {
      this.upgrades.handleTap(x, y);
    } else if (this.state === "paused") {
      this.state = "playing";
    } else if (this.state === "bossReward") {
      // Tap-to-dismiss: only allow after first 0.8s so accidental taps don't skip the reveal
      if (this.bossRewardTimer < 2.4) this._endBossReward();
    } else if (this.state === "visualTest") {
      this.nextVisualTestStage();
    }
  }

  updateSpawning(dt) {
    if (this.bossActive) return;

    this.sectorTimer -= dt;
    if (this.sectorTimer <= 0) {
      this.sectorTimer = 0;
      this.bossActive = true;
      this.bossWarning = 3.1;
      const fleet = FLEETS[SECTORS[this.currentSectorIndex].fleet];
      this.spawnEnemy(fleet.bossType, true);
      return;
    }

    this.spawnTimer -= dt;
    const sector = SECTORS[this.currentSectorIndex];
    const sectorProgress = 1 - this.sectorTimer / sector.duration;
    const difficulty = 1 + this.currentSectorIndex * 0.6 + sectorProgress * 0.5;
    // spawnMult > 1 stretches the interval (fewer spawns); Sector I uses 0.9 → interval ÷ 0.9
    const interval = clamp((1.0 - difficulty * 0.08) / (sector.spawnMult ?? 1.0), 0.22, 1.0);

    if (this.spawnTimer <= 0 && this.enemies.length < CONFIG.enemyCap) {
      this.spawnTimer = interval;
      const fleet = FLEETS[sector.fleet];
      const speedMult = sector.enemySpeedMult ?? 1.0;

      // Formation chance per sector; suppressed in Sector I before 15s elapsed
      // and suppressed during bossWarning. Formation replaces the normal solo spawn.
      const formationChance = [0.25, 0.30, 0.34, 0.36][this.currentSectorIndex] ?? 0.25;
      const sectorElapsed = sector.duration - this.sectorTimer;
      const formationAllowed = !this.bossWarning &&
                               !(this.currentSectorIndex === 0 && sectorElapsed < 15) &&
                               this.enemies.length + 5 <= CONFIG.enemyCap;

      if (formationAllowed && Math.random() < formationChance) {
        // Formation tick — spawn formation instead of solo enemy; give a longer cooldown
        this.spawnTimer = interval * 2.2;
        this.spawnFormation(fleet, sectorProgress, speedMult);
      } else {
        const type = pickSoloEnemy(fleet, sectorProgress);
        // Scouts/fighters that do spawn solo cross diagonally instead of chasing.
        const isLight = /scout|fighter/i.test(type);
        const soloFlyby = isLight && Math.random() < 0.50
          ? this._makeDiagonalFlyby(Enemy.defs[type]?.speed ?? 90, speedMult)
          : null;
        this.spawnEnemy(type, false, speedMult, soloFlyby);
        if (difficulty > 1.8 && Math.random() < 0.2) {
          this.spawnEnemy(pickSoloEnemy(fleet, sectorProgress), false, speedMult);
        }
      }
    }
  }

  onBossKilled() {
    this.bossActive = false;
    if (this.currentSectorIndex >= SECTORS.length - 1) {
      // Final boss — go straight to victory, no evolution reward
      SaveSystem.setBest(this.score);
      this.best = SaveSystem.best();
      this.state = "victory";
      return;
    }

    // Advance sector immediately so shipTier() already reflects the new tier
    // when the reward overlay renders the ship.
    this.currentSectorIndex++;
    this.sectorTimer = SECTORS[this.currentSectorIndex].duration;

    // Build reward data snapshot for the overlay
    const tier   = this.player.shipTier();   // now the new tier
    const branch = this.player.shipBranch();
    const TIER_NAMES   = ["", "MK-I FRAME", "MK-II FRAME", "MK-III FRAME", "MK-IV FRAME"];
    const TIER_SUBTITLES = ["", "Scout Hull", "Combat Frame", "Warship Online", "Flagship Ascended"];
    const BRANCH_LABELS = { assault: "Assault Systems", energy: "Energy Systems", siege: "Siege Systems" };
    const BRANCH_COLORS_HEX = { assault: "#c8d8ff", energy: "#88ccff", siege: "#ffaa40" };
    const MOVE_BONUS  = ["", "+0%", "+5%", "+8%", "+10%"];
    const FIRE_BONUS  = ["", "+0%", "+6%", "+10%", "+14%"];

    this.bossRewardData = {
      tier,
      branch,
      tierName:     TIER_NAMES[tier]    || `MK-${tier} FRAME`,
      tierSubtitle: TIER_SUBTITLES[tier] || `Tier ${tier}`,
      branchLabel:  BRANCH_LABELS[branch] || "Systems",
      branchColor:  BRANCH_COLORS_HEX[branch] || CONFIG.colors.cyan,
      moveBonusStr: MOVE_BONUS[tier]  || "",
      fireBonusStr: FIRE_BONUS[tier]  || "",
    };

    this.bossRewardTimer = 3.2; // total display time in seconds
    this.state = "bossReward";
  }

  _endBossReward() {
    this.state = "playing";
    this.sectorTransition = 2.2;
    this.bossRewardData = null;
  }

  spawnEnemy(type, boss, speedMult = 1.0, flyby = null) {
    let x, y;
    if (boss) {
      x = CONFIG.designW / 2;
      y = -90;
    } else if (flyby && flyby.vx !== 0) {
      // Diagonal flyby: enter from the edge the velocity comes from, at a random vertical position.
      x = flyby.vx > 0 ? -50 : CONFIG.designW + 50;
      y = CONFIG.designH * (0.05 + Math.random() * 0.45); // upper half — readable on mobile
    } else {
      // Weighted side selection: top 45%, left 22.5%, right 22.5%, bottom 10%.
      const r = Math.random();
      const side = r < 0.45 ? 0 : r < 0.675 ? 1 : r < 0.90 ? 2 : 3;
      if (side === 0) {
        x = Math.random() * CONFIG.designW;
        y = -50;
      } else if (side === 1) {
        x = CONFIG.designW + 50;
        y = Math.random() * CONFIG.designH * 0.65;
      } else if (side === 2) {
        x = -50;
        y = Math.random() * CONFIG.designH * 0.65;
      } else {
        x = Math.random() * CONFIG.designW;
        y = CONFIG.designH + 50;
      }
    }
    this.enemies.push(new Enemy(this, type, x, y, boss, speedMult, flyby));
    if (boss) this.bossEntrance(x, y);
  }

  // Spawns 3–5 small enemies in a formation using flyby behavior.
  // Patterns: 0=horizontal line, 1=diagonal line, 2=shallow-V
  // Always enters from the top. Does NOT add normal spawn timer delay.
  spawnFormation(fleet, sectorProgress, speedMult) {
    // Only scouts/fighters in formations
    const lightTypes = Object.keys(fleet.phases[0]).filter(t => /scout|fighter/i.test(t));
    if (!lightTypes.length) return;
    const type = lightTypes[Math.floor(Math.random() * lightTypes.length)];

    const baseSpeed = Enemy.defs[type]?.speed ?? 90;
    const spd = baseSpeed * speedMult * 1.15;
    const s = 46; // spacing between slots

    // 5 named shapes — each is an array of {dx, dy} offsets from formation center.
    // All offsets are in "formation space": x=across travel axis, y=along travel axis.
    const SHAPES = [
      // horizontal line (3)
      [{ dx: -s,   dy: 0 }, { dx: 0,    dy: 0 }, { dx: s,    dy: 0 }],
      // diagonal line (4)
      [{ dx: -s*1.5, dy: -s*0.5 }, { dx: -s*0.5, dy: 0 }, { dx: s*0.5, dy: s*0.5 }, { dx: s*1.5, dy: s }],
      // V-shape (5, tip leads)
      [{ dx: 0, dy: 0 }, { dx: -s, dy: s*0.7 }, { dx: s, dy: s*0.7 }, { dx: -s*2, dy: s*1.4 }, { dx: s*2, dy: s*1.4 }],
      // diamond (4)
      [{ dx: 0, dy: -s*0.7 }, { dx: -s, dy: 0 }, { dx: s, dy: 0 }, { dx: 0, dy: s*0.7 }],
      // arrow / wedge (5, tip leads)
      [{ dx: 0, dy: 0 }, { dx: -s, dy: s*0.6 }, { dx: s, dy: s*0.6 }, { dx: -s*1.8, dy: s*0.2 }, { dx: s*1.8, dy: s*0.2 }],
    ];

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const fromSide = Math.random() < 0.5;

    // All enemies in this formation share the same flyby vector — no individual wobble.
    // sineAmp:0 keeps the block tight; the shape provides all visual interest.
    if (fromSide) {
      const fromLeft = Math.random() < 0.5;
      const vx = (fromLeft ? 1 : -1) * spd;
      const cy = CONFIG.designH * (0.15 + Math.random() * 0.40);
      const flyby = { vx, vy: 0, sineAmp: 0, sineFreq: 0 };
      for (const off of shape) {
        if (this.enemies.length >= CONFIG.enemyCap) break;
        // In side-entry: dx maps to y-axis, dy maps to x-axis (along travel direction)
        const ex = fromLeft
          ? -50 - Math.max(0, off.dy)
          : CONFIG.designW + 50 + Math.max(0, -off.dy);
        const ey = clamp(cy + off.dx, 30, CONFIG.designH - 30);
        this.enemies.push(new Enemy(this, type, ex, ey, false, speedMult, flyby));
      }
    } else {
      const cx = CONFIG.designW * (0.2 + Math.random() * 0.6);
      const flyby = { vx: 0, vy: spd, sineAmp: 0, sineFreq: 0 };
      for (const off of shape) {
        if (this.enemies.length >= CONFIG.enemyCap) break;
        const ex = clamp(cx + off.dx, 30, CONFIG.designW - 30);
        const ey = -50 - Math.max(0, off.dy); // tip enters first
        this.enemies.push(new Enemy(this, type, ex, ey, false, speedMult, flyby));
      }
    }
  }

  // Returns a flyby object for a solo enemy crossing diagonally.
  // Enters from left or right edge, travels toward the opposite side with a downward angle.
  _makeDiagonalFlyby(baseSpeed, speedMult) {
    const fromLeft = Math.random() < 0.5;
    const spd = baseSpeed * speedMult * 1.1;
    // Horizontal component carries enemy across full canvas width; vertical keeps it moving down.
    // angle 15–35° below horizontal — horizontal component dominant, clearly crossing not chasing.
    const angleRad = (0.26 + Math.random() * 0.35); // ~15–35° in radians
    const vx = (fromLeft ? 1 : -1) * Math.cos(angleRad) * spd;
    const vy = Math.sin(angleRad) * spd;
    return { vx, vy, sineAmp: 12, sineFreq: 2.0 };
  }

  updateCollections(dt) {
    for (const e of this.enemies) e.update(dt);
    for (const p of this.projectiles) p.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);
  }

  handleCollisions() {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (pr.hitTargets.has(e)) continue;
          if (this.dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) ** 2) {
            e.damage(pr.dmg);
            pr.hitTargets.add(e);
            if (!pr.piercing) pr.dead = true;
            spawnHitSparks(this, pr.x, pr.y, pr);
            if (pr.onHit) pr.onHit(e, pr, this);
            if (pr.kind === "rocket") {
              this.explosion(pr.x, pr.y, 16);
              if (this.player.siegePayload) {
                for (const ne of this.enemies) {
                  if (ne.dead || ne === e) continue;
                  if (this.dist2(pr.x, pr.y, ne.x, ne.y) < 55 * 55) ne.damage(pr.dmg * 0.4);
                }
                this.explosion(pr.x, pr.y, 28);
              }
            }
            if (!pr.piercing) break;
          }
        }
      } else {
        const p = this.player;
        if (this.dist2(pr.x, pr.y, p.x, p.y) < (pr.r + p.r) ** 2) {
          p.damage(pr.dmg);
          pr.dead = true;
        }
      }
    }
  }

  cleanup() {
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead).slice(-CONFIG.projectileCap);
    this.pickups = this.pickups.filter(p => !p.dead).slice(-CONFIG.pickupCap);
    this.enemyDeaths = this.enemyDeaths.filter(death => death.age < death.duration);
  }

  // Inline dist2 for use within Game (entities import from utils.js directly)
  dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  spawnProjectile(x, y, a, speed, dmg, owner, kind, visualKey = null, options = {}) {
    if (this.projectiles.length >= CONFIG.projectileCap) return null;
    const projectile = new Projectile(x, y, a, speed, dmg, owner, kind, visualKey, options);
    this.projectiles.push(projectile);
    return projectile;
  }

  dropXp(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.pickups.push(new XpPickup(
        x + (Math.random() - 0.5) * 34,
        y + (Math.random() - 0.5) * 34,
        1
      ));
    }
  }

  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = Math.floor(this.xpNeed * 1.28 + 4);
      this.upgrades.roll();
      this.input.cancelMovement();
      this.state = "levelUp";
    }
  }

  closestEnemy(x, y, range) {
    let best = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = this.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  closestEnemyExcluding(x, y, range, exclude) {
    let best = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e === exclude) continue;
      const d = this.dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  burst(x, y, color, count) {
    const allowed = Math.max(0, this.particleCap - this.particles.length);
    for (let i = 0; i < Math.min(count, allowed); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 130 + 35;
      this.particles.push(new Particle(
        x, y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        color,
        Math.random() * 0.35 + 0.2,
        Math.random() * 3 + 1.5
      ));
    }
  }

  explosion(x, y, size) {
    this.burst(x, y, CONFIG.colors.orange, Math.floor(size * 0.7));
    this.burst(x, y, CONFIG.colors.cyan, Math.floor(size * 0.22));
  }

  spawnZap(x1, y1, x2, y2, secondary = false) {
    const life = secondary ? 0.13 : 0.18;
    if (this.zaps.length < this.zapCap) {
      this.zaps.push({ x1, y1, x2, y2, life, max: life, secondary });
    }
    this.burst(x2, y2, CONFIG.colors.pink, secondary ? 5 : 14);
  }

  spawnEnemyDestruction(enemy) {
    const visual = enemyVisualFor(enemy.type);
    if (!visual?.destruction || this.enemyDeaths.length >= 30) return;
    this.enemyDeaths.push({
      x: enemy.x,
      y: enemy.y,
      angle: enemy._facingAngle() + Math.PI / 2,
      size: (RENDER_CONFIG.enemies[enemy.type]?.w || enemy.r * 2) * (enemy.boss ? 1.85 : 1),
      visual,
      age: 0,
      duration: visual.destruction.frameCount / visual.destruction.fps,
    });
  }

  deathBurst(enemy) { spawnDeathBurst(this, enemy.x, enemy.y, enemy); }
  bossEntrance(x, y) { spawnBossEntrance(this, x, y); }

  // ── Rendering ──────────────────────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.renderDpr, 0, 0, this.renderDpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = CONFIG.colors.bg;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(sx, sy);

    this.drawBackground(ctx);
    if (this.state !== "title" && this.state !== "loading") this.drawWorld(ctx);

    if (this.state === "loading") this.drawLoading(ctx);
    if (this.state === "title") this.drawTitle(ctx);
    if (this.state === "levelUp") this.upgrades.draw(ctx, this.loader);
    if (this.state === "gameOver") this.drawGameOver(ctx);
    if (this.state === "victory") this.drawVictory(ctx);
    if (this.state === "paused") this.drawPaused(ctx);
    if (this.state === "bossReward") this.drawBossReward(ctx);
    if (this.state === "visualTest") this.drawVisualTest(ctx);
    // evolutionFlash suppressed during/after bossReward (bossReward owns that moment now)
    if (this.evolutionFlash > 0 && this.state !== "bossReward") this.drawEvolutionFlash(ctx);
    if (this.state === "playing") this.drawHud(ctx);
    if (this.state === "playing" && this.sectorTransition > 0) this.drawSectorTransition(ctx);
    this.drawMuteButton(ctx);

    ctx.restore();
  }

  drawVisualTest(ctx) {
    const stage = PLAYER_VISUAL_TEST_STAGES[this.visualTestIndex];
    const progress = this.visualTestTimer / 3.4;

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(2,6,20,0.82)";
    ctx.fillRect(18, 22, CONFIG.designW - 36, 104);
    ctx.strokeStyle = "rgba(88,230,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 22, CONFIG.designW - 36, 104);

    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.font = "800 12px system-ui";
    ctx.fillText(`FOOZLE UPGRADE PREVIEW  ${this.visualTestIndex + 1}/${PLAYER_VISUAL_TEST_STAGES.length}`, CONFIG.designW / 2, 48);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 24px system-ui";
    ctx.fillText(stage.title, CONFIG.designW / 2, 79);
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 12px system-ui";
    ctx.fillText(stage.detail, CONFIG.designW / 2, 104);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(40, 115, CONFIG.designW - 80, 3);
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.fillRect(40, 115, (CONFIG.designW - 80) * clamp(progress, 0, 1), 3);

    ctx.fillStyle = "rgba(2,6,20,0.78)";
    ctx.fillRect(42, 588, CONFIG.designW - 84, 74);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 13px system-ui";
    ctx.fillText("Tap/click: next stage", CONFIG.designW / 2, 618);
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 11px system-ui";
    ctx.fillText("Stages also advance automatically", CONFIG.designW / 2, 642);
    ctx.restore();
  }

  drawMuteButton(ctx) {
    const mz = this._muteBtnZone;
    const x = mz.x + mz.w / 2, y = mz.y + mz.h / 2, r = 14;
    ctx.save();
    // Background circle
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(2,6,20,0.82)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = this.musicMuted ? "rgba(255,255,255,0.2)" : CONFIG.colors.cyan;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = this.musicMuted ? 0.3 : 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Icon — speaker shape
    ctx.globalAlpha = this.musicMuted ? 0.35 : 0.9;
    ctx.fillStyle = this.musicMuted ? "rgba(255,255,255,0.6)" : CONFIG.colors.cyan;
    ctx.font = "500 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.musicMuted ? "🔇" : "🔊", x, y);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawBackground(ctx) {
    const W = CONFIG.designW, H = CONFIG.designH;

    // Deep space gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#060819");
    g.addColorStop(0.45, "#091428");
    g.addColorStop(1, "#030509");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Planet — it's a massive strip (7392×96), use drawAsset which crops to first frame
    const planet = this.loader.get("planet");
    if (planet) {
      ctx.globalAlpha = 0.28;
      this.drawAsset(ctx, planet, W - 52, 130 + Math.sin(this.time * 0.16) * 8, RENDER_CONFIG.planet.w, RENDER_CONFIG.planet.h);
      ctx.globalAlpha = 1;
    } else {
      // Fallback planet
      ctx.globalAlpha = 0.14;
      const pg = ctx.createRadialGradient(W - 52, 130, 10, W - 52, 130, 90);
      pg.addColorStop(0, "#4488ff");
      pg.addColorStop(0.6, "#1a3a88");
      pg.addColorStop(1, "transparent");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(W - 52, 130, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Sector tint overlay — stronger in later sectors
    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;
    const tintStrength = 0.09 + this.currentSectorIndex * 0.018;
    ctx.fillStyle = `rgba(${tr},${tg},${tb},${tintStrength})`;
    ctx.fillRect(0, 0, W, H);

    // Stars — brighter and more visible
    for (const s of this.stars) {
      s.y += s.v * 0.016;
      if (s.y > H) { s.y = -5; s.x = Math.random() * W; }
      ctx.globalAlpha = s.a * 0.95;
      // Brighter large stars get a cross sparkle
      if (s.s > 1.5 && s.a > 0.6) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(s.x - 0.5, s.y - s.s * 1.2, 1, s.s * 2.4);
        ctx.fillRect(s.x - s.s * 1.2, s.y - 0.5, s.s * 2.4, 1);
      }
      ctx.fillStyle = "#e8f8ff";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // Asteroids
    const ast = this.loader.get("asteroid");
    for (const a of this.asteroids) {
      a.y += a.v * 0.016;
      a.r += 0.001;
      if (a.y > H + 80) { a.y = -80; a.x = Math.random() * W; }
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.r);
      ctx.globalAlpha = 0.18;
      const sz = clamp(a.s, RENDER_CONFIG.asteroid.wMin, RENDER_CONFIG.asteroid.wMax);
      if (ast) this.drawAsset(ctx, ast, 0, 0, sz, sz);
      else {
        ctx.fillStyle = "#2a3a52";
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Subtle edge glow lines (arena framing)
    const edgeGrad = ctx.createLinearGradient(0, 0, 22, 0);
    edgeGrad.addColorStop(0, "rgba(88,150,255,0.18)");
    edgeGrad.addColorStop(1, "rgba(88,150,255,0)");
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, 22, H);
    const edgeGradR = ctx.createLinearGradient(W, 0, W - 22, 0);
    edgeGradR.addColorStop(0, "rgba(88,150,255,0.18)");
    edgeGradR.addColorStop(1, "rgba(88,150,255,0)");
    ctx.fillStyle = edgeGradR;
    ctx.fillRect(W - 22, 0, 22, H);

    // Inner vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,8,0.42)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 1;
  }

  drawWorld(ctx) {
    for (const p of this.pickups) p.draw(ctx);
    for (const pr of this.projectiles) pr.draw(ctx, this);
    for (const e of this.enemies) e.draw(ctx, this.loader);
    this.drawEnemyDestructions(ctx);
    this.player.draw(ctx, this.loader);
    drawPulse(ctx, this.player);

    for (const z of this.zaps) {
      const a = z.life / z.max;
      const sec = z.secondary;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Jitter midpoint — two segments give lightning feel
      const mx = (z.x1 + z.x2) / 2 + (Math.random() - 0.5) * (sec ? 10 : 20);
      const my = (z.y1 + z.y2) / 2 + (Math.random() - 0.5) * (sec ? 10 : 20);
      // Outer glow
      ctx.globalAlpha = a * (sec ? 0.3 : 0.55);
      ctx.strokeStyle = CONFIG.colors.pink;
      ctx.lineWidth = sec ? 3 : 6;
      ctx.shadowColor = CONFIG.colors.pink;
      ctx.shadowBlur = this.lowEffects ? 0 : (sec ? 12 : 26);
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      // Bright core
      ctx.globalAlpha = a * (sec ? 0.6 : 1.0);
      ctx.strokeStyle = sec ? "#ddaaff" : "#ffccff";
      ctx.lineWidth = sec ? 1.2 : 2.2;
      ctx.shadowBlur = this.lowEffects ? 0 : (sec ? 5 : 10);
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) p.draw(ctx, this);

    if (this.bossWarning > 0) {
      ctx.save();
      const a = Math.min(1, this.bossWarning);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,70,107,0.12)";
      ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
      ctx.textAlign = "center";
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "900 22px system-ui";
      const sectorName = SECTORS[this.currentSectorIndex].name.toUpperCase();
      ctx.fillText(`${sectorName} — SECTOR BOSS`, CONFIG.designW / 2, 100);
      ctx.font = "700 14px system-ui";
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.fillText("DREADNOUGHT SIGNATURE DETECTED", CONFIG.designW / 2, 122);
      ctx.restore();
    }
  }

  drawEnemyDestructions(ctx) {
    for (const death of this.enemyDeaths) {
      const animation = death.visual.destruction;
      const image = this.loader.get(animation.assetKey);
      if (!image) continue;
      const frame = Math.min(animation.frameCount - 1, Math.floor(death.age * animation.fps));
      ctx.save();
      ctx.translate(death.x, death.y);
      ctx.rotate(death.angle);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = Math.min(1, (death.duration - death.age) * 5);
      ctx.drawImage(
        image,
        frame * (animation.frameSize || death.visual.frame), 0, animation.frameSize || death.visual.frame, animation.frameSize || death.visual.frame,
        -death.size / 2, -death.size / 2, death.size, death.size,
      );
      ctx.restore();
    }
  }

  drawHud(ctx) {
    ctx.save();
    const W = CONFIG.designW;
    const p = this.player;

    // ── Panel background ─────────────────────────────────────────────
    ctx.fillStyle = "rgba(2,6,20,0.76)";
    ctx.strokeStyle = "rgba(88,180,255,0.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, 10, W - 20, 74, 14);
    ctx.fill();
    ctx.stroke();

    // ── LEFT: HP + Shield ────────────────────────────────────────────
    const iconX = 22;   // icon center x — enough room for 9px icons
    const barX  = 40;   // bar starts after icon + gap

    // HP bar
    const hpW = 110, hpH = 12, hpY = 28;
    this.bar(ctx, barX, hpY, hpW, hpH, p.hp / p.maxHp, CONFIG.colors.red, "");

    // Heart icon — vertically centered on HP bar
    this._drawHeartIcon(ctx, iconX, hpY + hpH / 2, 9, "rgba(255,80,105,0.9)");

    // HP value — right-aligned to bar end
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,180,180,0.5)";
    ctx.font = "500 8px system-ui";
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, barX + hpW, 26);

    // Shield bar
    const shW = 110, shH = 6, shY = 46;
    ctx.globalAlpha = 0.78;
    this.bar(ctx, barX, shY, shW, shH, p.shield / p.maxShield, CONFIG.colors.cyan, "");
    ctx.globalAlpha = 1;

    // Authored pickup icon keeps the defensive system legible at a glance.
    const shieldIcon = this.loader.get("pickupShield");
    if (shieldIcon) this.drawAsset(ctx, shieldIcon, iconX, shY + shH / 2, 17, 17);
    else this._drawShieldIcon(ctx, iconX, shY + shH / 2, 8, "rgba(88,230,255,0.8)");

    // Timer — very subtle, bottom-left of panel
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(180,200,230,0.3)";
    ctx.font = "500 8px system-ui";
    ctx.fillText(fmtTime(this.runTime), 14, 66);

    // ── CENTER: Sector info ──────────────────────────────────────────
    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;
    const sectorAccent = `rgb(${Math.min(255,tr+140)},${Math.min(255,tg+140)},${Math.min(255,tb+170)})`;
    const cx = W / 2;

    // Sector number — prominent
    ctx.textAlign = "center";
    ctx.fillStyle = sectorAccent;
    ctx.font = "800 11px system-ui";
    ctx.fillText(sector.shortName, cx, 27);

    // Sector name — subdued
    ctx.fillStyle = "rgba(200,215,240,0.5)";
    ctx.font = "500 8px system-ui";
    ctx.fillText(sector.name.toUpperCase(), cx, 38);

    // Sector progress dots — 4 dots, one per sector
    const dotY = 52, dotR = 3, dotGap = 10;
    const dotStartX = cx - (SECTORS.length - 1) * dotGap / 2;
    for (let s = 0; s < SECTORS.length; s++) {
      const dx = dotStartX + s * dotGap;
      const done = s < this.currentSectorIndex;
      const current = s === this.currentSectorIndex;
      ctx.beginPath();
      ctx.arc(dx, dotY, current ? dotR : dotR * 0.7, 0, Math.PI * 2);
      if (done) {
        ctx.fillStyle = sectorAccent;
        ctx.globalAlpha = 0.7;
      } else if (current) {
        ctx.fillStyle = sectorAccent;
        ctx.globalAlpha = 1;
        ctx.shadowColor = sectorAccent;
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.globalAlpha = 1;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Boss state — replaces dots row when active
    if (this.bossActive) {
      // Overdraw the dot row area
      ctx.fillStyle = "rgba(2,6,20,0.0)"; // transparent — just alpha reset
      const pulse = 0.8 + 0.2 * Math.abs(Math.sin(this.time * 4));
      ctx.globalAlpha = pulse;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "700 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("▸  BOSS", cx, 55);
      ctx.globalAlpha = 1;
    }

    // Boss warning — below panel
    if (this.bossWarning > 0) {
      const a = clamp(this.bossWarning * 0.7, 0, 1) * Math.abs(Math.sin(this.time * 6));
      ctx.globalAlpha = a;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "600 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("⚠  BOSS INCOMING", W / 2, 96);
      ctx.globalAlpha = 1;
    }

    // ── RIGHT: XP Ring + Score ───────────────────────────────────────
    const ringX = W - 36, ringY = 46, ringR = 22;
    this._drawXpRing(ctx, ringX, ringY, ringR);

    // Score — above ring, right-aligned
    ctx.textAlign = "right";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 11px system-ui";
    ctx.fillText(Math.floor(this.score).toString(), W - 14, 26);

    // "SCORE" micro-label
    ctx.fillStyle = "rgba(180,200,230,0.35)";
    ctx.font = "500 6px system-ui";
    ctx.fillText("SCORE", W - 14, 15);

    // ── Boss HP bar ──────────────────────────────────────────────────
    if (this.bossActive && this.bossWarning <= 0) {
      const boss = this.enemies.find(e => e.boss && !e.dead);
      if (boss) {
        const bx = 18, by = 90, bw = W - 36, bh = 7;

        // Three-slice treatment: preserve the detailed alert end-caps while
        // stretching only the central rail to the current viewport width.
        const bossFrame = this.loader.get("uiBossAlertFrame");
        if (bossFrame) {
          const sx = 24, sy = 170, sw = 2123, sh = 369;
          const capSrc = 250, capDst = 30;
          const fx = bx - 7, fy = by - 17, fw = bw + 14, fh = 42;
          const middleSrc = sw - capSrc * 2;
          const middleDst = Math.max(1, fw - capDst * 2);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.76;
          ctx.drawImage(bossFrame, sx, sy, capSrc, sh, fx, fy, capDst, fh);
          ctx.drawImage(bossFrame, sx + capSrc, sy, middleSrc, sh, fx + capDst, fy, middleDst, fh);
          ctx.drawImage(bossFrame, sx + sw - capSrc, sy, capSrc, sh, fx + fw - capDst, fy, capDst, fh);
          ctx.restore();
        }
        ctx.fillStyle = "rgba(2,6,20,0.82)";
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 11, bw + 8, bh + 17, 7);
        ctx.fill();

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,100,120,0.65)";
        ctx.font = "600 7px system-ui";
        ctx.fillText(sector.name.toUpperCase() + " COMMANDER", bx, by - 2);

        const hpFrac = boss.hp / boss.maxHp;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,180,180,0.45)";
        ctx.font = "500 7px system-ui";
        ctx.fillText(`${Math.ceil(boss.hp)} / ${boss.maxHp}`, bx + bw, by - 2);

        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fill();

        const bColor = hpFrac > 0.5 ? CONFIG.colors.red : hpFrac > 0.25 ? CONFIG.colors.orange : "#ff2020";
        ctx.fillStyle = bColor;
        ctx.shadowColor = bColor;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.roundRect(bx, by, Math.max(bh, bw * hpFrac), bh, bh / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // ── Ability pips ─────────────────────────────────────────────────
    this.drawAbilityPips(ctx);

    ctx.restore();
  }

  _drawXpRing(ctx, cx, cy, r) {
    const frac = clamp(this.xp / this.xpNeed, 0, 1);
    const nearFull = frac >= 0.85;

    // Outer track
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // XP fill arc — clockwise from top
    if (frac > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.strokeStyle = nearFull ? "#aaffcc" : CONFIG.colors.green;
      ctx.shadowColor  = nearFull ? "#aaffcc" : CONFIG.colors.green;
      ctx.shadowBlur   = nearFull ? 12 : 4;
      ctx.lineWidth    = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Inner dark fill so level number reads cleanly
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2,6,20,0.7)";
    ctx.fill();

    // "XP" micro-label above number
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(180,200,230,0.4)";
    ctx.font = "500 6px system-ui";
    ctx.fillText("XP", cx, cy - 5);

    // Level number
    ctx.fillStyle = nearFull ? "#aaffcc" : CONFIG.colors.white;
    ctx.font = `800 ${this.level >= 10 ? 10 : 12}px system-ui`;
    ctx.fillText(this.level.toString(), cx, cy + 4);

    // "SHIP LV" micro-label below number
    ctx.fillStyle = "rgba(180,200,230,0.32)";
    ctx.font = "500 5px system-ui";
    ctx.fillText("SHIP LV", cx, cy + 11);
  }

  // Heart icon — two circular arcs meeting at a bottom point
  _drawHeartIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    // Offset center slightly upward so visual center feels correct
    const y = cy - r * 0.08;
    // Left bump center and right bump center
    const bumpR  = r * 0.56;
    const lx = cx - bumpR * 0.92;
    const rx = cx + bumpR * 0.92;
    const by = y - r * 0.18; // bump centers sit above mid
    ctx.beginPath();
    // Start at the bottom tip
    ctx.moveTo(cx, y + r);
    // Left side: curve up to left bump, around it, back to center top
    ctx.bezierCurveTo(cx - r * 0.18, y + r * 0.5,  cx - r, y + r * 0.1,  lx, by + bumpR);
    ctx.arc(lx, by, bumpR, Math.PI * 0.5, Math.PI * 1.85, false);
    // Cross to right bump
    ctx.arc(rx, by, bumpR, Math.PI * 1.15, Math.PI * 0.5, false);
    // Right side: curve back down to bottom tip
    ctx.bezierCurveTo(cx + r, y + r * 0.1,  cx + r * 0.18, y + r * 0.5,  cx, y + r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Shield icon — classic heater-shield silhouette (wide top, tapered to bottom point)
  _drawShieldIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    const top  = cy - r;
    const mid  = cy + r * 0.15;  // where sides start curving inward
    const tip  = cy + r;         // bottom point
    const hw   = r * 0.92;       // half-width at top
    ctx.beginPath();
    // Top-left corner (rounded)
    ctx.moveTo(cx - hw + r * 0.22, top);
    // Flat top edge
    ctx.lineTo(cx + hw - r * 0.22, top);
    // Top-right arc
    ctx.quadraticCurveTo(cx + hw, top, cx + hw, top + r * 0.28);
    // Right side straight down then curve inward to tip
    ctx.lineTo(cx + hw, mid);
    ctx.quadraticCurveTo(cx + hw, tip - r * 0.15, cx, tip);
    // Left side mirror
    ctx.quadraticCurveTo(cx - hw, tip - r * 0.15, cx - hw, mid);
    ctx.lineTo(cx - hw, top + r * 0.28);
    // Top-left arc
    ctx.quadraticCurveTo(cx - hw, top, cx - hw + r * 0.22, top);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawAbilityPips(ctx) {
    const p = this.player;
    const abilities = [];
    if (p.beam)  abilities.push({ label: "BIG GUN", icon: "pickupBigGun", cd: p._beamCooldown ?? 0, max: 7.0, color: "#7cff91" });
    if (p.pulse) abilities.push({ label: "PULSE", icon: "pickupShield", cd: p._pulseCooldown ?? 0, max: 9.0, color: CONFIG.colors.cyan });
    if (!abilities.length) return;

    // Vertically stacked, left of XP ring — ring center is at (W-36, 46)
    const pipW = 48, pipH = 6, gap = 8;
    const totalH = abilities.length * pipH + (abilities.length - 1) * gap;
    const startY = 46 - totalH / 2;  // vertically centered on ring
    const x = CONFIG.designW - 36 - 22 - 10 - pipW; // ring left edge minus gap minus pipW

    for (let i = 0; i < abilities.length; i++) {
      const ab = abilities[i];
      const y = startY + i * (pipH + gap);
      const ready = ab.cd <= 0;
      const fill = ready ? 1 : Math.max(0, 1 - ab.cd / ab.max);

      // Track
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.roundRect(x, y, pipW, pipH, pipH / 2);
      ctx.fill();

      // Fill
      if (fill > 0) {
        ctx.fillStyle = ready ? ab.color : "rgba(88,180,180,0.4)";
        ctx.shadowColor = ready ? ab.color : "transparent";
        ctx.shadowBlur  = ready ? 8 : 0;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(pipH, pipW * fill), pipH, pipH / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // An authored icon reads faster than text on a narrow mobile HUD.
      const icon = this.loader.get(ab.icon);
      if (icon) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = ready ? 1 : 0.5;
        this.drawAsset(ctx, icon, x - 11, y + pipH / 2, 14, 14);
        ctx.restore();
      }

      // Label above bar — right-aligned so it doesn't crowd the ring
      ctx.fillStyle = ready ? CONFIG.colors.white : "rgba(180,200,230,0.38)";
      ctx.font = "600 7px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(ab.label, x + pipW, y - 2);
    }
  }

  bar(ctx, x, y, w, h, t, color, label) {
    t = clamp(t, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (t > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * t), h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (label) {
      ctx.fillStyle = "rgba(180,200,230,0.5)";
      ctx.font = "600 8px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(label, x, y - 2);
    }
  }

  drawSectorTransition(ctx) {
    const t = this.sectorTransition / 3.0;
    const alpha = t > 0.7 ? (t - 0.7) / 0.3 : t < 0.3 ? t / 0.3 : 1.0;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = "rgba(2,6,22,0.85)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;

    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgb(${Math.min(255,tr+120)},${Math.min(255,tg+120)},${Math.min(255,tb+160)})`;
    ctx.font = "700 13px system-ui";
    ctx.fillText("SECTOR CLEARED", CONFIG.designW / 2, 310);

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 28px system-ui";
    ctx.shadowColor = `rgb(${Math.min(255,tr+80)},${Math.min(255,tg+80)},${Math.min(255,tb+100)})`;
    ctx.shadowBlur = 20;
    ctx.fillText(sector.shortName, CONFIG.designW / 2, 346);
    ctx.shadowBlur = 0;

    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 13px system-ui";
    ctx.fillText(sector.name, CONFIG.designW / 2, 374);

    // Evolution badge — show new ship tier
    const tier = this.player.shipTier();
    const branch = this.player.shipBranch();
    if (tier >= 2) {
      const TIER_NAMES  = ["", "", "COMBAT FRAME", "WARSHIP ONLINE", "FLAGSHIP ASCENDED"];
      const BRANCH_GLOWS = { assault: "#c8d8ff", energy: "#88ccff", siege: "#ffaa40" };
      const badgeGlow = BRANCH_GLOWS[branch] || CONFIG.colors.cyan;
      const tierLabel = TIER_NAMES[tier] || `TIER ${tier}`;
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = badgeGlow;
      ctx.shadowColor = badgeGlow;
      ctx.shadowBlur = 14;
      ctx.font = "800 14px system-ui";
      ctx.fillText("▲  " + tierLabel + "  ▲", CONFIG.designW / 2, 420);
      ctx.shadowBlur = 0;
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.font = "500 11px system-ui";
      ctx.fillText(branch.toUpperCase() + " FRAME", CONFIG.designW / 2, 440);
    }

    ctx.restore();
  }

  drawEvolutionFlash(ctx) {
    // Flash lifetime: 0.7s — sharp white punch fades to nothing
    // Shape: instant-on at 0.7, fast decay curve so it feels like a hit, not a fade
    const raw = this.evolutionFlash / 0.7; // 1.0 → 0.0
    const alpha = raw * raw;               // quadratic decay — snappy

    const tier   = this.player.shipTier();
    const branch = this.player.shipBranch();
    const BRANCH_GLOWS = { assault: "255,240,255", energy: "160,220,255", siege: "255,190,80" };
    const rgb = BRANCH_GLOWS[branch] || "180,220,255";

    ctx.save();

    // Full-screen white punch
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    // Centered tier text — only visible in first half of flash
    if (raw > 0.45) {
      const textAlpha = (raw - 0.45) / 0.55;
      const TIER_NAMES = ["", "", "COMBAT FRAME", "WARSHIP ONLINE", "FLAGSHIP ASCENDED"];
      const label = TIER_NAMES[tier] || `TIER ${tier} UNLOCKED`;
      ctx.globalAlpha = textAlpha;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = `rgb(${rgb})`;
      ctx.shadowBlur = 28;
      ctx.font = "900 26px system-ui";
      ctx.fillText(label, CONFIG.designW / 2, CONFIG.designH / 2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawBossReward(ctx) {
    if (!this.bossRewardData) return;
    const d = this.bossRewardData;
    const W = CONFIG.designW, H = CONFIG.designH;
    const total = 3.2;
    const elapsed = total - this.bossRewardTimer;  // 0 → 3.2

    // Phase timings:
    //   0.0–0.5s  : flash punch fades in (ship silhouette beats in)
    //   0.5–3.2s  : full overlay readable
    // Alpha envelope: fade-in over 0.3s, hold, no fade-out (tap or timer ends it)
    const alpha = clamp(elapsed / 0.3, 0, 1);

    ctx.save();

    // ── Semi-transparent dark overlay — ship stays visible beneath ──
    ctx.globalAlpha = alpha * 0.78;
    ctx.fillStyle = "rgba(2,5,18,0.88)";
    ctx.fillRect(0, 0, W, H);

    // ── Branch-colored pulse ring around ship position ──
    // Ship is drawn at its actual position in drawWorld(); we draw a glow behind it.
    const pulse = 0.55 + 0.22 * Math.sin(this.time * 5);
    ctx.globalAlpha = alpha * pulse * 0.45;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, 72, 0, Math.PI * 2);
    ctx.fillStyle = d.branchColor;
    ctx.shadowColor = d.branchColor;
    ctx.shadowBlur = 38;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Text block — centred vertically in upper half ──
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    const cx = W / 2;

    // "BOSS DEFEATED" micro-label
    ctx.fillStyle = CONFIG.colors.red;
    ctx.font = "700 11px system-ui";
    ctx.shadowColor = CONFIG.colors.red;
    ctx.shadowBlur = 10;
    ctx.fillText("BOSS DEFEATED", cx, 188);
    ctx.shadowBlur = 0;

    // Tier name — big headline
    ctx.fillStyle = d.branchColor;
    ctx.font = "900 28px system-ui";
    ctx.shadowColor = d.branchColor;
    ctx.shadowBlur = 22;
    ctx.fillText("SHIP EVOLUTION", cx, 228);
    ctx.shadowBlur = 0;

    // Subtitle: MK-II FRAME etc.
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 18px system-ui";
    ctx.fillText(d.tierName, cx, 258);

    // Branch label
    ctx.fillStyle = d.branchColor;
    ctx.font = "600 12px system-ui";
    ctx.fillText(d.branchLabel + " Online", cx, 280);

    // ── Divider ──
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = d.branchColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 296); ctx.lineTo(cx + 90, 296);
    ctx.stroke();

    // ── Bonus lines — only appear after 0.6s (stagger feel) ──
    if (elapsed > 0.6) {
      const bonusAlpha = clamp((elapsed - 0.6) / 0.35, 0, 1);
      ctx.globalAlpha = alpha * bonusAlpha;
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.font = "500 12px system-ui";
      const lineH = 22;
      const lines = [
        `+ Movement Response  ${d.moveBonusStr}`,
        `+ Auto-Fire Efficiency  ${d.fireBonusStr}`,
        `+ Hull Systems Reinforced`,
      ];
      // Only show bonus lines that have real values for this tier
      const visibleLines = d.tier >= 2 ? lines : [];
      visibleLines.forEach((txt, i) => {
        ctx.fillStyle = i < 2 ? d.branchColor : CONFIG.colors.dim;
        ctx.font = i < 2 ? "600 12px system-ui" : "500 11px system-ui";
        ctx.globalAlpha = alpha * bonusAlpha * (i < 2 ? 0.9 : 0.55);
        ctx.fillText(txt, cx, 316 + i * lineH);
      });
    }

    // ── Tap hint — appears after 1.2s, pulses to draw attention ──
    if (elapsed > 1.2) {
      const hintFade = clamp((elapsed - 1.2) / 0.4, 0, 1);
      const hintPulse = 0.6 + 0.4 * Math.abs(Math.sin(this.time * 2.2));
      ctx.globalAlpha = hintFade * hintPulse;
      ctx.fillStyle = CONFIG.colors.white;
      ctx.font = "600 13px system-ui";
      ctx.shadowColor = d.branchColor;
      ctx.shadowBlur = 10;
      ctx.fillText("TAP TO CONTINUE", cx, H - 72);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawVictory(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,22,0.88)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.font = "700 15px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 14;
    ctx.fillText("RUN COMPLETE", CONFIG.designW / 2, 200);
    ctx.shadowBlur = 0;

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 44px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 28;
    ctx.fillText(Math.floor(this.score).toString(), CONFIG.designW / 2, 278);
    ctx.shadowBlur = 0;

    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 13px system-ui";
    ctx.fillText(`Sectors: ${SECTORS.length} / ${SECTORS.length}  ·  Kills: ${this.kills}`, CONFIG.designW / 2, 316);
    ctx.fillText(`Time: ${fmtTime(this.runTime)}  ·  Best: ${Math.floor(this.best)}`, CONFIG.designW / 2, 338);

    // Stars decoration
    const pulse = Math.sin(this.time * 3) * 0.15;
    ctx.globalAlpha = 0.7 + pulse;
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.font = "900 22px system-ui";
    ctx.fillText("★ ★ ★ ★", CONFIG.designW / 2, 384);
    ctx.globalAlpha = 1;

    this.drawButton(ctx, 72, 528, 276, 66, "PLAY AGAIN");
    ctx.restore();
  }

  drawLoading(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 30px system-ui";
    ctx.fillText("VOID DRIFT", CONFIG.designW / 2, 300);
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 14px system-ui";
    ctx.fillText("Loading combat systems...", CONFIG.designW / 2, 330);

    const x = 60, y = 368, w = 300, h = 12;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(x, y, w * this.loader.progress(), h, 8);
    ctx.fill();

    if (this.loader.errors.length) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.font = "700 11px system-ui";
      ctx.fillText(`${this.loader.errors.length} asset fallback(s) active`, CONFIG.designW / 2, 405);
    }
    ctx.restore();
  }

  drawTitle(ctx) {
    const W = CONFIG.designW, H = CONFIG.designH;
    const t = this.titleTime;
    const cx = W / 2;

    ctx.save();
    ctx.textAlign = "center";

    // Dark overlay — heavy enough to suppress battle screen behind title
    ctx.fillStyle = "rgba(2,4,16,0.88)";
    ctx.fillRect(0, 0, W, H);
    // Second pass: deep vignette toward edges for depth
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.78);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,8,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Parallax star layer (slower, dimmer second pass) ──
    ctx.save();
    for (const s of this.stars) {
      const parallaxY = ((s.y - s.v * 0.008 * t * 60) % H + H) % H;
      ctx.globalAlpha = s.a * 0.35;
      ctx.fillStyle = "#c8e8ff";
      ctx.fillRect(s.x * 0.6 + W * 0.2, parallaxY, s.s * 0.7, s.s * 0.7);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Text-free title console: title and sector copy stay canvas-rendered so
    // they remain crisp, localizable, and independent from generated art.
    const titlePanel = this.loader.get("uiTitleCommandPanel");
    if (titlePanel) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(titlePanel, 16, 12, 1743, 853, 16, 118, W - 32, 242);
      ctx.restore();
    }

    const shipPreviewY = 400 + Math.sin(t * 1.6) * 5;

    // ── Ship preview — parallax tilt from cursor/touch ──
    // Cursor offset from center → subtle bank angle, max ±0.12 rad
    const cursorOffsetX = (this.input.worldX || cx) - cx;
    const titleBank = clamp(cursorOffsetX / W * 0.5, -0.12, 0.12);
    const _px = this.player.x, _py = this.player.y, _pb = this.player.bank;
    this.player.x = cx;
    this.player.y = shipPreviewY;
    this.player.bank = titleBank;
    this.player.draw(ctx, this.loader, {
      showWeapon: false,
      showShield: false,
      showPassive: false,
      showKeystone: false,
      forceEngineLevel: 0,
    });
    this.player.x = _px; this.player.y = _py; this.player.bank = _pb;

    // ── Title block ──
    // GALALAXY — "LA" in cyan
    const glowPulse = 18 + Math.sin(t * 2.1) * 10;
    ctx.font = "900 52px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    const galaW   = ctx.measureText("GALA").width;
    const laW     = ctx.measureText("LA").width;
    const totalW  = ctx.measureText("GALALAXY").width;
    const tleft   = cx - totalW / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.shadowBlur = glowPulse;
    ctx.fillText("GALA", tleft, 198);
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowBlur = glowPulse * 1.4;
    ctx.fillText("LA", tleft + galaW, 198);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.shadowBlur = glowPulse;
    ctx.fillText("XY", tleft + galaW + laW, 198);
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";

    // Flavor text
    ctx.font = "400 11px system-ui";
    ctx.fillStyle = "#b8d4f0";
    ctx.globalAlpha = 0.75;
    ctx.fillText("Kla'ed Fleet wants to know your location", cx, 235);
    ctx.globalAlpha = 1;

    // ── Sector names — staggered reveal ──
    const SECTOR_NAMES = ["I · Kla'ed Frontier", "II · Nairan Expanse", "III · Nautolan Depths", "IV · Void Core"];
    ctx.font = "500 10px system-ui";
    for (let i = 0; i < SECTOR_NAMES.length; i++) {
      const elapsed = t - (0.8 + i * 0.45);
      if (elapsed <= 0) break;
      const alpha = Math.min(1, elapsed / 0.35) * 0.55;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#b8d4f0";
      // Fit all four entries in the lower console bay: clear of both the
      // central divider and the lower rail.
      ctx.fillText(SECTOR_NAMES[i], cx, 294 + i * 12);
    }
    ctx.globalAlpha = 1;

    // ── Best score — prominent, above button ──
    if (this.best > 0) {
      ctx.font = "700 13px system-ui";
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.globalAlpha = 0.85;
      ctx.fillText(`✦ BEST  ${Math.floor(this.best)}`, cx, 488);
      ctx.globalAlpha = 1;
    }

    // ── Start button — pulsing outline + ripple ──
    const btnX = 72, btnY = 515, btnW = 276, btnH = 66, btnR = 24;
    const btnCx = btnX + btnW / 2, btnCy = btnY + btnH / 2;

    // Ripple — expands every 3s, fades out
    const ripplePhase = (t % 3.0) / 3.0; // 0→1 every 3s
    if (ripplePhase < 0.55) {
      const rippleR = (btnW * 0.5 + 20) * (ripplePhase / 0.55);
      const rippleA = (1 - ripplePhase / 0.55) * 0.35;
      ctx.globalAlpha = rippleA;
      ctx.strokeStyle = CONFIG.colors.cyan;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(btnCx, btnCy, rippleR, rippleR * (btnH / btnW), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Button interior stays intentionally quiet; the generated frame carries
    // the visual weight while the live label remains clear.
    ctx.fillStyle = "rgba(5,17,36,0.78)";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
    ctx.fill();
    const startFrame = this.loader.get("uiStartRunButtonFrame");
    if (startFrame) {
      const btnPulse = 0.78 + Math.sin(t * 2.8) * 0.14;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = btnPulse;
      ctx.drawImage(startFrame, 28, 110, 2117, 475, btnX - 4, btnY - 4, btnW + 8, btnH + 8);
      ctx.restore();
    }
    // Label
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 20px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 8;
    ctx.fillText("START RUN", cx, btnY + 42);
    ctx.shadowBlur = 0;

    // ── Bottom info ──
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 12px system-ui";
    ctx.fillText("Drag to move · Auto-fire · Survive the fleet", cx, 614);

    if (this.loader.errors.length) {
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.font = "700 11px system-ui";
      ctx.fillText("Some assets failed. Fallback visuals enabled.", cx, 650);
    }

    ctx.restore();
  }

  drawGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,4,12,0.78)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.red;
    ctx.font = "900 34px system-ui";
    ctx.fillText("SHIP DESTROYED", CONFIG.designW / 2, 245);

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 40px system-ui";
    ctx.fillText(Math.floor(this.score).toString(), CONFIG.designW / 2, 315);

    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 14px system-ui";
    ctx.fillText(`Best: ${Math.floor(this.best)} · Kills: ${this.kills} · Time: ${fmtTime(this.runTime)}`, CONFIG.designW / 2, 350);

    this.drawButton(ctx, 72, 528, 276, 66, "RESTART");
    ctx.restore();
  }

  drawPaused(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,4,12,0.78)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 36px system-ui";
    ctx.fillText("PAUSED", CONFIG.designW / 2, 340);
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 14px system-ui";
    ctx.fillText("Tap to resume", CONFIG.designW / 2, 376);
    ctx.restore();
  }

  drawButton(ctx, x, y, w, h, text) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(88,230,255,0.95)");
    g.addColorStop(1, "rgba(255,79,216,0.85)");
    ctx.fillStyle = g;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#06101d";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, x + w / 2, y + 42);
  }

  // ── Rendering helpers (used by entities via this.game.*) ───────────────────

  getFrameSource(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return { sx: 0, sy: 0, sw: iw, sh: ih };
    const ratio = iw / ih;
    if (ratio >= STRIP_RATIO) {
      const frameSize = ih;
      return { sx: 0, sy: 0, sw: frameSize, sh: ih };
    }
    const vratio = ih / iw;
    if (vratio >= STRIP_RATIO) {
      return { sx: 0, sy: 0, sw: iw, sh: iw };
    }
    return { sx: 0, sy: 0, sw: iw, sh: ih };
  }

  drawAsset(ctx, img, x, y, targetW, targetH) {
    const { sx, sy, sw, sh } = this.getFrameSource(img);
    if (!sw || !sh) return;
    const scale = Math.min(targetW / sw, targetH / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(img, sx, sy, sw, sh, x - dw / 2, y - dh / 2, dw, dh);
  }

  drawImageCentered(ctx, img, x, y, w, h) {
    this.drawAsset(ctx, img, x, y, w, h);
  }

  drawWeaponIcon(ctx, type, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    if (type === "rocket") {
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.shadowColor = CONFIG.colors.orange;
      ctx.shadowBlur = 8;
      for (const ox of [-7, 7]) {
        ctx.beginPath();
        ctx.moveTo(ox, -10);
        ctx.lineTo(ox + 3.5, 2);
        ctx.lineTo(ox, 0);
        ctx.lineTo(ox - 3.5, 2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (type === "zapper") {
      ctx.strokeStyle = CONFIG.colors.pink;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = CONFIG.colors.pink;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.lineTo(2, -2);
      ctx.lineTo(-2, -2);
      ctx.lineTo(4, 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 6;
      for (const ox of [-5, 5]) {
        ctx.beginPath();
        ctx.roundRect(ox - 2, -12, 4, 14, 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawUpgradeIcon(ctx, id, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    switch (id) {
      case "fire": {
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-r * 0.25, -r * 0.9, r * 0.5, r * 1.4, r * 0.25);
        ctx.fill();
        break;
      }
      case "twin": {
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 10;
        for (const ox of [-r * 0.38, r * 0.38]) {
          ctx.beginPath();
          ctx.roundRect(ox - r * 0.18, -r * 0.85, r * 0.36, r * 1.3, r * 0.18);
          ctx.fill();
        }
        break;
      }
      case "rocket": {
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.45, r * 0.5);
        ctx.lineTo(0, r * 0.2);
        ctx.lineTo(-r * 0.45, r * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "zapper": {
        ctx.strokeStyle = CONFIG.colors.pink;
        ctx.lineWidth = 3;
        ctx.shadowColor = CONFIG.colors.pink;
        ctx.shadowBlur = 14;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(-r * 0.25, -r);
        ctx.lineTo(r * 0.25, -r * 0.1);
        ctx.lineTo(-r * 0.15, -r * 0.1);
        ctx.lineTo(r * 0.3, r);
        ctx.stroke();
        break;
      }
      case "speed": {
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.bezierCurveTo(-r * 0.5, r * 0.4, -r * 0.6, -r * 0.2, 0, -r);
        ctx.bezierCurveTo(r * 0.6, -r * 0.2, r * 0.5, r * 0.4, 0, r);
        ctx.fill();
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(0, r * 0.5);
        ctx.bezierCurveTo(-r * 0.25, r * 0.1, -r * 0.3, -r * 0.3, 0, -r * 0.6);
        ctx.bezierCurveTo(r * 0.3, -r * 0.3, r * 0.25, r * 0.1, 0, r * 0.5);
        ctx.fill();
        break;
      }
      case "shield": {
        ctx.strokeStyle = CONFIG.colors.cyan;
        ctx.lineWidth = 3;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case "magnet": {
        ctx.strokeStyle = CONFIG.colors.pink;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.shadowColor = CONFIG.colors.pink;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.62, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.58, -r * 0.05);
        ctx.lineTo(-r * 0.58, r * 0.62);
        ctx.moveTo(r * 0.58, -r * 0.05);
        ctx.lineTo(r * 0.58, r * 0.62);
        ctx.stroke();
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-r * 0.58, r * 0.62, r * 0.15, 0, Math.PI * 2);
        ctx.arc(r * 0.58, r * 0.62, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "hp": {
        ctx.fillStyle = CONFIG.colors.green;
        ctx.shadowColor = CONFIG.colors.green;
        ctx.shadowBlur = 12;
        const bar = r * 0.28;
        const len = r * 0.85;
        ctx.beginPath();
        ctx.roundRect(-bar, -len, bar * 2, len * 2, bar * 0.5);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(-len, -bar, len * 2, bar * 2, bar * 0.5);
        ctx.fill();
        break;
      }
      case "beam": {
        // Vertical beam column with bright core
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.roundRect(-r * 0.45, -r, r * 0.9, r * 2, r * 0.45);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-r * 0.15, -r, r * 0.3, r * 2, r * 0.15);
        ctx.fill();
        break;
      }
      case "pulse": {
        // Expanding ring icon
        ctx.strokeStyle = CONFIG.colors.cyan;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "barrage": {
        // 3 rocket shapes in a spread
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 12;
        for (const [ox, oa] of [[-r * 0.42, -0.28], [0, 0], [r * 0.42, 0.28]]) {
          ctx.save();
          ctx.translate(ox, 0);
          ctx.rotate(oa);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.85);
          ctx.lineTo(r * 0.22, r * 0.4);
          ctx.lineTo(0, r * 0.15);
          ctx.lineTo(-r * 0.22, r * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "overcharged": {
        // Lightning bolt in gold/purple
        ctx.strokeStyle = "#cc66ff";
        ctx.shadowColor = "#cc66ff";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r);
        ctx.lineTo(-r * 0.2, -r * 0.1);
        ctx.lineTo(r * 0.25, -r * 0.1);
        ctx.lineTo(-r * 0.2, r);
        ctx.stroke();
        break;
      }
      case "siege": {
        // Large rocket with orange aura
        ctx.fillStyle = "#ff8800";
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.32, r * 0.5);
        ctx.lineTo(0, r * 0.2);
        ctx.lineTo(-r * 0.32, r * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "reactor": {
        // Concentric rings in teal
        ctx.strokeStyle = "#00ffcc";
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      default: {
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawFallbackShip(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(25, 26);
    ctx.lineTo(0, 14);
    ctx.lineTo(-25, 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFallbackEnemy(ctx, x, y, r, boss) {
    ctx.fillStyle = boss ? CONFIG.colors.red : CONFIG.colors.pink;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = boss ? 20 : 12;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.lineTo(x + r, y - r);
    ctx.lineTo(x, y - r * 0.45);
    ctx.lineTo(x - r, y - r);
    ctx.closePath();
    ctx.fill();
  }
}
