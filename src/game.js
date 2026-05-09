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
import { FLEETS, pickFleetEnemy } from "./data/fleets.js";
import { emitTrail, spawnHitSparks, spawnDeathBurst, emitSectorDust, spawnBossEntrance } from "./systems/fx.js";

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
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.zaps = [];
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

    this.initStars();
    this.loader.load().then(() => {
      if (this.state === "loading") this.state = "title";
    });

    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

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
    this.shake = 0;
    this.state = "playing";
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

    for (const p of this.particles) p.update(dt);
    for (const z of this.zaps) z.life -= dt;
    this.particles = this.particles.filter(p => !p.dead).slice(-CONFIG.particleCap);
    this.zaps = this.zaps.filter(z => z.life > 0);

    this.shake = Math.max(0, this.shake - dt * 20);
    this.bossWarning = Math.max(0, this.bossWarning - dt);
    this.sectorTransition = Math.max(0, this.sectorTransition - dt);
  }

  handleTap(x, y) {
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
    const interval = clamp(1.0 - difficulty * 0.08, 0.22, 1.0);

    if (this.spawnTimer <= 0 && this.enemies.length < CONFIG.enemyCap) {
      this.spawnTimer = interval;
      const fleet = FLEETS[sector.fleet];
      this.spawnEnemy(pickFleetEnemy(fleet, sectorProgress), false);
      if (difficulty > 1.8 && Math.random() < 0.2) {
        this.spawnEnemy(pickFleetEnemy(fleet, sectorProgress), false);
      }
    }
  }

  onBossKilled() {
    this.bossActive = false;
    if (this.currentSectorIndex >= SECTORS.length - 1) {
      SaveSystem.setBest(this.score);
      this.best = SaveSystem.best();
      this.state = "victory";
    } else {
      this.currentSectorIndex++;
      this.sectorTimer = SECTORS[this.currentSectorIndex].duration;
      this.sectorTransition = 3.0;
    }
  }

  spawnEnemy(type, boss) {
    // Weighted side selection: top 45%, left 22.5%, right 22.5%, bottom 10%.
    // Bottom is reduced because the thumb covers that area on mobile.
    const r = Math.random();
    const side = r < 0.45 ? 0 : r < 0.675 ? 1 : r < 0.90 ? 2 : 3;
    let x, y;
    if (boss) {
      x = CONFIG.designW / 2;
      y = -90;
    } else if (side === 0) {
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
    this.enemies.push(new Enemy(this, type, x, y, boss));
    if (boss) this.bossEntrance(x, y);
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
          if (this.dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) ** 2) {
            e.damage(pr.dmg);
            pr.dead = true;
            spawnHitSparks(this, pr.x, pr.y, pr);
            if (pr.kind === "rocket") this.explosion(pr.x, pr.y, 16);
            break;
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
  }

  // Inline dist2 for use within Game (entities import from utils.js directly)
  dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  spawnProjectile(x, y, a, speed, dmg, owner, kind, visualKey = null) {
    if (this.projectiles.length >= CONFIG.projectileCap) return;
    this.projectiles.push(new Projectile(x, y, a, speed, dmg, owner, kind, visualKey));
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
      this.state = "levelUp";
    }
  }

  closestEnemy(x, y, range) {
    let best = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = this.dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
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

  spawnZap(x1, y1, x2, y2) {
    this.zaps.push({ x1, y1, x2, y2, life: 0.11, max: 0.11 });
    this.burst(x2, y2, CONFIG.colors.pink, 8);
  }

  deathBurst(enemy) { spawnDeathBurst(this, enemy.x, enemy.y, enemy); }
  bossEntrance(x, y) { spawnBossEntrance(this, x, y); }

  // ── Rendering ──────────────────────────────────────────────────────────────

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1, 0, 0, window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = CONFIG.colors.bg;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(sx, sy);

    this.drawBackground(ctx);
    this.drawWorld(ctx);

    if (this.state === "loading") this.drawLoading(ctx);
    if (this.state === "title") this.drawTitle(ctx);
    if (this.state === "levelUp") this.upgrades.draw(ctx, this.loader);
    if (this.state === "gameOver") this.drawGameOver(ctx);
    if (this.state === "victory") this.drawVictory(ctx);
    if (this.state === "paused") this.drawPaused(ctx);
    if (this.state === "playing") this.drawHud(ctx);
    if (this.state === "playing" && this.sectorTransition > 0) this.drawSectorTransition(ctx);

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

    // Sector tint overlay
    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;
    ctx.fillStyle = `rgba(${tr},${tg},${tb},0.07)`;
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
    this.player.draw(ctx, this.loader);

    for (const z of this.zaps) {
      const a = z.life / z.max;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      ctx.strokeStyle = CONFIG.colors.pink;
      ctx.lineWidth = 3;
      ctx.shadowColor = CONFIG.colors.pink;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      const mx = (z.x1 + z.x2) / 2 + (Math.random() - 0.5) * 16;
      const my = (z.y1 + z.y2) / 2 + (Math.random() - 0.5) * 16;
      ctx.lineTo(mx, my);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) p.draw(ctx);

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

  drawHud(ctx) {
    ctx.save();
    // HUD panel
    ctx.fillStyle = "rgba(2,6,20,0.72)";
    ctx.strokeStyle = "rgba(88,180,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(12, 12, CONFIG.designW - 24, 70, 16);
    ctx.fill();
    ctx.stroke();

    // Bars
    this.bar(ctx, 26, 26, 158, 11, this.player.hp / this.player.maxHp, CONFIG.colors.red, "HP");
    this.bar(ctx, 26, 49, 158, 11, this.player.shield / this.player.maxShield, CONFIG.colors.cyan, "SH");
    this.bar(ctx, 216, 49, 165, 11, this.xp / this.xpNeed, CONFIG.colors.green, "XP");

    // Score
    ctx.textAlign = "right";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 17px system-ui";
    ctx.fillText(Math.floor(this.score).toString(), 384, 31);

    // Level and time
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 11px system-ui";
    ctx.fillText(`LV ${this.level}  ·  ${fmtTime(this.runTime)}`, 384, 73);

    // Sector display — center of HUD panel
    const sector = SECTORS[this.currentSectorIndex];
    const cx = CONFIG.designW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 9px system-ui";
    ctx.fillText(sector.shortName, cx, 26);

    if (this.bossActive) {
      // Pulsing BOSS text
      const pulse = Math.abs(Math.sin(this.time * 6));
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "800 10px system-ui";
      ctx.fillText("BOSS ACTIVE", cx, 46);
      ctx.globalAlpha = 1;
    } else {
      // Sector timer bar centered under sector name
      const progress = this.sectorTimer / sector.duration;
      const [tr, tg, tb] = sector.tint;
      const barColor = `rgb(${Math.min(255, tr + 80)},${Math.min(255, tg + 80)},${Math.min(255, tb + 120)})`;
      this.bar(ctx, cx - 55, 35, 110, 7, progress, barColor, "");
    }

    // Boss warning HUD badge
    if (this.bossWarning > 0) {
      const a = Math.min(1, this.bossWarning) * Math.abs(Math.sin(this.time * 8));
      ctx.globalAlpha = a;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`⚠ ${sector.name.toUpperCase()} BOSS`, CONFIG.designW / 2, 92);
      ctx.globalAlpha = 1;
    }

    // Boss HP bar — shown below HUD panel while boss is active (skip during warning flash)
    if (this.bossActive && this.bossWarning <= 0) {
      const boss = this.enemies.find(e => e.boss && !e.dead);
      if (boss) {
        const bx = 26, by = 88, bw = CONFIG.designW - 52, bh = 10;
        // Background
        ctx.fillStyle = "rgba(2,6,20,0.82)";
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 14, bw + 8, bh + 20, 8);
        ctx.fill();
        // Label
        ctx.textAlign = "center";
        ctx.fillStyle = CONFIG.colors.red;
        ctx.font = "700 9px system-ui";
        ctx.fillText("DREADNOUGHT", CONFIG.designW / 2, by - 2);
        // HP fraction text
        ctx.fillStyle = CONFIG.colors.dim;
        ctx.font = "600 8px system-ui";
        ctx.fillText(`${Math.ceil(boss.hp)} / ${boss.maxHp}`, CONFIG.designW / 2, by + bh + 9);
        // Bar track
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fill();
        // HP fill
        const hpFrac = boss.hp / boss.maxHp;
        const barColor = hpFrac > 0.5 ? CONFIG.colors.red : hpFrac > 0.25 ? CONFIG.colors.orange : "#ff2020";
        ctx.fillStyle = barColor;
        ctx.shadowColor = barColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(bx, by, Math.max(bh, bw * hpFrac), bh, bh / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  bar(ctx, x, y, w, h, t, color, label) {
    t = clamp(t, 0, 1);
    // Track background
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    // Fill
    if (t > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * t), h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Label
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 8px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(label, x, y - 3);
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
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 40px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 24;
    ctx.fillText("VOID DRIFT", CONFIG.designW / 2, 224);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 15px system-ui";
    ctx.fillText("Galaxy Survivor", CONFIG.designW / 2, 252);

    this.drawButton(ctx, 72, 515, 276, 66, "START RUN");

    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 12px system-ui";
    ctx.fillText("Drag to move · Auto-fire · Survive the fleet", CONFIG.designW / 2, 614);
    ctx.fillText(`Best Score: ${Math.floor(this.best)}`, CONFIG.designW / 2, 638);

    if (this.loader.errors.length) {
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.font = "700 11px system-ui";
      ctx.fillText("Some assets failed. Fallback visuals enabled.", CONFIG.designW / 2, 676);
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
