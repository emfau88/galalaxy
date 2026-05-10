import { CONFIG } from "../config.js";

// Family color accents for card tinting
const FAMILY_ACCENT = {
  zapper:  { border: "rgba(220,120,255,{a})", shadow: "#dd77ff", bg0: "rgba(40,18,80,0.96)",  bg1: "rgba(14,8,44,0.96)"  },
  rocket:  { border: "rgba(255,160,60,{a})",  shadow: "#ffaa3a", bg0: "rgba(80,32,12,0.96)",  bg1: "rgba(28,12,4,0.96)"  },
  pulse:   { border: "rgba(60,220,200,{a})",  shadow: "#3addc8", bg0: "rgba(10,50,55,0.96)",  bg1: "rgba(4,18,22,0.96)"  },
  core:    { border: "rgba(88,230,255,{a})",  shadow: "#58e6ff", bg0: "rgba(28,58,110,0.96)", bg1: "rgba(14,16,44,0.96)" },
};

// pool entry shape:
//   id, name, desc, icon
//   family: "zapper"|"rocket"|"pulse"|"core"
//   maxLevel: null = unlimited stacks (fire/speed/shield/hp/magnet), number = hard cap
//   minLevel: minimum upgrade-pick count before this can appear (0 = always)
//   weight: base draw weight (higher = more common baseline)
const POOL = [
  // --- Core / Utility ---
  { id: "fire",    name: "Fire Rate",      desc: "Auto cannon fires faster.",           icon: "pickupAuto",        family: "core",   maxLevel: null, minLevel: 0, weight: 10 },
  { id: "twin",    name: "Twin Shot",      desc: "Adds side barrels.",                  icon: "pickupAuto",        family: "core",   maxLevel: 4,    minLevel: 0, weight: 8  },
  { id: "speed",   name: "Engine Boost",   desc: "Movement becomes sharper.",            icon: "pickupSuper",       family: "core",   maxLevel: null, minLevel: 0, weight: 7  },
  { id: "shield",  name: "Shield Regen",   desc: "Shield recovers faster.",              icon: "pickupShield",      family: "core",   maxLevel: null, minLevel: 0, weight: 7  },
  { id: "hp",      name: "Hull Upgrade",   desc: "Max HP increases.",                    icon: "pickupInvincible",  family: "core",   maxLevel: null, minLevel: 0, weight: 7  },
  { id: "magnet",  name: "Pickup Magnet",  desc: "Energy pulls in from farther away.",   icon: "pickupPulse",       family: "core",   maxLevel: null, minLevel: 0, weight: 5  },

  // --- Zapper Family ---
  { id: "zapper",  name: "Zapper Chain",   desc: "Occasional lightning strike.",         icon: "pickupZapper",      family: "zapper", maxLevel: 5,    minLevel: 0, weight: 8  },
  { id: "beam",    name: "Beam Cannon",    desc: "Fires a devastating energy beam.",     icon: "pickupZapper",      family: "zapper", maxLevel: 3,    minLevel: 2, weight: 4  },

  // --- Rocket Family ---
  { id: "rocket",  name: "Rocket Burst",   desc: "Chance to launch homing rockets.",     icon: "pickupRocket",      family: "rocket", maxLevel: 5,    minLevel: 0, weight: 8  },
  { id: "barrage", name: "Rocket Barrage", desc: "Rockets launch in rapid 3-shot bursts.", icon: "pickupRocket",   family: "rocket", maxLevel: 3,    minLevel: 2, weight: 4  },

  // --- Pulse Family ---
  { id: "pulse",   name: "Pulse Wave",     desc: "Shockwave damages and pushes enemies.", icon: "pickupShield",     family: "pulse",  maxLevel: 3,    minLevel: 2, weight: 4  },

  // --- Keystone Upgrades (one per run, minLevel 5, weight low — weighted sampling still biases toward build family) ---
  { id: "overcharged", name: "Overcharged Core",   desc: "Zapper always fires. Rockets disabled.",     icon: "pickupZapper",  family: "zapper", maxLevel: 1, minLevel: 5, weight: 3, keystone: true },
  { id: "siege",       name: "Siege Payload",       desc: "Rockets deal 2.5× damage. Fire rate −35%.", icon: "pickupRocket",  family: "rocket", maxLevel: 1, minLevel: 5, weight: 3, keystone: true },
  { id: "reactor",     name: "Pulse Reactor",       desc: "Pulse fires automatically. Speed −80.",     icon: "pickupShield",  family: "pulse",  maxLevel: 1, minLevel: 5, weight: 3, keystone: true },
];

