import { CONFIG, RENDER_CONFIG, STRIP_RATIO, SECTORS } from "../config.js";
import { clamp } from "../utils.js";
import { drawPulse } from "../systems/abilities.js";

class WorldRenderingMethods {
  drawMuteButton(ctx) {
    const mz = this._muteBtnZone;
    const x = mz.x + mz.w / 2, y = mz.y + mz.h / 2, r = 14;
    ctx.save();
    // Background circle
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(2,6,20,0.82)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Border
    ctx.strokeStyle = this.musicMuted ? "rgba(255,255,255,0.2)" : CONFIG.colors.cyan;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = this.musicMuted ? 0.3 : 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Icon — speaker shape
    ctx.globalAlpha = this.musicMuted ? 0.35 : 0.9;
    ctx.fillStyle = this.musicMuted ? "rgba(255,255,255,0.6)" : CONFIG.colors.cyan;
    ctx.font = "500 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.musicMuted ? "🔇" : "🔊", x, y);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawFullscreenButton(ctx) {
    if (!this.fullscreenAvailable) return;
    const fz = this._fullscreenBtnZone;
    const x = fz.x + fz.w / 2, y = fz.y + fz.h / 2, r = 10;
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "rgba(2,6,20,0.82)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.fullscreenActive ? CONFIG.colors.pink : CONFIG.colors.cyan;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = this.fullscreenActive ? CONFIG.colors.pink : CONFIG.colors.cyan;
    ctx.lineWidth = 1.35;
    const d = 4.5, s = 2.5;
    ctx.beginPath();
    if (this.fullscreenActive) {
      ctx.moveTo(x - d, y - s); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s, y - d);
      ctx.moveTo(x + d, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - d);
      ctx.moveTo(x - d, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + d);
      ctx.moveTo(x + d, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + d);
    } else {
      ctx.moveTo(x - s, y - d); ctx.lineTo(x - d, y - d); ctx.lineTo(x - d, y - s);
      ctx.moveTo(x + s, y - d); ctx.lineTo(x + d, y - d); ctx.lineTo(x + d, y - s);
      ctx.moveTo(x - s, y + d); ctx.lineTo(x - d, y + d); ctx.lineTo(x - d, y + s);
      ctx.moveTo(x + s, y + d); ctx.lineTo(x + d, y + d); ctx.lineTo(x + d, y + s);
    }
    ctx.stroke();
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

    // Sector tint overlay — stronger in later sectors
    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;
    const tintStrength = 0.09 + this.currentSectorIndex * 0.018;
    ctx.fillStyle = `rgba(${tr},${tg},${tb},${tintStrength})`;
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
    this.drawEnemyDestructions(ctx);
    this.player.draw(ctx, this.loader);
    drawPulse(ctx, this.player);

    for (const z of this.zaps) {
      const a = z.life / z.max;
      const sec = z.secondary;
      const power = z.power || 1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Jitter midpoint — two segments give lightning feel
      const mx = (z.x1 + z.x2) / 2 + (Math.random() - 0.5) * (sec ? 10 : 20);
      const my = (z.y1 + z.y2) / 2 + (Math.random() - 0.5) * (sec ? 10 : 20);
      // Outer glow
      ctx.globalAlpha = a * (sec ? 0.3 : 0.55) * Math.min(1.2, 0.76 + power * 0.24);
      ctx.strokeStyle = CONFIG.colors.pink;
      ctx.lineWidth = (sec ? 3 : 6) * power;
      ctx.shadowColor = CONFIG.colors.pink;
      ctx.shadowBlur = this.lowEffects ? 0 : (sec ? 12 : 26) * Math.min(1.35, power);
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      // Bright core
      ctx.globalAlpha = a * (sec ? 0.6 : 1.0);
      ctx.strokeStyle = sec ? "#ddaaff" : "#ffccff";
      ctx.lineWidth = (sec ? 1.2 : 2.2) * (0.8 + power * 0.2);
      ctx.shadowBlur = this.lowEffects ? 0 : (sec ? 5 : 10) * Math.min(1.25, power);
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) p.draw(ctx, this);

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

  drawEnemyDestructions(ctx) {
    for (const death of this.enemyDeaths) {
      const animation = death.visual.destruction;
      const image = this.loader.get(animation.assetKey);
      if (!image) continue;
      const frame = Math.min(animation.frameCount - 1, Math.floor(death.age * animation.fps));
      ctx.save();
      ctx.translate(death.x, death.y);
      ctx.rotate(death.angle);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = Math.min(1, (death.duration - death.age) * 5);
      ctx.drawImage(
        image,
        frame * (animation.frameSize || death.visual.frame), 0, animation.frameSize || death.visual.frame, animation.frameSize || death.visual.frame,
        -death.size / 2, -death.size / 2, death.size, death.size,
      );
      ctx.restore();
    }
  }

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
      case "beam": {
        // Vertical beam column with bright core
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.roundRect(-r * 0.45, -r, r * 0.9, r * 2, r * 0.45);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-r * 0.15, -r, r * 0.3, r * 2, r * 0.15);
        ctx.fill();
        break;
      }
      case "pulse": {
        // Expanding ring icon
        ctx.strokeStyle = CONFIG.colors.cyan;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = CONFIG.colors.cyan;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = CONFIG.colors.cyan;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "barrage": {
        // 3 rocket shapes in a spread
        ctx.fillStyle = CONFIG.colors.orange;
        ctx.shadowColor = CONFIG.colors.orange;
        ctx.shadowBlur = 12;
        for (const [ox, oa] of [[-r * 0.42, -0.28], [0, 0], [r * 0.42, 0.28]]) {
          ctx.save();
          ctx.translate(ox, 0);
          ctx.rotate(oa);
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.85);
          ctx.lineTo(r * 0.22, r * 0.4);
          ctx.lineTo(0, r * 0.15);
          ctx.lineTo(-r * 0.22, r * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "overcharged": {
        // Lightning bolt in gold/purple
        ctx.strokeStyle = "#cc66ff";
        ctx.shadowColor = "#cc66ff";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r);
        ctx.lineTo(-r * 0.2, -r * 0.1);
        ctx.lineTo(r * 0.25, -r * 0.1);
        ctx.lineTo(-r * 0.2, r);
        ctx.stroke();
        break;
      }
      case "siege": {
        // Large rocket with orange aura
        ctx.fillStyle = "#ff8800";
        ctx.shadowColor = "#ff8800";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.32, r * 0.5);
        ctx.lineTo(0, r * 0.2);
        ctx.lineTo(-r * 0.32, r * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "reactor": {
        // Concentric rings in teal
        ctx.strokeStyle = "#00ffcc";
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
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

export const worldRenderingMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(WorldRenderingMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
