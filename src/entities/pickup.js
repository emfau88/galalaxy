import { CONFIG } from "../config.js";
import { dist2, lerp } from "../utils.js";

export const COMBAT_PICKUP_TYPES = Object.freeze({
  repair: {
    label: "REPAIR",
    color: "#e35a62",
    assetKey: "combatPickupRepair",
    amount: 18,
  },
  shield: {
    label: "SHIELD CELL",
    color: "#3b9bd0",
    assetKey: "combatPickupShield",
    amount: 28,
  },
  overdrive: {
    label: "OVERDRIVE",
    color: "#e7a844",
    assetKey: "combatPickupOverdrive",
    duration: 7,
  },
});

export const COMBAT_PICKUP_DROP_CONFIG = Object.freeze({
  firstEligibleAt: 24,
  cooldownSeconds: 28,
  maxActive: 1,
  baseChance: 0.025,
  scoreChanceCap: 0.035,
  scoreDivisor: 2400,
});

export class XpPickup {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.r = 8 + Math.min(8, value);
    this.life = 12;
    this.dead = false;
    this.t = Math.random() * 10;
  }

  update(dt, game) {
    this.life -= dt;
    this.t += dt;
    const p = game.player;
    const magnet = 88 + p.magnet * 48;
    const d = Math.sqrt(dist2(this.x, this.y, p.x, p.y));
    if (d < magnet) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const s = lerp(120, 620, 1 - d / magnet);
      this.x += Math.cos(a) * s * dt;
      this.y += Math.sin(a) * s * dt;
    } else {
      this.y += Math.sin(this.t * 2) * 7 * dt;
    }
    if (d < p.r + this.r) {
      game.gainXp(this.value);
      game.burst(this.x, this.y, CONFIG.colors.green, 8);
      this.dead = true;
    }
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(this.x, this.y);
    const pulse = 1 + Math.sin(this.t * 8) * 0.12;
    ctx.fillStyle = CONFIG.colors.green;
    ctx.shadowColor = CONFIG.colors.green;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-2, -3, this.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class CombatPickup {
  constructor(x, y, kind) {
    if (!COMBAT_PICKUP_TYPES[kind]) throw new Error(`Unknown combat pickup: ${kind}`);
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.r = 19;
    this.life = 10;
    this.dead = false;
    this.t = Math.random() * 10;
  }

  update(dt, game) {
    this.life -= dt;
    this.t += dt;
    const p = game.player;
    const magnet = 104 + p.magnet * 48;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance < magnet && distance > 0.001) {
      const speed = lerp(150, 650, 1 - distance / magnet);
      this.x += dx / distance * speed * dt;
      this.y += dy / distance * speed * dt;
    } else {
      this.y += Math.sin(this.t * 2.4) * 5 * dt;
    }

    if (distance < p.r + this.r) {
      this.apply(game);
      this.dead = true;
    }
    if (this.life <= 0) this.dead = true;
  }

  apply(game) {
    const p = game.player;
    const definition = COMBAT_PICKUP_TYPES[this.kind];
    let appliedAmount = 0;
    if (this.kind === "repair") {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + definition.amount);
      appliedAmount = p.hp - before;
    } else if (this.kind === "shield") {
      const before = p.shield;
      p.shield = Math.min(p.maxShield, p.shield + definition.amount);
      appliedAmount = p.shield - before;
      p.shieldRechargeDelay = Math.min(p.shieldRechargeDelay, 0.4);
    } else if (this.kind === "overdrive") {
      p.overdriveTimer = Math.max(p.overdriveTimer, definition.duration);
      p.fireTimer = Math.min(p.fireTimer, 0.05);
      appliedAmount = definition.duration;
    }
    game.runStats?.pickup?.(game, this.kind, appliedAmount);
    game.sounds?.play("pickup");
    game.burst(this.x, this.y, definition.color, 16);
  }

  draw(ctx, game) {
    const definition = COMBAT_PICKUP_TYPES[this.kind];
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);

    ctx.shadowColor = definition.color;
    ctx.shadowBlur = game.lowEffects ? 0 : 8;
    if (this.life < 2.5) ctx.globalAlpha = 0.45 + Math.abs(Math.sin(this.t * 10)) * 0.55;

    const image = definition.assetKey ? game.loader.get(definition.assetKey) : null;
    if (image) {
      game.drawAsset(ctx, image, 0, 0, 44, 44);
    } else {
      ctx.fillStyle = definition.color;
      ctx.fillRect(-8, -2.5, 16, 5);
      ctx.fillRect(-2.5, -8, 5, 16);
    }
    ctx.restore();
  }
}
