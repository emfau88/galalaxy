// Signature ability systems: Beam Cannon, Pulse Wave.
// Called from Player.update(dt) for timers; drawing called from Game.drawWorld().

import { CONFIG } from "../config.js";
import { clamp } from "../utils.js";

// ─── Beam Cannon ─────────────────────────────────────────────────────────────

const BEAM_COOLDOWN = 7.0;   // seconds between beams
const BEAM_DURATION = 0.55;  // seconds beam is visible
const BEAM_DAMAGE   = 48;    // per enemy hit
const BEAM_WIDTH    = 24;    // collision half-width (design px) — wider for fair mobile hits
const BEAM_LENGTH   = CONFIG.designH;

export function updateBeam(player, dt) {
  if (!player.beam) return;
  player._beamCooldown = (player._beamCooldown ?? 0) - dt;
  if (player._beamActive) {
    player._beamLife -= dt;
    if (player._beamLife <= 0) player._beamActive = false;
  }
  if (player._beamCooldown <= 0) {
    fireBeam(player);
  }
}

function fireBeam(player) {
  // Cooldown shrinks per level: L1=7s, L2=6s, L3=5s
  player._beamCooldown = Math.max(5.0, BEAM_COOLDOWN - (player.beam - 1) * 1.0);
  player._beamActive   = true;
  player._beamLife     = BEAM_DURATION;

  const game = player.game;
  game.shake = Math.max(game.shake, 2.5);

  // Hit all enemies in a vertical column above the player
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (e.x >= player.x - BEAM_WIDTH && e.x <= player.x + BEAM_WIDTH && e.y < player.y) {
      e.damage(BEAM_DAMAGE + player.beam * 18);
    }
  }
}

export function drawBeam(ctx, player, time) {
  if (!player._beamActive) return;
  const t = player._beamLife / BEAM_DURATION;   // 1→0 as beam fades
  const alpha = t > 0.75 ? 1 : t / 0.75;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer glow column
  const grd = ctx.createLinearGradient(player.x - 28, 0, player.x + 28, 0);
  grd.addColorStop(0,   "rgba(88,230,255,0)");
  grd.addColorStop(0.35,"rgba(88,230,255,0.22)");
  grd.addColorStop(0.5, "rgba(200,240,255,0.5)");
  grd.addColorStop(0.65,"rgba(88,230,255,0.22)");
  grd.addColorStop(1,   "rgba(88,230,255,0)");
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = grd;
  ctx.fillRect(player.x - 28, 0, 56, player.y - 20);

  // Bright core
  const core = ctx.createLinearGradient(player.x - 6, 0, player.x + 6, 0);
  core.addColorStop(0, "rgba(180,255,255,0)");
  core.addColorStop(0.5,"rgba(255,255,255,0.92)");
  core.addColorStop(1, "rgba(180,255,255,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = core;
  ctx.fillRect(player.x - 6, 0, 12, player.y - 22);

  // Muzzle flash at ship tip
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = CONFIG.colors.cyan;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(player.x, player.y - 28, 9 * alpha, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ─── Pulse Wave ──────────────────────────────────────────────────────────────

const PULSE_COOLDOWN  = 9.0;   // seconds between pulses
const PULSE_DURATION  = 0.65;  // ring expand time
const PULSE_MAX_R     = 155;   // maximum radius (design px)
const PULSE_DAMAGE    = 18;    // moderate — wave is primarily a space-control tool
const PULSE_KNOCKBACK = 200;   // px/s impulse — strong push is the point

export function updatePulse(player, dt) {
  if (!player.pulse && !player.pulseReactor) return;
  player._pulseCooldown = (player._pulseCooldown ?? 0) - dt;
  if (player._pulseActive) {
    player._pulseLife -= dt;
    const frac = 1 - player._pulseLife / PULSE_DURATION;
    // Radius grows per level: L1=155, L2=175, L3=195 (reactor gets +30% on top)
    const baseR = PULSE_MAX_R + (player.pulse - 1) * 20;
    player._pulseR = frac * (player.pulseReactor ? baseR * 1.3 : baseR);
    if (player._pulseLife <= 0) player._pulseActive = false;
  }
  if (player._pulseCooldown <= 0) {
    firePulse(player);
  }
}

function firePulse(player) {
  // Reactor keystone fires automatically on a fixed 6s rhythm.
  player._pulseCooldown = player.pulseReactor ? 6.0 : PULSE_COOLDOWN;
  player._pulseActive   = true;
  player._pulseLife     = PULSE_DURATION;
  player._pulseR        = 0;

  const game = player.game;
  const dmg = PULSE_DAMAGE + player.pulse * 10;
  const baseHitR = PULSE_MAX_R + (player.pulse - 1) * 20;
  const hitR = player.pulseReactor ? baseHitR * 1.3 : baseHitR;

  for (const e of game.enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x, dy = e.y - player.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < hitR + e.r) {
      e.damage(dmg);
      // Knockback: push enemy outward
      if (d > 0.01) {
        const push = PULSE_KNOCKBACK + player.pulse * 40;
        e.x += (dx / d) * push * PULSE_DURATION;
        e.y += (dy / d) * push * PULSE_DURATION;
      }
    }
  }
  game.shake = Math.max(game.shake, 1.8);
}

export function drawPulse(ctx, player) {
  if (!player._pulseActive) return;
  const t = player._pulseLife / PULSE_DURATION;  // 1→0 fading out
  const r = player._pulseR;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer ring
  ctx.globalAlpha = t * 0.55;
  ctx.strokeStyle = CONFIG.colors.cyan;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = CONFIG.colors.cyan;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner secondary ring (slight lag)
  if (r > 20) {
    ctx.globalAlpha = t * 0.3;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}
