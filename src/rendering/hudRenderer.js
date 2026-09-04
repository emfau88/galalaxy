import { CONFIG, SECTORS } from "../config.js";
import { clamp, fmtTime } from "../utils.js";

class HudRenderingMethods {
  drawHud(ctx) {
    ctx.save();
    // Portrait displays can have a genuine letterbox area above the 420×760
    // playfield. Use it only when the entire compact HUD fits there; shorter
    // displays and desktop retain the in-world placement.
    const headerOffsetY = this.hudHeaderOffsetY();
    ctx.save();
    if (headerOffsetY) ctx.translate(0, headerOffsetY);
    const W = CONFIG.designW;
    const p = this.player;
    const sector = SECTORS[this.currentSectorIndex];
    const [tr, tg, tb] = sector.tint;
    const sectorAccent = `rgb(${Math.min(255, tr + 140)},${Math.min(255, tg + 140)},${Math.min(255, tb + 170)})`;

    // A single compact rail preserves the playfield; information is grouped
    // by alignment instead of adding heavy nested panels.
    const panel = ctx.createLinearGradient(0, 8, 0, 82);
    panel.addColorStop(0, "rgba(6,16,42,0.88)");
    panel.addColorStop(1, "rgba(2,7,22,0.82)");
    ctx.fillStyle = panel;
    ctx.strokeStyle = "rgba(112,212,255,0.24)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, 8, W - 20, 74, 11);
    ctx.fill();
    ctx.stroke();

    // ── LEFT: Hull / shield ──────────────────────────────────────────
    const iconX = 23;
    const barX = 36;
    const hpW = 94, hpH = 8, hpY = 22;
    this.bar(ctx, barX, hpY, hpW, hpH, p.hp / p.maxHp, CONFIG.colors.red, "");
    this._drawHeartIcon(ctx, iconX, hpY + hpH / 2, 7, "rgba(255,80,105,0.94)");
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,220,225,0.86)";
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, barX + hpW, 19);

    const shW = 94, shH = 6, shY = 42;
    ctx.globalAlpha = 0.9;
    this.bar(ctx, barX, shY, shW, shH, p.shield / p.maxShield, CONFIG.colors.cyan, "");
    ctx.globalAlpha = 1;

    const shieldIcon = this.loader.get("pickupShield");
    if (shieldIcon) this.drawAsset(ctx, shieldIcon, iconX, shY + shH / 2, 15, 15);
    else this._drawShieldIcon(ctx, iconX, shY + shH / 2, 7, "rgba(88,230,255,0.85)");
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(195,245,255,0.86)";
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.fillText(`${Math.ceil(p.shield)} / ${p.maxShield}`, barX + shW, 39);

    if (p.emergencyAegis) {
      const aegisX = 143, aegisY = 45;
      const ready = p.aegisCooldown <= 0;
      const aegisIcon = this.loader.get("pickupInvincible");
      ctx.save();
      if (aegisIcon) this.drawAsset(ctx, aegisIcon, aegisX, aegisY, 15, 15);
      ctx.strokeStyle = ready ? "#cf8cff" : "rgba(190,120,255,0.48)";
      ctx.shadowColor = "#b95cff";
      ctx.shadowBlur = ready && !this.lowEffects ? 7 : 0;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const remaining = ready ? 1 : 1 - p.aegisCooldown / 18;
      ctx.arc(aegisX, aegisY, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(180,210,240,0.48)";
    ctx.font = "700 8px ui-monospace, monospace";
    ctx.fillText(fmtTime(this.runTime), 18, 68);

    // ── CENTER: Sector / level / energy ──────────────────────────────
    const cx = W / 2;

    ctx.textAlign = "center";
    ctx.fillStyle = sectorAccent;
    ctx.font = "900 11px ui-monospace, monospace";
    ctx.fillText(`${sector.shortName}  ·  LV ${this.level}`, cx, 26);

    const dotY = 38, dotR = 2.2, dotGap = 10;
    const dotStartX = cx - (SECTORS.length - 1) * dotGap / 2;
    for (let s = 0; s < SECTORS.length; s++) {
      const dx = dotStartX + s * dotGap;
      const done = s < this.currentSectorIndex;
      const current = s === this.currentSectorIndex;
      ctx.beginPath();
      ctx.arc(dx, dotY, current ? dotR : dotR * 0.7, 0, Math.PI * 2);
      if (done) {
        ctx.fillStyle = sectorAccent;
        ctx.globalAlpha = 0.7;
      } else if (current) {
        ctx.fillStyle = sectorAccent;
        ctx.globalAlpha = 1;
        ctx.shadowColor = sectorAccent;
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.globalAlpha = 1;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (this.bossActive) {
      const pulse = 0.8 + 0.2 * Math.abs(Math.sin(this.time * 4));
      ctx.globalAlpha = pulse;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "800 8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("▸  BOSS  ◂", cx, 39);
      ctx.globalAlpha = 1;
    }

    const xpFrac = clamp(this.xp / this.xpNeed, 0, 1);
    const xpX = 165, xpY = 53, xpW = 90, xpH = 6;
    this.bar(ctx, xpX, xpY, xpW, xpH, xpFrac, xpFrac >= 0.85 ? "#aaffcc" : CONFIG.colors.green, "");
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(190,255,215,0.82)";
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.fillText(`${this.xp} / ${this.xpNeed}`, xpX + xpW, 68);

    // Boss warning — below panel
    if (this.bossWarning > 0) {
      const a = clamp(this.bossWarning * 0.7, 0, 1) * Math.abs(Math.sin(this.time * 6));
      ctx.globalAlpha = a;
      ctx.fillStyle = CONFIG.colors.red;
      ctx.font = "600 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("⚠  BOSS INCOMING", W / 2, 94);
      ctx.globalAlpha = 1;
    }

    // ── RIGHT: Score ─────────────────────────────────────────────────
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(185,240,255,0.66)";
    ctx.font = "800 8px ui-monospace, monospace";
    ctx.fillText("SCORE", W - 18, 20);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 17px ui-monospace, monospace";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = this.lowEffects ? 0 : 7;
    ctx.fillText(Math.floor(this.score).toString(), W - 18, 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(180,210,240,0.5)";
    ctx.font = "700 8px ui-monospace, monospace";
    ctx.fillText(`BEST  ${Math.floor(this.best)}`, W - 18, 57);

    // Keep boss telemetry and contextual abilities anchored to the playfield;
    // only the compact header moves into a sufficiently large letterbox.
    ctx.restore();

    // ── Boss HP bar ──────────────────────────────────────────────────
    if (this.bossActive && this.bossWarning <= 0) {
      const boss = this.enemies.find(e => e.boss && !e.dead);
      if (boss) {
        const bx = 18, by = 90, bw = W - 36, bh = 7;

        // Three-slice treatment: preserve the detailed alert end-caps while
        // stretching only the central rail to the current viewport width.
        const bossFrame = this.loader.get("uiBossAlertFrame");
        if (bossFrame) {
          const sx = 24, sy = 170, sw = 2123, sh = 369;
          const capSrc = 250, capDst = 30;
          const fx = bx - 7, fy = by - 17, fw = bw + 14, fh = 42;
          const middleSrc = sw - capSrc * 2;
          const middleDst = Math.max(1, fw - capDst * 2);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.76;
          ctx.drawImage(bossFrame, sx, sy, capSrc, sh, fx, fy, capDst, fh);
          ctx.drawImage(bossFrame, sx + capSrc, sy, middleSrc, sh, fx + capDst, fy, middleDst, fh);
          ctx.drawImage(bossFrame, sx + sw - capSrc, sy, capSrc, sh, fx + fw - capDst, fy, capDst, fh);
          ctx.restore();
        }
        ctx.fillStyle = "rgba(2,6,20,0.82)";
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 11, bw + 8, bh + 17, 7);
        ctx.fill();

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,100,120,0.65)";
        ctx.font = "600 7px system-ui";
        ctx.fillText(sector.name.toUpperCase() + " COMMANDER", bx, by - 2);

        const hpFrac = boss.hp / boss.maxHp;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,180,180,0.45)";
        ctx.font = "500 7px system-ui";
        ctx.fillText(`${Math.ceil(boss.hp)} / ${boss.maxHp}`, bx + bw, by - 2);

        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, bh / 2);
        ctx.fill();

        const bColor = hpFrac > 0.5 ? CONFIG.colors.red : hpFrac > 0.25 ? CONFIG.colors.orange : "#ff2020";
        ctx.fillStyle = bColor;
        ctx.shadowColor = bColor;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.roundRect(bx, by, Math.max(bh, bw * hpFrac), bh, bh / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // ── Ability pips ─────────────────────────────────────────────────
    this.drawAbilityPips(ctx);

    ctx.restore();
  }

  // Heart icon — two circular arcs meeting at a bottom point
  _drawHeartIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    // Offset center slightly upward so visual center feels correct
    const y = cy - r * 0.08;
    // Left bump center and right bump center
    const bumpR  = r * 0.56;
    const lx = cx - bumpR * 0.92;
    const rx = cx + bumpR * 0.92;
    const by = y - r * 0.18; // bump centers sit above mid
    ctx.beginPath();
    // Start at the bottom tip
    ctx.moveTo(cx, y + r);
    // Left side: curve up to left bump, around it, back to center top
    ctx.bezierCurveTo(cx - r * 0.18, y + r * 0.5,  cx - r, y + r * 0.1,  lx, by + bumpR);
    ctx.arc(lx, by, bumpR, Math.PI * 0.5, Math.PI * 1.85, false);
    // Cross to right bump
    ctx.arc(rx, by, bumpR, Math.PI * 1.15, Math.PI * 0.5, false);
    // Right side: curve back down to bottom tip
    ctx.bezierCurveTo(cx + r, y + r * 0.1,  cx + r * 0.18, y + r * 0.5,  cx, y + r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Shield icon — classic heater-shield silhouette (wide top, tapered to bottom point)
  _drawShieldIcon(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    const top  = cy - r;
    const mid  = cy + r * 0.15;  // where sides start curving inward
    const tip  = cy + r;         // bottom point
    const hw   = r * 0.92;       // half-width at top
    ctx.beginPath();
    // Top-left corner (rounded)
    ctx.moveTo(cx - hw + r * 0.22, top);
    // Flat top edge
    ctx.lineTo(cx + hw - r * 0.22, top);
    // Top-right arc
    ctx.quadraticCurveTo(cx + hw, top, cx + hw, top + r * 0.28);
    // Right side straight down then curve inward to tip
    ctx.lineTo(cx + hw, mid);
    ctx.quadraticCurveTo(cx + hw, tip - r * 0.15, cx, tip);
    // Left side mirror
    ctx.quadraticCurveTo(cx - hw, tip - r * 0.15, cx - hw, mid);
    ctx.lineTo(cx - hw, top + r * 0.28);
    // Top-left arc
    ctx.quadraticCurveTo(cx - hw, top, cx - hw + r * 0.22, top);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawAbilityPips(ctx) {
    const p = this.player;
    const abilities = [];
    if (p.beam)  abilities.push({ label: "BIG GUN", icon: "pickupBigGun", cd: p._beamCooldown ?? 0, max: 7.0, color: "#7cff91" });
    if (p.pulse) abilities.push({ label: "PULSE", icon: "pickupShield", cd: p._pulseCooldown ?? 0, max: 9.0, color: CONFIG.colors.cyan });
    if (!abilities.length) return;

    // Contextual cooldowns live at the lower edge, out of the status rail.
    const pipW = 80, pipH = 7, gap = 10;
    const totalH = abilities.length * pipH + (abilities.length - 1) * gap;
    const startY = CONFIG.designH - 42 - totalH;
    const x = CONFIG.designW - 18 - pipW;

    for (let i = 0; i < abilities.length; i++) {
      const ab = abilities[i];
      const y = startY + i * (pipH + gap);
      const ready = ab.cd <= 0;
      const fill = ready ? 1 : Math.max(0, 1 - ab.cd / ab.max);

      // Track
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.roundRect(x, y, pipW, pipH, pipH / 2);
      ctx.fill();

      // Fill
      if (fill > 0) {
        ctx.fillStyle = ready ? ab.color : "rgba(88,180,180,0.4)";
        ctx.shadowColor = ready ? ab.color : "transparent";
        ctx.shadowBlur  = ready ? 8 : 0;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(pipH, pipW * fill), pipH, pipH / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // An authored icon reads faster than text on a narrow mobile HUD.
      const icon = this.loader.get(ab.icon);
      if (icon) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = ready ? 1 : 0.5;
        this.drawAsset(ctx, icon, x - 13, y + pipH / 2, 16, 16);
        ctx.restore();
      }

      // Label stays adjacent to its contextual cooldown instead of competing
      // with score, level and ship survivability in the header.
      ctx.fillStyle = ready ? CONFIG.colors.white : "rgba(180,200,230,0.38)";
      ctx.font = "700 7px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(ab.label, x, y - 3);
    }
  }

  bar(ctx, x, y, w, h, t, color, label) {
    t = clamp(t, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (t > 0) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * t), h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (label) {
      ctx.fillStyle = "rgba(180,200,230,0.5)";
      ctx.font = "600 8px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(label, x, y - 2);
    }
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

  drawBossReward(ctx) {
    if (!this.bossRewardData) return;
    const d = this.bossRewardData;
    const W = CONFIG.designW, H = CONFIG.designH;
    const total = 3.2;
    const elapsed = total - this.bossRewardTimer;  // 0 → 3.2

    // Phase timings:
    //   0.0–0.5s  : flash punch fades in (ship silhouette beats in)
    //   0.5–3.2s  : full overlay readable
    // Alpha envelope: fade-in over 0.3s, hold, no fade-out (tap or timer ends it)
    const alpha = clamp(elapsed / 0.3, 0, 1);

    ctx.save();

    // ── Semi-transparent dark overlay — ship stays visible beneath ──
    ctx.globalAlpha = alpha * 0.78;
    ctx.fillStyle = "rgba(2,5,18,0.88)";
    ctx.fillRect(0, 0, W, H);

    // ── Branch-colored pulse ring around ship position ──
    // Ship is drawn at its actual position in drawWorld(); we draw a glow behind it.
    const pulse = 0.55 + 0.22 * Math.sin(this.time * 5);
    ctx.globalAlpha = alpha * pulse * 0.45;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, 72, 0, Math.PI * 2);
    ctx.fillStyle = d.branchColor;
    ctx.shadowColor = d.branchColor;
    ctx.shadowBlur = 38;
    ctx.fill();
    ctx.shadowBlur = 0;

    // The former boss XP drop is now a frozen, tangible reward: twelve
    // prismatic core shards arc from the destroyed boss into the ship before
    // their value is actually awarded when the screen is dismissed.
    this.drawBossXpShards(ctx, d, elapsed, alpha);

    // ── Text block — centred vertically in upper half ──
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    const cx = W / 2;

    // "BOSS DEFEATED" micro-label
    ctx.fillStyle = CONFIG.colors.red;
    ctx.font = "700 11px system-ui";
    ctx.shadowColor = CONFIG.colors.red;
    ctx.shadowBlur = 10;
    ctx.fillText(d.finalBoss ? "FINAL BOSS DEFEATED" : "BOSS DEFEATED", cx, 188);
    ctx.shadowBlur = 0;

    // The bonuses are real and explicit; no fictional ship frame is claimed
    // while the ship retains its actual visible modules.
    ctx.fillStyle = d.branchColor;
    ctx.font = "900 28px system-ui";
    ctx.shadowColor = d.branchColor;
    ctx.shadowBlur = 22;
    ctx.fillText(d.finalBoss ? "VOID CORE SECURED" : "SECTOR CLEARANCE", cx, 228);
    ctx.shadowBlur = 0;

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 18px system-ui";
    ctx.fillText(d.finalBoss ? "RUN COMPLETE" : SECTORS[this.currentSectorIndex].shortName, cx, 258);

    ctx.fillStyle = d.branchColor;
    ctx.font = "600 12px system-ui";
    ctx.fillText(d.finalBoss ? "Galalaxy secured" : "SECTOR BONUSES ONLINE", cx, 280);

    // ── Divider ──
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = d.branchColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 296); ctx.lineTo(cx + 90, 296);
    ctx.stroke();

    // ── Bonus lines — only appear after 0.6s (stagger feel) ──
    if (elapsed > 0.6) {
      const bonusAlpha = clamp((elapsed - 0.6) / 0.35, 0, 1);
      ctx.globalAlpha = alpha * bonusAlpha;
      ctx.fillStyle = CONFIG.colors.dim;
      ctx.font = "500 12px system-ui";
      const lineH = 22;
      const lines = d.finalBoss ? [
        `+ ${d.bossXp} Core XP recovered`,
        "+ Final sector cleared",
      ] : [
        `+ Movement Speed  ${d.moveBonusStr}`,
        `+ Auto-Fire Efficiency  ${d.fireBonusStr}`,
        `+ ${d.bossXp} Core XP recovered`,
      ];
      const visibleLines = lines;
      visibleLines.forEach((txt, i) => {
        ctx.fillStyle = i < 2 ? d.branchColor : CONFIG.colors.dim;
        ctx.font = i < 2 ? "600 12px system-ui" : "500 11px system-ui";
        ctx.globalAlpha = alpha * bonusAlpha * (i < 2 ? 0.9 : 0.72);
        ctx.fillText(txt, cx, 316 + i * lineH);
      });
    }

    // ── Tap hint — appears after 1.2s, pulses to draw attention ──
    if (elapsed > 1.2) {
      const hintFade = clamp((elapsed - 1.2) / 0.4, 0, 1);
      const hintPulse = 0.6 + 0.4 * Math.abs(Math.sin(this.time * 2.2));
      ctx.globalAlpha = hintFade * hintPulse;
      ctx.fillStyle = CONFIG.colors.white;
      ctx.font = "600 13px system-ui";
      ctx.shadowColor = d.branchColor;
      ctx.shadowBlur = 10;
      ctx.fillText("TAP TO CONTINUE", cx, H - 72);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  drawBossXpShards(ctx, reward, elapsed, alpha) {
    const travelStart = 0.14;
    const travelDuration = 0.72;
    const destination = { x: this.player.x, y: this.player.y - 12 };
    const colors = ["#67ff9a", "#58e6ff", "#bd72ff", "#ffe17a"];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < reward.bossXp; i++) {
      const delay = (i % 4) * 0.055 + Math.floor(i / 4) * 0.035;
      const raw = clamp((elapsed - travelStart - delay) / travelDuration, 0, 1);
      if (raw <= 0) continue;

      const p = raw * raw * (3 - 2 * raw);
      const angle = i * 2.39996;
      const sourceX = reward.bossX + Math.cos(angle) * (14 + (i % 3) * 8);
      const sourceY = reward.bossY + Math.sin(angle) * (14 + (i % 4) * 6);
      const dx = destination.x - sourceX;
      const dy = destination.y - sourceY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const curve = Math.sin(p * Math.PI) * (26 + (i % 4) * 9) * (i % 2 ? 1 : -1);
      const x = sourceX + dx * p + (-dy / length) * curve;
      const y = sourceY + dy * p + (dx / length) * curve;
      const color = colors[i % colors.length];
      const shardAlpha = alpha * (raw < 0.12 ? raw / 0.12 : 1) * (raw > 0.92 ? (1 - raw) / 0.08 : 1);

      const trail = ctx.createLinearGradient(sourceX, sourceY, x, y);
      trail.addColorStop(0, "rgba(110,255,205,0)");
      trail.addColorStop(0.55, color + "55");
      trail.addColorStop(1, color);
      ctx.globalAlpha = Math.max(0, shardAlpha) * 0.76;
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sourceX + dx * Math.max(0, p - 0.16), sourceY + dy * Math.max(0, p - 0.16));
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.globalAlpha = Math.max(0, shardAlpha);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = this.lowEffects ? 0 : 14;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + this.time * 3);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(4.5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-4.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.beginPath();
      ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    if (elapsed > travelStart + travelDuration + 0.15) {
      const pulse = 0.75 + Math.sin(this.time * 8) * 0.2;
      ctx.globalAlpha = alpha * pulse;
      ctx.textAlign = "center";
      ctx.fillStyle = "#b9fff3";
      ctx.shadowColor = "#58e6ff";
      ctx.shadowBlur = this.lowEffects ? 0 : 12;
      ctx.font = "800 12px system-ui";
      ctx.fillText(`+${reward.bossXp} CORE XP`, destination.x, Math.min(CONFIG.designH - 120, this.player.y + 82));
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

export const hudRenderingMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(HudRenderingMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
