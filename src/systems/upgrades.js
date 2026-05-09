import { CONFIG } from "../config.js";

export class UpgradeSystem {
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
      { id: "hp",      name: "Hull Upgrade",    desc: "Max HP increases.",                        icon: "pickupInvincible" },
      { id: "beam",    name: "Beam Cannon",    desc: "Fires a devastating energy beam every 7s.", icon: "pickupZapper" },
      { id: "pulse",   name: "Pulse Wave",     desc: "Shockwave damages and pushes enemies away.", icon: "pickupShield" },
      { id: "barrage", name: "Rocket Barrage", desc: "Rockets launch in rapid 3-shot bursts.",    icon: "pickupRocket" }
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
      case "magnet":  p.magnet += 1; break;
      case "hp":      p.maxHp += 18; p.hp = Math.min(p.maxHp, p.hp + 28); break;
      case "beam":    p.beam   = Math.min(3, p.beam + 1);
                      if (p._beamCooldown === undefined) p._beamCooldown = 4.0;
                      break;
      case "pulse":   p.pulse  = Math.min(3, p.pulse + 1);
                      if (p._pulseCooldown === undefined) p._pulseCooldown = 5.0;
                      break;
      case "barrage": p.barrage = Math.min(3, p.barrage + 1);
                      if (p.rocket === 0) p.rocket = 1; // barrage needs at least rocket 1
                      break;
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
      if (u.id === "twin")    lvl = p.twin;
      else if (u.id === "rocket")  lvl = p.rocket;
      else if (u.id === "zapper")  lvl = p.zapper;
      else if (u.id === "magnet")  lvl = p.magnet;
      else if (u.id === "beam")    lvl = p.beam;
      else if (u.id === "pulse")   lvl = p.pulse;
      else if (u.id === "barrage") lvl = p.barrage;
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
