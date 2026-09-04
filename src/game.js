import { CONFIG, PLAYER_ENGINE_SPEEDS, SECTORS } from "./config.js";
import { ASSET_GROUPS, SECTOR_ASSET_GROUPS } from "./assets.js";
import { $, clamp } from "./utils.js";
import { AssetLoader } from "./assetLoader.js";
import { SaveSystem } from "./saveSystem.js";
import { Input } from "./input.js";
import { Player } from "./entities/player.js";
import { Enemy } from "./entities/enemy.js";
import { UpgradeSystem, createUpgradeCards } from "./systems/upgrades.js";
import { sectorMethods } from "./systems/sectorSystem.js";
import { combatMethods } from "./systems/combatSystem.js";
import { worldRenderingMethods } from "./rendering/worldRenderer.js";
import { hudRenderingMethods } from "./rendering/hudRenderer.js";
import { menuRenderingMethods, VICTORY_PLAY_BUTTON, VICTORY_HANGAR_BUTTON } from "./rendering/menuRenderer.js";
import { emitTrail, emitSectorDust } from "./systems/fx.js";

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
  { title: "EMERGENCY AEGIS", detail: "Keystone: hull hit protection ready", player: { speedLevel: 3, shieldLevel: 2, emergencyAegis: true, invuln: 999 } },
];


export class Game {
  constructor() {
    this.canvas = $("game");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.loader = new AssetLoader();
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.safeTopPx = 0;
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
    this.victoryTestMode = searchParams.get("test") === "victory-screen";
    this.fullRunTestMode = searchParams.get("test") === "full-run";
    this.upgradeCardTestRocketMode = searchParams.get("upgradeFamily") === "rocket";
    this.upgradeCardTestAegisMode = searchParams.get("upgradeFamily") === "aegis";
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
    this.resumeAfterUpgradeState = null;
    this.titleTime = 0;
    this.musicMuted = false;
    this.fullscreenActive = Boolean(document.fullscreenElement);
    this._music = new Audio("assets/music/track1.ogg");
    this._music.loop = true;
    this._music.volume = 0.28;
    // Browsers may block autoplay; handleTap() retries on the first gesture.
    this._music.play().catch(() => {});
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
    window.visualViewport?.addEventListener("resize", () => this.resize());
    document.addEventListener("fullscreenchange", () => {
      this.fullscreenActive = Boolean(document.fullscreenElement);
      this.resize();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") {
        this.prevState = this.state;
        this.state = "paused";
      }
    });

    // Utility controls remain tap-only and sit away from the steering corner.
    const MBX = CONFIG.designW - 52, MBY = CONFIG.designH - 52;
    this._muteBtnZone = { x: MBX, y: MBY, w: 48, h: 48 };
    this.input.exclusionZones.push(this._muteBtnZone);
    this._fullscreenBtnZone = this._fullscreenButtonZone();
    this.fullscreenAvailable = Boolean(document.fullscreenEnabled && this.canvas.requestFullscreen);

