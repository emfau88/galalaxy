// FX helper module — pure visual effects, no gameplay logic.
// All functions accept the `game` object to push into game.particles / draw directly.

import { CONFIG } from "../config.js";

// ─── Fleet colour palettes ───────────────────────────────────────────────────

const FLEET_COLORS = {
  klaed:    { primary: "#ff5533", secondary: "#ff9922", glow: "#ff2020" },
  nairan:   { primary: "#22ffcc", secondary: "#44aaff", glow: "#00ffcc" },
  nautolan: { primary: "#cc44ff", secondary: "#ff44cc", glow: "#aa00ff" },
  player:   { primary: "#58e6ff", secondary: "#ffffff", glow: "#58e6ff" },
};

// Returns the colour set for a visualKey or owner string.
function colorsFor(visualKey, owner) {
  if (owner === "player") return FLEET_COLORS.player;
  if (!visualKey) return FLEET_COLORS.klaed;
  if (visualKey.startsWith("nairan"))   return FLEET_COLORS.nairan;
  if (visualKey.startsWith("nautolan")) return FLEET_COLORS.nautolan;
  return FLEET_COLORS.klaed;
}

// ─── Lightweight particle push ───────────────────────────────────────────────

function pushParticle(game, x, y, vx, vy, color, life, size) {
  if (game.particles.length >= CONFIG.particleCap) return;
  // Inline object — avoids Particle class import and is identical in structure
  game.particles.push({ x, y, vx, vy, color, life, max: life, size, dead: false,
    update(dt) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= 1 - 2.2 * dt; this.vy *= 1 - 2.2 * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    },
    draw(ctx) {
      const a = Math.max(0, this.life / this.max);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.3 + a * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

// ─── 1. PROJECTILE TRAIL ─────────────────────────────────────────────────────

// Call from Projectile.update() — but we wire it via the game draw loop instead
// to avoid circular imports. Trail emitters are driven by game.updateTrails().

export function emitTrail(game, pr) {
  // Only emit every other frame equivalent via randomised gate — cheap mobile check
  if (Math.random() > 0.55) return;
  const cols = colorsFor(pr.visualKey, pr.owner);
  const isBoss = pr.visualKey && pr.visualKey.endsWith("Boss");
  const isPlayer = pr.owner === "player";

  // Trail length / brightness by type
  const life = isBoss ? 0.22 : isPlayer ? 0.12 : 0.15;
  const size = isBoss ? 2.8 : isPlayer ? 2.2 : 1.8;
  const spread = 12;

  // Emit 1 trail particle (2 for boss)
  const count = isBoss ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * spread * 0.3;
    const oy = (Math.random() - 0.5) * spread * 0.3;
    // Velocity opposite to travel direction, faint
    const spd = (Math.random() * 20 + 10);
    const ang = Math.atan2(pr.vy, pr.vx) + Math.PI + (Math.random() - 0.5) * 0.5;
    pushParticle(game,
      pr.x + ox, pr.y + oy,
      Math.cos(ang) * spd, Math.sin(ang) * spd,
      i === 0 ? cols.primary : cols.secondary,
      life, size
    );
  }
}

// ─── 2. IMPACT FX ────────────────────────────────────────────────────────────

export function spawnHitSparks(game, x, y, pr) {
  const cols = colorsFor(pr.visualKey, pr.owner);
  const impactAng = Math.atan2(pr.vy, pr.vx);
  const count = 4;

  // Core flash ring — drawn as a short-lived ring particle
  pushRing(game, x, y, cols.glow, 7, 0.12);

  // Directional sparks
  for (let i = 0; i < count; i++) {
    const scatter = (Math.random() - 0.5) * 1.6;
    const a = impactAng + scatter;
    const spd = Math.random() * 140 + 60;
    pushParticle(game, x, y, Math.cos(a) * spd, Math.sin(a) * spd,
      i < 2 ? cols.secondary : cols.primary,
      Math.random() * 0.18 + 0.08, Math.random() * 1.5 + 0.8);
  }
}

// ─── 3. DEATH FX ─────────────────────────────────────────────────────────────

export function spawnDeathBurst(game, x, y, enemy) {
  const fleet = enemy.type.startsWith("nairan") ? "nairan"
              : enemy.type.startsWith("nautolan") ? "nautolan" : "klaed";
  const fc = FLEET_COLORS[fleet];
  const isBoss = enemy.boss;

  const particleCount = isBoss ? 14 : 7;
  const ringRadius   = isBoss ? 28 : 14;
  const ringLife     = isBoss ? 0.5 : 0.28;
  const coreLife     = isBoss ? 0.38 : 0.18;

  // Expanding ring
  pushRing(game, x, y, fc.glow, ringRadius, ringLife);
  if (isBoss) pushRing(game, x, y, fc.secondary, ringRadius * 1.6, ringLife * 0.7);

  // Core flash
  pushParticle(game, x, y, 0, 0, "#ffffff", coreLife, isBoss ? 9 : 5);
  pushParticle(game, x, y, 0, 0, fc.primary, coreLife * 1.3, isBoss ? 6 : 3.5);

  // Debris sparks
  for (let i = 0; i < particleCount; i++) {
    const a = (i / particleCount) * Math.PI * 2 + Math.random() * 0.6;
    const spd = Math.random() * (isBoss ? 200 : 120) + (isBoss ? 60 : 30);
    const col = i % 2 === 0 ? fc.primary : fc.secondary;
    pushParticle(game, x, y, Math.cos(a) * spd, Math.sin(a) * spd,
      col, Math.random() * (isBoss ? 0.55 : 0.3) + 0.12,
      Math.random() * (isBoss ? 3.5 : 2) + 1);
  }
}

// ─── 5. SECTOR ATMOSPHERE DUST ───────────────────────────────────────────────

// Sector dust configs
const SECTOR_DUST = [
  // Sector 0 — Kla'ed: warm aggressive
  { color: "#ff6622", altColor: "#ffaa44", alpha: 0.32, rate: 0.04, size: 1.4, streak: true },
  // Sector 1 — Nairan: clean technical
  { color: "#22ffee", altColor: "#44aaff", alpha: 0.28, rate: 0.035, size: 1.1, streak: false },
  // Sector 2 — Nautolan: dense mystical
  { color: "#cc44ff", altColor: "#ff44cc", alpha: 0.35, rate: 0.05, size: 1.6, streak: true },
  // Sector 3 — Void Core: unstable
  { color: "#ff2244", altColor: "#ff8800", alpha: 0.4, rate: 0.06, size: 1.8, streak: true },
];

export function emitSectorDust(game, dt) {
  const cfg = SECTOR_DUST[game.currentSectorIndex];
  if (!cfg || Math.random() > cfg.rate * 60 * dt) return; // rate = particles/sec approx
  if (game.particles.length >= CONFIG.particleCap - 4) return;

  const W = CONFIG.designW;
  const x = Math.random() * W;
  const y = Math.random() * -20 - 5;
  const vy = Math.random() * 45 + 20;
  const vx = (Math.random() - 0.5) * 18;
  const col = Math.random() < 0.6 ? cfg.color : cfg.altColor;

  pushParticle(game, x, y, vx, vy, col, Math.random() * 1.8 + 0.8, cfg.size * (0.7 + Math.random() * 0.6));
}

// ─── RING PARTICLE ───────────────────────────────────────────────────────────
// Ring particles are stored like regular particles but draw as an expanding stroke arc.

function pushRing(game, x, y, color, startR, life) {
  if (game.particles.length >= CONFIG.particleCap) return;
  game.particles.push({
    x, y, color, life, max: life, r: startR, dead: false,
    vx: 0, vy: 0,
    update(dt) {
      this.r += 55 * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    },
    draw(ctx) {
      const a = Math.max(0, this.life / this.max);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });
}

// ─── BOSS ENTRANCE PULSE ─────────────────────────────────────────────────────

export function spawnBossEntrance(game, x, y) {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      if (game.state !== "playing") return;
      pushRing(game, x, y, CONFIG.colors.red, 10 + i * 8, 0.55);
      for (let j = 0; j < 5; j++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 90 + 40;
        pushParticle(game, x, y, Math.cos(a) * spd, Math.sin(a) * spd,
          CONFIG.colors.red, 0.4, 2.5);
      }
    }, i * 180);
  }
}
