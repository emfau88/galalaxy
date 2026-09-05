import { CONFIG, RENDER_CONFIG } from "../config.js";
import { Projectile } from "../entities/projectile.js";
import { XpPickup } from "../entities/pickup.js";
import { Particle } from "../entities/particle.js";
import { spawnHitSparks, spawnDeathBurst, spawnBossEntrance } from "./fx.js";
import { enemyVisualFor } from "../data/enemyVisuals.js";

class CombatMethods {
  updateCollections(dt) {
    for (const collection of [this.enemies, this.projectiles, this.pickups]) {
      for (const entity of collection) {
        if (this.state !== "playing") return;
        if (!entity.dead) entity.update(dt, this);
      }
    }
  }

  handleCollisions() {
    for (const pr of this.projectiles) {
      if (this.state !== "playing") return;
      if (pr.dead) continue;
      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (pr.hitTargets.has(e)) continue;
          if (this.dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) ** 2) {
            e.damage(pr.dmg);
            if (this.state !== "playing") return;
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
        if (pr.hitsCircle(p.x, p.y, p.r)) {
          p.damage(pr.dmg, { kind: "projectile", visualKey: pr.visualKey });
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
      this.pendingUpgrades++;
    }
    if (this.pendingUpgrades > 0 && this.state !== "levelUp") this.showNextUpgrade();
  }

  showNextUpgrade() {
    this.input.cancelMovement();
    this.state = "levelUp";
    this.upgrades.roll();
  }

  finishUpgrade() {
    this.pendingUpgrades = Math.max(0, this.pendingUpgrades - 1);
    if (this.pendingUpgrades > 0) {
      this.showNextUpgrade();
      return;
    }
    this.state = this.resumeAfterUpgradeState || "playing";
    this.resumeAfterUpgradeState = null;
    if (this.state === "victory") this.finishRun("victory");
  }

  clearArena() {
    // Mark detached objects dead as callbacks may still hold a reference during
    // the boss-killing update. Clearing never awards score for surviving ships.
    for (const e of this.enemies) {
      e.dead = true;
      e.pendingShots = [];
    }
    for (const p of this.projectiles) p.dead = true;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.zaps = [];
    this.enemyDeaths = [];
    this.player.pendingWeaponShots = [];
    this.player.weaponAnimations = Object.create(null);
    this.player._pulseActive = false;
    this.input.cancelMovement();
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

  spawnZap(x1, y1, x2, y2, secondary = false, intensity = 1) {
    const power = Math.max(0.65, Math.min(1.9, intensity));
    // The primary arc needs enough screen time to remain readable while the
    // player is dragging quickly on a phone. Chain arcs stay short and crisp.
    const life = (secondary ? 0.13 : 0.24) * (0.92 + power * 0.08);
    if (this.zaps.length < this.zapCap) {
      this.zaps.push({ x1, y1, x2, y2, life, max: life, secondary, power });
    }
    this.burst(x2, y2, CONFIG.colors.pink, Math.round((secondary ? 5 : 18) * Math.min(1.25, power)));
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
}

export const combatMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(CombatMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