    this.initStars();
    this._loadAssetGroups(this._initialAssetGroups()).then(() => {
      if (this.state !== "loading") return;
      if (this.visualTestMode) this.startVisualTest();
      else if (this.upgradeCardTestMode) this.startUpgradeCardTest();
      else if (this.klaedTestMode) this.startKlaedCombatTest();
      else if (this.nairanTestMode) this.startFleetCombatTest("nairan");
      else if (this.nautolanTestMode) this.startFleetCombatTest("nautolan");
      else if (this.hudTestMode) this.startHudLayoutTest();
      else if (this.victoryTestMode) this.startVictoryTest();
      else if (this.fullRunTestMode) {
        import("./qa/fullRunTest.js")
          .then(({ runFullRunTest }) => runFullRunTest(this))
          .catch(error => {
            document.documentElement.dataset.fullRunTest = "fail";
            document.documentElement.dataset.fullRunReport = JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(error);
          });
      }
      else {
        this.state = "title";
        setTimeout(() => this._loadAssetGroups(["shared", "klaed"]), 0);
      }
    });

    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    const viewport = window.visualViewport;
    this.viewportW = Math.max(1, viewport?.width || window.innerWidth);
    this.viewportH = Math.max(1, viewport?.height || window.innerHeight);
    // Keep the backing store aligned with the actually visible mobile area,
    // including browser toolbar transitions that do not change window.innerHeight.
    this.canvas.style.width = `${this.viewportW}px`;
    this.canvas.style.height = `${this.viewportH}px`;
    const deviceDpr = window.devicePixelRatio || 1;
    // On phones the expensive part is not simulation, but compositing many
    // glow-heavy sprites at a full 2× canvas. Pixel art remains crisp at 1.5×
    // while this cuts the backing-store work by roughly 44% versus 2×.
    this.lowEffects = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    this.renderDpr = Math.min(this.lowEffects ? 1.5 : 2, deviceDpr);
    this.particleCap = this.lowEffects ? 96 : CONFIG.particleCap;
    this.zapCap = this.lowEffects ? 10 : 28;
    this.canvas.width = Math.floor(this.viewportW * this.renderDpr);
    this.canvas.height = Math.floor(this.viewportH * this.renderDpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.renderDpr, this.renderDpr);