export class UpgradeSystem {
  constructor(game) {
    this.game = game;
    this.pool = POOL;
    this.choices = [];
    this.cards = [];
    this._pickCount = 0; // total upgrades picked this run
  }

  _playerLevel(u) {
    const p = this.game.player;
    switch (u.id) {
      case "twin":    return p.twin;
      case "rocket":  return p.rocket;
      case "zapper":  return p.zapper;
      case "magnet":  return p.magnet;
      case "beam":    return p.beam;
      case "pulse":   return p.pulse;
      case "barrage": return p.barrage;
      default:        return 0; // unlimited-stack upgrades always available
    }
  }

  _buildAffinity() {
    const p = this.game.player;
    return {
      zapper: p.zapper + p.beam * 2,
      rocket: p.rocket + p.barrage * 2,
      pulse:  p.pulse * 2,
      core:   0,
    };
  }

  roll() {
    const p = this.game.player;
    const affinity = this._buildAffinity();

    // Dominant family gets a 2.2× weight bonus, adjacent gets 1.4×
    const maxAff = Math.max(affinity.zapper, affinity.rocket, affinity.pulse);
    const dominant = maxAff >= 2
      ? (affinity.zapper >= maxAff ? "zapper" : affinity.rocket >= maxAff ? "rocket" : "pulse")
      : null;

    const candidates = this.pool.filter(u => {
      if (u.minLevel > this._pickCount) return false;
      if (u.maxLevel !== null && this._playerLevel(u) >= u.maxLevel) return false;
      if (u.id === "barrage" && p.rocket === 0 && p.barrage === 0) return false;
      // Only one keystone per run
      if (u.keystone && p.keystoneId !== null) return false;
      // Keystone only appears if player has invested in that family
      if (u.keystone) {
        if (u.id === "overcharged" && (p.zapper < 2 && p.beam === 0)) return false;
        if (u.id === "siege"       && (p.rocket < 2 && p.barrage === 0)) return false;
        if (u.id === "reactor"     && p.pulse === 0) return false;
      }
      return true;
    });

    // Compute weighted pool
    const weighted = [];
    for (const u of candidates) {
      let w = u.weight;
      if (dominant && u.family === dominant) w *= 2.2;
      else if (dominant && u.family !== "core") w *= 0.7; // suppress rival families slightly
      weighted.push({ u, w });
    }

    // Weighted sample without replacement
    const picked = [];
    const pool = [...weighted];
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      const total = pool.reduce((s, e) => s + e.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= pool[idx].w;
        if (r <= 0) break;
      }
      picked.push(pool[idx].u);
      pool.splice(idx, 1);
    }

