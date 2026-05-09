import { CONFIG, RENDER_CONFIG, STRIP_RATIO } from "./config.js";
import { ASSETS } from "./assets.js";
import { $, clamp, lerp, dist2, fmtTime } from "./utils.js";
import { AssetLoader } from "./assetLoader.js";
import { SaveSystem } from "./saveSystem.js";
import { Input } from "./input.js";

class Player {
  constructor(game) {
    this.game = game;
    this.x = CONFIG.designW / 2;
    this.y = CONFIG.designH - 135;
    this.vx = 0;
    this.vy = 0;
    this.r = CONFIG.playerRadius;
    this.maxHp = 100;
    this.hp = 100;
    this.maxShield = 55;
    this.shield = 35;
    this.speed = 360;
    this.fireRate = 0.28;
    this.fireTimer = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.twin = 0;
    this.rocket = 0;
    this.zapper = 0;
    this.magnet = 0;
    this.shieldRegen = 2.2;
    this.bank = 0;
  }

  update(dt) {
    const input = this.game.input;
    let tx = this.x;
    let ty = this.y;

    if (input.active && this.game.state === "playing") {
      tx = clamp(input.worldX, 36, CONFIG.designW - 36);
      ty = clamp(input.worldY, 88, CONFIG.designH - 38);
    }

    const oldX = this.x;
    this.x = lerp(this.x, tx, clamp(dt * 12, 0, 1));
    this.y = lerp(this.y, ty, clamp(dt * 12, 0, 1));
    this.vx = (this.x - oldX) / Math.max(dt, 0.001);
    this.bank = lerp(this.bank, clamp(this.vx / 520, -0.35, 0.35), clamp(dt * 9, 0, 1));

    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shield = clamp(this.shield + this.shieldRegen * dt, 0, this.maxShield);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireRate;
      this.fire();
    }
  }

  fire() {
    const g = this.game;
    const shots = this.twin > 0 ? [-9, 9] : [0];
    for (const off of shots) {
      g.spawnProjectile(this.x + off, this.y - 28, -Math.PI / 2, 640, 11 + this.twin * 1.5, "player", "laser");
    }

    if (this.rocket > 0 && Math.random() < 0.18 + this.rocket * 0.04) {
      const target = g.closestEnemy(this.x, this.y, 420);
      const ang = target ? Math.atan2(target.y - this.y, target.x - this.x) : -Math.PI / 2;
      g.spawnProjectile(this.x, this.y - 25, ang, 420, 26 + this.rocket * 5, "player", "rocket");
    }

    if (this.zapper > 0 && Math.random() < 0.11 + this.zapper * 0.025) {
      const target = g.closestEnemy(this.x, this.y, 300);
      if (target) {
        target.damage(12 + this.zapper * 5);
        g.spawnZap(this.x, this.y - 10, target.x, target.y);
      }
    }
  }

  damage(amount) {
    if (this.invuln > 0) return;
    let left = amount;
    if (this.shield > 0) {
      const used = Math.min(this.shield, left);
      this.shield -= used;
      left -= used;
    }
    this.hp -= left;
    this.hitFlash = 0.14;
    this.invuln = 0.28;
    this.game.shake = Math.max(this.game.shake, 4);
    this.game.burst(this.x, this.y, left > 0 ? CONFIG.colors.red : CONFIG.colors.cyan, 14);
    if (this.hp <= 0) this.game.endRun();
  }

  damageSprite() {
    const t = this.hp / this.maxHp;
    if (t > 0.72) return "playerFull";
    if (t > 0.44) return "playerSlight";
    if (t > 0.18) return "playerDamaged";
    return "playerVeryDamaged";
  }

  draw(ctx, img) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);

    // Engine flame — drawn behind ship
    const flame = 0.8 + Math.sin(this.game.time * 22) * 0.18;
    ctx.globalAlpha = 0.82;
    const grad = ctx.createRadialGradient(0, 30, 1, 0, 42, 28);
    grad.addColorStop(0, "rgba(88,230,255,1)");
    grad.addColorStop(0.45, "rgba(54,115,255,0.52)");
    grad.addColorStop(1, "rgba(54,115,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 34, 13 * flame, 26 * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary wider glow
    ctx.globalAlpha = 0.28;
    const grad2 = ctx.createRadialGradient(0, 36, 1, 0, 50, 40);
    grad2.addColorStop(0, "rgba(88,200,255,0.8)");
    grad2.addColorStop(1, "rgba(54,115,255,0)");
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.ellipse(0, 38, 22 * flame, 38 * flame, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine overlay — 48×48 single frame, safe to draw
    const engine = img.get("playerEngine");
    ctx.globalAlpha = 0.7;
    if (engine) this.game.drawAsset(ctx, engine, 0, 20, RENDER_CONFIG.playerEngine.w, RENDER_CONFIG.playerEngine.h);

    // Weapon canvas icon — drawn behind ship body
    ctx.globalAlpha = 0.88;
    if (this.rocket > 0) {
      this.game.drawWeaponIcon(ctx, "rocket", 0, -18);
    } else if (this.zapper > 0) {
      this.game.drawWeaponIcon(ctx, "zapper", 0, -18);
    } else {
      this.game.drawWeaponIcon(ctx, "auto", 0, -18);
    }

    // Ship body
    const ship = img.get(this.damageSprite());
    ctx.globalAlpha = 1;
    if (ship) this.game.drawAsset(ctx, ship, 0, 0, RENDER_CONFIG.player.w, RENDER_CONFIG.player.h);
    else this.game.drawFallbackShip(ctx, 0, 0, 1);

    // Shield ring — canvas drawn, no strip needed
    if (this.shield > 4) {
      const shieldFrac = this.shield / this.maxShield;
      const pulse = Math.sin(this.game.time * 5);
      ctx.globalAlpha = (0.18 + 0.1 * pulse) * shieldFrac;
      ctx.strokeStyle = CONFIG.colors.cyan;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.stroke();
      // Subtle fill tint
      ctx.globalAlpha = 0.04 * shieldFrac;
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.hitFlash / 0.14;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class Enemy {
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
    this.hitFlash = 0;
    this.fireTimer = boss ? 1.2 : 2.5 + Math.random() * 2;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  update(dt) {
    const p = this.game.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const side = Math.sin(this.game.time * 2 + this.wobble) * (this.boss ? 18 : 28);
    this.x += Math.cos(a) * this.speed * dt + Math.cos(a + Math.PI / 2) * side * dt;
    this.y += Math.sin(a) * this.speed * dt + Math.sin(a + Math.PI / 2) * side * dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    this.fireTimer -= dt;
    if ((this.boss || this.type === "bomber" || this.type === "frigate" || this.type === "battlecruiser") && this.fireTimer <= 0) {
      this.fireTimer = this.boss ? 1.15 : 2.8;
      const ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.game.spawnProjectile(this.x, this.y + 12, ang, this.boss ? 230 : 190, this.boss ? 12 : 7, "enemy", "enemy");
      if (this.boss) {
        this.game.spawnProjectile(this.x, this.y + 12, ang - 0.22, 210, 9, "enemy", "enemy");
        this.game.spawnProjectile(this.x, this.y + 12, ang + 0.22, 210, 9, "enemy", "enemy");
      }
    }

    if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
      p.damage(this.damagePower);
      this.damage(this.boss ? 4 : 999);
    }

    if (this.x < -160 || this.x > CONFIG.designW + 160 || this.y > CONFIG.designH + 180) this.dead = true;
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
    this.game.explosion(this.x, this.y, this.boss ? 42 : 22);
    this.game.shake = Math.max(this.game.shake, this.boss ? 10 : 3);
  }

  draw(ctx, img) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const p = this.game.player;
    ctx.rotate(Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2);

    const image = img.get(this.imgKey);
    const rc = RENDER_CONFIG.enemies[this.type] || { w: this.r * 2, h: this.r * 2 };
    const size = this.boss ? rc.w * 1.85 : rc.w;

    // Subtle rim glow behind sprite for readability
    ctx.globalAlpha = this.boss ? 0.45 : 0.3;
    ctx.fillStyle = this.boss ? CONFIG.colors.red : CONFIG.colors.pink;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = this.boss ? 18 : 10;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
    if (image) this.game.drawAsset(ctx, image, 0, 0, size, size);
    else this.game.drawFallbackEnemy(ctx, 0, 0, this.r, this.boss);

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.hitFlash / 0.11;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss indicator ring
    if (this.boss) {
      ctx.globalCompositeOperation = "source-over";
      ctx.rotate(-(Math.atan2(p.y - this.y, p.x - this.x) + Math.PI / 2));
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = CONFIG.colors.red;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = CONFIG.colors.red;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.58 + Math.sin(this.game.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

Enemy.defs = {
  scout:        { hp: 18,  speed: 106, r: 17, damage: 10, score: 18,  img: "enemyScout" },
  fighter:      { hp: 34,  speed: 86,  r: 21, damage: 14, score: 35,  img: "enemyFighter" },
  bomber:       { hp: 76,  speed: 52,  r: 28, damage: 20, score: 80,  img: "enemyBomber" },
  frigate:      { hp: 110, speed: 45,  r: 34, damage: 24, score: 120, img: "enemyFrigate" },
  battlecruiser:{ hp: 180, speed: 34,  r: 42, damage: 30, score: 210, img: "enemyBattlecruiser" },
  dreadnought:  { hp: 260, speed: 28,  r: 52, damage: 34, score: 420, img: "enemyDreadnought" }
};

class Projectile {
  constructor(x, y, a, speed, dmg, owner, kind) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.dmg = dmg;
    this.owner = owner;
    this.kind = kind;
    this.r = kind === "rocket" ? 6 : kind === "enemy" ? 5 : 4;
    this.life = kind === "rocket" ? 1.9 : 1.25;
    this.dead = false;
  }

  update(dt, game) {
    if (this.kind === "rocket" && this.owner === "player") {
      const t = game.closestEnemy(this.x, this.y, 220);
      if (t) {
        const desired = Math.atan2(t.y - this.y, t.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let d = desired - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + clamp(d, -dt * 3.4, dt * 3.4);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0 || this.x < -70 || this.x > CONFIG.designW + 70 || this.y < -80 || this.y > CONFIG.designH + 80) {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.globalCompositeOperation = "lighter";
    if (this.owner === "player") {
      if (this.kind === "rocket") {
        // Rocket — orange elongated bolt
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(-10, -3.5, 22, 7, 4);
        ctx.fill();
        // Bright core
        ctx.fillStyle = "#fff8e0";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(-6, -1.5, 10, 3, 2);
        ctx.fill();
      } else {
        // Laser bolt — cyan, thicker and brighter
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(-9, -3.5, 18, 7, 4);
        ctx.fill();
        // Bright core stripe
        ctx.fillStyle = "#e8ffff";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.roundRect(-7, -1.5, 12, 3, 2);
        ctx.fill();
      }
    } else {
      // Enemy projectile — red/orange, clearly distinct from player
      ctx.fillStyle = CONFIG.colors.red;
      ctx.shadowColor = "#ff2040";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      // Bright center
      ctx.fillStyle = "#ffaaaa";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class XpPickup {
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

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.max = life;
    this.size = size;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 1 - 1.8 * dt;
    this.vy *= 1 - 1.8 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    const a = Math.max(0, this.life / this.max);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (0.4 + a), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class UpgradeSystem {
  constructor(game) {
    this.game = game;
    this.pool = [
      { id: "fire",   name: "Fire Rate",     desc: "Auto cannon fires faster.",          icon: "pickupAuto" },
      { id: "twin",   name: "Twin Shot",      desc: "Adds side barrels.",                 icon: "pickupAuto" },
      { id: "rocket", name: "Rocket Burst",   desc: "Chance to launch homing rockets.",   icon: "pickupRocket" },
      { id: "zapper", name: "Zapper Chain",   desc: "Occasional lightning strike.",        icon: "pickupZapper" },
      { id: "speed",  name: "Engine Boost",   desc: "Movement becomes sharper.",           icon: "pickupSuper" },
      { id: "shield", name: "Shield Regen",   desc: "Shield recovers faster.",             icon: "pickupShield" },
      { id: "magnet", name: "Pickup Magnet",  desc: "Energy pulls in from farther away.",  icon: "pickupPulse" },
      { id: "hp",     name: "Hull Upgrade",   desc: "Max HP increases.",                   icon: "pickupInvincible" }
    ];
    this.choices = [];
    this.cards = [];
  }

  roll() {
    const copy = [...this.pool].sort(() => Math.random() - 0.5);
    this.choices = copy.slice(0, 3);
    this.cards = [];
    const w = 330, h = 112;
    for (let i = 0; i < 3; i++) {
      this.cards.push({ x: (CONFIG.designW - w) / 2, y: 232 + i * 128, w, h });
    }
  }

  pick(index) {
    const u = this.choices[index];
    if (!u) return;
    const p = this.game.player;
    switch (u.id) {
      case "fire":   p.fireRate = Math.max(0.105, p.fireRate * 0.86); break;
      case "twin":   p.twin = Math.min(4, p.twin + 1); break;
      case "rocket": p.rocket = Math.min(5, p.rocket + 1); break;
      case "zapper": p.zapper = Math.min(5, p.zapper + 1); break;
      case "speed":  p.speed += 26; break;
      case "shield": p.maxShield += 12; p.shieldRegen += 1.25; p.shield = p.maxShield; break;
      case "magnet": p.magnet += 1; break;
      case "hp":     p.maxHp += 18; p.hp = Math.min(p.maxHp, p.hp + 28); break;
    }
    this.game.state = "playing";
  }

  handleTap(x, y) {
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        this.pick(i);
        return true;
      }
    }
    return false;
  }

  draw(ctx, img) {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,22,0.88)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    // Title
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 18;
    ctx.font = "800 22px system-ui";
    ctx.fillText("UPGRADE SYSTEM ONLINE", CONFIG.designW / 2, 148);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "500 13px system-ui";
    ctx.fillText("Choose one module", CONFIG.designW / 2, 172);

    for (let i = 0; i < this.choices.length; i++) {
      const u = this.choices[i], c = this.cards[i];

      // Card background
      const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
      g.addColorStop(0, "rgba(28,58,110,0.96)");
      g.addColorStop(1, "rgba(14,16,44,0.96)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 16);
      ctx.fill();

      // Border glow for first card
      const borderAlpha = i === 0 ? 0.7 : 0.2;
      ctx.strokeStyle = i === 0 ? `rgba(88,230,255,${borderAlpha})` : `rgba(180,200,255,${borderAlpha})`;
      ctx.lineWidth = i === 0 ? 2 : 1.5;
      ctx.shadowColor = i === 0 ? CONFIG.colors.cyan : "transparent";
      ctx.shadowBlur = i === 0 ? 10 : 0;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 16);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Icon area background circle
      const ix = c.x + 56, iy = c.y + c.h / 2;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.beginPath();
      ctx.arc(ix, iy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw canvas icon (strips are always broken, always use canvas icon)
      this.game.drawUpgradeIcon(ctx, u.id, ix, iy, 22);

      // Text
      ctx.textAlign = "left";
      ctx.fillStyle = CONFIG.colors.white;
      ctx.font = "800 18px system-ui";
      ctx.fillText(u.name, c.x + 98, c.y + 42);
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.font = "400 12px system-ui";
      const descWords = u.desc.split(" ");
      let line1 = "", line2 = "";
      for (const w of descWords) {
        if ((line1 + w).length < 24) line1 += (line1 ? " " : "") + w;
        else line2 += (line2 ? " " : "") + w;
      }
      ctx.fillText(line1, c.x + 98, c.y + 64);
      if (line2) ctx.fillText(line2, c.x + 98, c.y + 82);

      // Level indicator dots if player has this upgrade
      const p = this.game.player;
      let lvl = 0;
      if (u.id === "twin") lvl = p.twin;
      else if (u.id === "rocket") lvl = p.rocket;
      else if (u.id === "zapper") lvl = p.zapper;
      else if (u.id === "magnet") lvl = p.magnet;
      if (lvl > 0) {
        ctx.fillStyle = CONFIG.colors.cyan;
        for (let d = 0; d < Math.min(lvl, 5); d++) {
          ctx.beginPath();
          ctx.arc(c.x + 98 + d * 10, c.y + c.h - 16, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}

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
    this.bossTimer = 90;
    this.bossWarning = 0;
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
    this.bossTimer = 90;
    this.bossWarning = 0;
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
    }

    for (const p of this.particles) p.update(dt);
    for (const z of this.zaps) z.life -= dt;
    this.particles = this.particles.filter(p => !p.dead).slice(-CONFIG.particleCap);
    this.zaps = this.zaps.filter(z => z.life > 0);

    this.shake = Math.max(0, this.shake - dt * 20);
    this.bossWarning = Math.max(0, this.bossWarning - dt);
  }

  handleTap(x, y) {
    if (this.state === "title") {
      if (y > 500 && y < 610) this.startRun();
    } else if (this.state === "gameOver") {
      if (y > 510 && y < 610) this.startRun();
    } else if (this.state === "levelUp") {
      this.upgrades.handleTap(x, y);
    } else if (this.state === "paused") {
      this.state = "playing";
    }
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    const difficulty = 1 + this.runTime / 90;
    const interval = clamp(1.05 - this.runTime * 0.006, 0.24, 1.05);
    if (this.spawnTimer <= 0 && this.enemies.length < CONFIG.enemyCap) {
      this.spawnTimer = interval;
      const roll = Math.random();
      let type = "scout";
      if (this.runTime > 25 && roll > 0.62) type = "fighter";
      if (this.runTime > 55 && roll > 0.80) type = "bomber";
      if (this.runTime > 95 && roll > 0.88) type = "frigate";
      if (this.runTime > 145 && roll > 0.94) type = "battlecruiser";
      this.spawnEnemy(type, false);
      if (difficulty > 2 && Math.random() < 0.18) this.spawnEnemy("scout", false);
    }

    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      this.bossTimer = 90;
      this.bossWarning = 3.1;
      this.spawnEnemy("dreadnought", true);
    }
  }

  spawnEnemy(type, boss) {
    const side = Math.floor(Math.random() * 4);
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
          if (dist2(pr.x, pr.y, e.x, e.y) < (pr.r + e.r) ** 2) {
            e.damage(pr.dmg);
            pr.dead = true;
            if (pr.kind === "rocket") this.explosion(pr.x, pr.y, 16);
            break;
          }
        }
      } else {
        const p = this.player;
        if (dist2(pr.x, pr.y, p.x, p.y) < (pr.r + p.r) ** 2) {
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

  spawnProjectile(x, y, a, speed, dmg, owner, kind) {
    if (this.projectiles.length >= CONFIG.projectileCap) return;
    this.projectiles.push(new Projectile(x, y, a, speed, dmg, owner, kind));
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
      const d = dist2(x, y, e.x, e.y);
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
    if (this.state === "paused") this.drawPaused(ctx);
    if (this.state === "playing") this.drawHud(ctx);

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
    for (const pr of this.projectiles) pr.draw(ctx);
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
      ctx.font = "900 26px system-ui";
      ctx.fillText("DREADNOUGHT SIGNATURE DETECTED", CONFIG.designW / 2, 108);
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

    // Boss warning HUD badge
    if (this.bossWarning > 0) {
      const a = Math.min(1, this.bossWarning) * Math.abs(Math.sin(this.time * 8));
      ctx.globalAlpha = a;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("⚠ DREADNOUGHT", CONFIG.designW / 2, 92);
      ctx.globalAlpha = 1;
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

  // Returns { sx, sy, sw, sh } — the source rect to use for a given image.
  // If the image is a horizontal or vertical strip, returns only the first frame.
  getFrameSource(img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return { sx: 0, sy: 0, sw: iw, sh: ih };
    const ratio = iw / ih;
    if (ratio >= STRIP_RATIO) {
      // Horizontal strip — use first square frame
      const frameSize = ih;
      return { sx: 0, sy: 0, sw: frameSize, sh: ih };
    }
    const vratio = ih / iw;
    if (vratio >= STRIP_RATIO) {
      // Vertical strip — use first square frame
      return { sx: 0, sy: 0, sw: iw, sh: iw };
    }
    return { sx: 0, sy: 0, sw: iw, sh: ih };
  }

  // Draws an image centered at (x,y) fitting into (targetW x targetH), preserving aspect ratio.
  // Strips are automatically cropped to the first frame.
  drawAsset(ctx, img, x, y, targetW, targetH) {
    const { sx, sy, sw, sh } = this.getFrameSource(img);
    if (!sw || !sh) return;
    const scale = Math.min(targetW / sw, targetH / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(img, sx, sy, sw, sh, x - dw / 2, y - dh / 2, dw, dh);
  }

  // Legacy alias kept for safety — now uses smart drawAsset
  drawImageCentered(ctx, img, x, y, w, h) {
    this.drawAsset(ctx, img, x, y, w, h);
  }

  // Draws a small weapon icon on the player ship (canvas, never an asset strip)
  drawWeaponIcon(ctx, type, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "lighter";
    if (type === "rocket") {
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.shadowColor = CONFIG.colors.orange;
      ctx.shadowBlur = 8;
      // Two small rockets
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
      // Auto cannon — two small barrels
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

  // Draws a canvas upgrade icon for the level-up cards
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
        // Inner blue core
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
        // Inner glow dot
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
        // Poles
        ctx.beginPath();
        ctx.moveTo(-r * 0.58, -r * 0.05);
        ctx.lineTo(-r * 0.58, r * 0.62);
        ctx.moveTo(r * 0.58, -r * 0.05);
        ctx.lineTo(r * 0.58, r * 0.62);
        ctx.stroke();
        // Pole tips
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