    const sw = this.viewportW;
    const sh = this.viewportH;
    this.scale = Math.min(sw / CONFIG.designW, sh / CONFIG.designH);
    this.offsetX = (sw - CONFIG.designW * this.scale) / 2;
    this.offsetY = (sh - CONFIG.designH * this.scale) / 2;
    this.safeTopPx = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-top")) || 0;
    if (this._fullscreenBtnZone) this._fullscreenBtnZone = this._fullscreenButtonZone();
  }

  hudHeaderOffsetY() {
    const hudHeight = 74;
    const topPadding = this.safeTopPx + 4;
    if (this.offsetY < topPadding + hudHeight * this.scale) return 0;
    return (topPadding - this.offsetY) / this.scale - 8;
  }

  _fullscreenButtonZone() {
    return { x: CONFIG.designW - 72, y: 59 + this.hudHeaderOffsetY(), w: 28, h: 22 };
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

  _initialAssetGroups() {
    const groups = ["boot"];
    if (this.visualTestMode || this.upgradeCardTestMode) groups.push("shared");
    if (this.klaedTestMode) groups.push("shared", "klaed");
    if (this.nairanTestMode) groups.push("shared", "klaed", "nairan");
    if (this.nautolanTestMode || this.hudTestMode) groups.push("shared", "klaed", "nautolan");
    if (this.victoryTestMode) groups.push("shared", "victory");
    return [...new Set(groups)];
  }

  _assetManifest(groupNames) {
    return Object.assign({}, ...groupNames.map(name => ASSET_GROUPS[name] || {}));
  }

  _loadAssetGroups(groupNames) {
    return this.loader.load(this._assetManifest(groupNames));
  }

  _assetGroupsReady(groupNames) {
    return this.loader.isSettled(this._assetManifest(groupNames));
  }

  _unloadAssetGroups(groupNames) {
    this.loader.unload(this._assetManifest(groupNames));
  }

  _preloadNextSectorAssets() {
    const nextSectorIndex = this.currentSectorIndex + 1;
    const groups = [];
    if (nextSectorIndex < SECTORS.length) groups.push(SECTOR_ASSET_GROUPS[nextSectorIndex]);
    if (nextSectorIndex >= SECTORS.length - 1) groups.push("victory");
    if (groups.length) this._loadAssetGroups([...new Set(groups)]);
  }

  startRun() {
    const requiredGroups = ["shared", SECTOR_ASSET_GROUPS[0]];
    if (!this._assetGroupsReady(requiredGroups)) {
      this.state = "loading";
      this._loadAssetGroups(requiredGroups).then(() => {
        if (this.state === "loading") this.startRun();
      });
      return false;
    }

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
    this.bossRewardTimer = 0;
    this.bossRewardData = null;
    this.resumeAfterUpgradeState = null;
    this.shake = 0;
    this.upgrades._pickCount = 0;
    this.state = "playing";
    this._preloadNextSectorAssets();
    return true;
  }

  startVictoryTest() {
    this.player = new Player(this);
    this.score = 18420;
    this.kills = 147;
    this.runTime = 735;
    this.best = Math.max(this.best, this.score);
    this.state = "victory";
  }

  startVisualTest() {
    this.state = "visualTest";
    this.visualTestIndex = this.visualTestStartIndex;
    this._applyVisualTestStage();
  }

  startUpgradeCardTest() {
    this.player = new Player(this);
    Object.assign(this.player, { speedLevel: 1, shieldLevel: 1, fireLevel: 1, rocket: 1, zapper: 1 });
    this.player.speed = PLAYER_ENGINE_SPEEDS[1];
    this.player.maxShield = 67;
    this.player.shield = this.player.maxShield;
    if (this.upgradeCardTestAegisMode) {
      Object.assign(this.player, { shieldLevel: 2, maxShield: 79, shield: 79 });
      this.upgrades._pickCount = 5;
    }
    const wanted = new Set(this.upgradeCardTestRocketMode
      ? ["rocket", "hp", "magnet"]
      : this.upgradeCardTestAegisMode
        ? ["aegis", "shield", "hp"]
        : ["speed", "shield", "beam"]);
    this.upgrades.choices = this.upgrades.pool.filter(upgrade => wanted.has(upgrade.id));
    this.upgrades.cards = createUpgradeCards(this.upgrades.choices.length);
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
    const type = name => fleet
      ? `${fleet}${name[0].toUpperCase()}${name.slice(1)}`
      : name;
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
      speed: PLAYER_ENGINE_SPEEDS[3],
      maxShield: 103,
      shield: 74,
      fireTimer: Number.MAX_VALUE,
      invuln: Number.POSITIVE_INFINITY,
      emergencyAegis: true,
      aegisCooldown: 0,
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
    this.player.speed = PLAYER_ENGINE_SPEEDS[Math.min(3, this.player.speedLevel)];
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

  toggleFullscreen() {
    if (!this.fullscreenAvailable) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    this.canvas.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  }

  handleTap(x, y) {
    const fz = this._fullscreenBtnZone;
    if (this.fullscreenAvailable && x >= fz.x && x <= fz.x + fz.w && y >= fz.y && y <= fz.y + fz.h) {
      this.toggleFullscreen();
      return;
    }
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
      if (this._hitRect(x, y, VICTORY_PLAY_BUTTON)) this.startRun();
      else if (this._hitRect(x, y, VICTORY_HANGAR_BUTTON)) this.returnToHangar();
    } else if (this.state === "victory") {
      if (this._hitRect(x, y, VICTORY_PLAY_BUTTON)) this.startRun();
      else if (this._hitRect(x, y, VICTORY_HANGAR_BUTTON)) this.returnToHangar();
    } else if (this.state === "levelUp") {
      this.upgrades.handleTap(x, y);
    } else if (this.state === "paused") {
      this.state = "playing";
    } else if (this.state === "bossReward") {
      // The final shard lands before the hint appears, so an impatient tap
      // cannot cut off the reward's visual payoff.
      if (this.bossRewardTimer < 2.0) this._endBossReward();
    } else if (this.state === "visualTest") {
      this.nextVisualTestStage();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.renderDpr, 0, 0, this.renderDpr, 0, 0);
    ctx.clearRect(0, 0, this.viewportW, this.viewportH);
    ctx.fillStyle = CONFIG.colors.bg;
    ctx.fillRect(0, 0, this.viewportW, this.viewportH);
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
    if (this.state === "playing") this.drawHud(ctx);
    if (this.state === "playing" && this.sectorTransition > 0) this.drawSectorTransition(ctx);
    this.drawFullscreenButton(ctx);
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


}

Object.defineProperties(Game.prototype, {
  ...sectorMethods,
  ...combatMethods,
  ...worldRenderingMethods,
  ...hudRenderingMethods,
  ...menuRenderingMethods,
});