    this.choices = picked;
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
      case "fire":    p.fireRate = Math.max(0.105, p.fireRate * 0.86); break;
      case "twin":    p.twin = Math.min(4, p.twin + 1); break;
      case "rocket":  p.rocket = Math.min(5, p.rocket + 1);
                      // Prime auto-fire so the first rocket fires in the next shot cycle.
                      p.fireTimer = Math.min(p.fireTimer, 0.05);
                      break;
      case "zapper":  p.zapper = Math.min(5, p.zapper + 1);
                      // Prime the auto-fire timer so the first zap fires within one shot cycle.
                      p.fireTimer = Math.min(p.fireTimer, 0.05);
                      break;
      case "speed":   p.speed += 26; break;
      case "shield":  p.maxShield += 12; p.shieldRegen += 1.25; p.shield = p.maxShield; break;
      case "magnet":  p.magnet += 1; break;
      case "hp":      p.maxHp += 18; p.hp = Math.min(p.maxHp, p.hp + 28); break;
      case "beam":    p.beam = Math.min(3, p.beam + 1);
                      // First pickup: fire within 0.5s. Re-pick: don't reset a nearly-ready beam.
                      if (p._beamCooldown === undefined) p._beamCooldown = 0.5;
                      else p._beamCooldown = Math.min(p._beamCooldown, 0.5);
                      break;
      case "pulse":   p.pulse = Math.min(3, p.pulse + 1);
                      // First pickup: fire within 0.5s. Re-pick: don't reset a nearly-ready pulse.
                      if (p._pulseCooldown === undefined) p._pulseCooldown = 0.5;
                      else p._pulseCooldown = Math.min(p._pulseCooldown, 0.5);
                      break;
      case "barrage": p.barrage = Math.min(3, p.barrage + 1);
                      if (p.rocket === 0) p.rocket = 1;
                      // Prime auto-fire so the first barrage fires immediately.
                      p.fireTimer = Math.min(p.fireTimer, 0.05);
                      break;
      case "overcharged":
        p.keystoneId     = "overcharged";
        p.rocketDisabled = true;
        if (p.zapper === 0) p.zapper = 1;
        break;
      case "siege":
        p.keystoneId  = "siege";
        p.siegePayload = true;
        p.fireRate    = Math.min(p.fireRate * 1.35, 0.9);
        if (p.rocket === 0) p.rocket = 1;
        break;
      case "reactor":
        p.keystoneId   = "reactor";
        p.pulseReactor = true;
        p.speed        = Math.max(180, p.speed - 80);
        if (p.pulse === 0) { p.pulse = 1; p._pulseCooldown = 2.0; }
        else p._pulseCooldown = 2.0;
        break;
    }
    this._pickCount++;
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
      const accent = FAMILY_ACCENT[u.family] || FAMILY_ACCENT.core;

      // Card background — family tinted
      const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
      g.addColorStop(0, accent.bg0);
      g.addColorStop(1, accent.bg1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 16);
      ctx.fill();

      // Border glow — keystones get gold, others family colored
      if (u.keystone) {
        ctx.strokeStyle = `rgba(255,210,80,0.9)`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#ffcc44";
        ctx.shadowBlur = 16;
      } else {
        const borderAlpha = i === 0 ? 0.85 : 0.3;
        ctx.strokeStyle = accent.border.replace("{a}", borderAlpha);
        ctx.lineWidth = i === 0 ? 2.2 : 1.5;
        ctx.shadowColor = i === 0 ? accent.shadow : "transparent";
        ctx.shadowBlur = i === 0 ? 12 : 0;
      }
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 16);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Icon area background circle — family tinted
      const ix = c.x + 56, iy = c.y + c.h / 2;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = accent.shadow;
      ctx.beginPath();
      ctx.arc(ix, iy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Canvas icon
      this.game.drawUpgradeIcon(ctx, u.id, ix, iy, 22);

      // Tag — KEYSTONE in gold, or family label
      ctx.textAlign = "right";
      ctx.font = "700 10px system-ui";
      if (u.keystone) {
        ctx.fillStyle = "#ffcc44";
        ctx.globalAlpha = 0.95;
        ctx.fillText("✦ KEYSTONE", c.x + c.w - 14, c.y + 18);
      } else if (u.family !== "core") {
        ctx.fillStyle = accent.shadow;
        ctx.globalAlpha = 0.7;
        ctx.fillText(u.family.toUpperCase(), c.x + c.w - 14, c.y + 18);
      }
      ctx.globalAlpha = 1;

      // Upgrade name + description
      ctx.textAlign = "left";
      ctx.fillStyle = CONFIG.colors.white;
      ctx.font = "800 18px system-ui";
      ctx.fillText(u.name, c.x + 98, c.y + 42);
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.font = "400 12px system-ui";
      const descWords = u.desc.split(" ");
      let line1 = "", line2 = "";
      for (const wd of descWords) {
        if ((line1 + wd).length < 24) line1 += (line1 ? " " : "") + wd;
        else line2 += (line2 ? " " : "") + wd;
      }
      ctx.fillText(line1, c.x + 98, c.y + 64);
      if (line2) ctx.fillText(line2, c.x + 98, c.y + 82);

      // Level dots
      const lvl = this._playerLevel(u);
      if (lvl > 0) {
        ctx.fillStyle = accent.shadow;
        ctx.globalAlpha = 0.9;
        for (let d = 0; d < Math.min(lvl, 5); d++) {
          ctx.beginPath();
          ctx.arc(c.x + 98 + d * 10, c.y + c.h - 16, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }
}
