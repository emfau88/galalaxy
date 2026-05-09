import { CONFIG, RENDER_CONFIG } from "../config.js";
import { clamp, lerp, dist2 } from "../utils.js";

export class Enemy {
  constructor(game, type, x, y, boss = false) {
    this.game = game;
    this.type = type;
    this.x = x;
    this.y = y;
    this.boss = boss;
    const def = Enemy.defs[type];
    this.r = boss ? def.r * 1.3 : def.r;
    this.maxHp = boss ? def.hp * 6 : def.hp;
    this.hp = this.maxHp;
    this.speed = boss ? def.speed * 0.45 : def.speed;
    this.damagePower = boss ? def.damage * 1.8 : def.damage;
    this.score = boss ? def.score * 8 : def.score;
    this.imgKey = def.img;
    this.projVisual = Enemy._projVisual(type, boss);
    this.hitFlash = 0;
    this.fireTimer = boss ? 1.2 : 2.5 + Math.random() * 2;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  update(dt) {
    const p = this.game.player;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.boss) {
      // Boss enters arena and holds position in upper-middle area
      const holdY = 185;
      const holdX = CONFIG.designW / 2 + Math.sin(this.game.time * 0.55 + this.wobble) * 72;
      this.x = lerp(this.x, holdX, clamp(dt * 1.4, 0, 1));
      this.y = lerp(this.y, holdY, clamp(dt * (this.y < 0 ? 2.2 : 0.9), 0, 1));
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
        this.fireTimer = 1.1;
        const spread = 0.18;
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * spread;
          this.game.spawnProjectile(this.x, this.y + 14, a, 280, 10, "enemy", "enemy", this.projVisual);
        }
      } else {
        this.fireTimer = 1.6; // longer pause after wide spread
        const spread = 0.30;
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * spread;
          const spd = i === 0 ? 260 : 220; // centre shot slower — more readable to dodge
          const dmg = i === 0 ? 14 : 8;
          this.game.spawnProjectile(this.x, this.y + 14, a, spd, dmg, "enemy", "enemy", this.projVisual);
        }
      }
    } else if (!this.boss && Enemy._canFire(this.type) && this.fireTimer <= 0) {
      this.fireTimer = 2.8;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.game.spawnProjectile(this.x, this.y + 12, ang, 210, 7, "enemy", "enemy", this.projVisual);
    }

    if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
      p.damage(this.damagePower);
      this.damage(this.boss ? 4 : 999);
    }

    if (!this.boss && (this.x < -160 || this.x > CONFIG.designW + 160 || this.y > CONFIG.designH + 180)) this.dead = true;
  }

  damage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.11;
    this.game.burst(this.x, this.y, CONFIG.colors.cyan, 5);
    if (this.hp <= 0) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
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
    ctx.rotate(Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2);

    const image = img.get(this.imgKey);
    const rc = RENDER_CONFIG.enemies[this.type] || { w: this.r * 2, h: this.r * 2 };
    const size = this.boss ? rc.w * 1.85 : rc.w;

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
