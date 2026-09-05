import { CONFIG, SECTORS } from "../config.js";
import { clamp, fmtTime } from "../utils.js";
import { drawWrappedText } from "./text.js";

export const VICTORY_PLAY_BUTTON = { x: 72, y: 554, w: 276, h: 66 };
export const VICTORY_HANGAR_BUTTON = { x: 88, y: 644, w: 244, h: 50 };

class MenuRenderingMethods {
  drawVictory(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,6,22,0.88)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);

    // Text remains canvas-rendered for crisp, localizable stats while the
    // generated console gives the completed run a proper ceremonial frame.
    const victoryFrame = this.loader.get("uiVictoryCommandFrame");
    if (victoryFrame) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(victoryFrame, 0, 0, 1292, 1217, 36, 24, 348, 300);
      ctx.restore();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.font = "700 15px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 14;
    ctx.fillText("RUN COMPLETE", CONFIG.designW / 2, 110);
    ctx.shadowBlur = 0;

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 44px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 28;
    ctx.fillText(Math.floor(this.score).toString(), CONFIG.designW / 2, 175);
    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 12px system-ui";
    ctx.fillText(`Kills: ${this.kills} · Time: ${fmtTime(this.runTime)}`, CONFIG.designW / 2, 213);
    ctx.fillText(`Best: ${Math.floor(this.best)}`, CONFIG.designW / 2, 237);

    this.drawRunReview(ctx, 350, "FINAL SHIP", false);

    this.drawVictoryButton(ctx, VICTORY_PLAY_BUTTON, "PLAY AGAIN");
    this.drawHangarButton(ctx, VICTORY_HANGAR_BUTTON, "RETURN TO HANGAR");
    ctx.restore();
  }

  drawVictoryButton(ctx, { x, y, w, h }, text) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(5,17,36,0.9)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.fill();

    // Exact same authored command frame as START RUN on the title screen.
    const frame = this.loader.get("uiStartRunButtonFrame");
    if (frame) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.92 + Math.sin(this.time * 2.8) * 0.08;
      ctx.drawImage(frame, 0, 0, 1059, 238, x - 4, y - 4, w + 8, h + 8);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 20px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 8;
    ctx.fillText(text, x + w / 2, y + 42);
    ctx.restore();
  }

  drawHangarButton(ctx, { x, y, w, h }, text) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(5,17,36,0.78)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(88,230,255,0.62)";
    ctx.lineWidth = 1.25;
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    const notch = 15;
    ctx.beginPath();
    ctx.moveTo(x + notch, y + 8); ctx.lineTo(x + 8, y + 8); ctx.lineTo(x + 8, y + notch);
    ctx.moveTo(x + w - notch, y + 8); ctx.lineTo(x + w - 8, y + 8); ctx.lineTo(x + w - 8, y + notch);
    ctx.moveTo(x + notch, y + h - 8); ctx.lineTo(x + 8, y + h - 8); ctx.lineTo(x + 8, y + h - notch);
    ctx.moveTo(x + w - notch, y + h - 8); ctx.lineTo(x + w - 8, y + h - 8); ctx.lineTo(x + w - 8, y + h - notch);
    ctx.stroke();
    ctx.fillStyle = "rgba(220,240,255,0.82)";
    ctx.font = "800 13px system-ui";
    ctx.fillText(text, x + w / 2, y + 31);
    ctx.restore();
  }

  drawLoading(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 30px system-ui";
    ctx.fillText("GALALAXY", CONFIG.designW / 2, 300);
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
    const W = CONFIG.designW, H = CONFIG.designH;
    const t = this.titleTime;
    const cx = W / 2;

    ctx.save();
    ctx.textAlign = "center";

    // Dark overlay — heavy enough to suppress battle screen behind title
    ctx.fillStyle = "rgba(2,4,16,0.88)";
    ctx.fillRect(0, 0, W, H);
    // Second pass: deep vignette toward edges for depth
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.78);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,8,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Parallax star layer (slower, dimmer second pass) ──
    ctx.save();
    for (const s of this.stars) {
      const parallaxY = ((s.y - s.v * 0.008 * t * 60) % H + H) % H;
      ctx.globalAlpha = s.a * 0.35;
      ctx.fillStyle = "#c8e8ff";
      ctx.fillRect(s.x * 0.6 + W * 0.2, parallaxY, s.s * 0.7, s.s * 0.7);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Text-free title console: title and sector copy stay canvas-rendered so
    // they remain crisp, localizable, and independent from generated art.
    const titlePanel = this.loader.get("uiTitleCommandPanel");
    if (titlePanel) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(titlePanel, 0, 0, 872, 427, 16, 118, W - 32, 242);
      ctx.restore();
    }

    const shipPreviewY = 400 + Math.sin(t * 1.6) * 5;

    // ── Ship preview — parallax tilt from cursor/touch ──
    // Cursor offset from center → subtle bank angle, max ±0.12 rad
    const cursorOffsetX = (this.input.worldX || cx) - cx;
    const titleBank = clamp(cursorOffsetX / W * 0.5, -0.12, 0.12);
    const _px = this.player.x, _py = this.player.y, _pb = this.player.bank;
    this.player.x = cx;
    this.player.y = shipPreviewY;
    this.player.bank = titleBank;
    this.player.draw(ctx, this.loader, {
      showWeapon: false,
      showShield: false,
      showPassive: false,
      showKeystone: false,
      forceEngineLevel: 0,
    });
    this.player.x = _px; this.player.y = _py; this.player.bank = _pb;

    // ── Title block ──
    // GALALAXY — "LA" in cyan
    const glowPulse = 18 + Math.sin(t * 2.1) * 10;
    ctx.font = "900 52px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    const galaW   = ctx.measureText("GALA").width;
    const laW     = ctx.measureText("LA").width;
    const totalW  = ctx.measureText("GALALAXY").width;
    const tleft   = cx - totalW / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = CONFIG.colors.white;
    ctx.shadowBlur = glowPulse;
    ctx.fillText("GALA", tleft, 198);
    ctx.fillStyle = CONFIG.colors.cyan;
    ctx.shadowBlur = glowPulse * 1.4;
    ctx.fillText("LA", tleft + galaW, 198);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.shadowBlur = glowPulse;
    ctx.fillText("XY", tleft + galaW + laW, 198);
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";

    // Flavor text
    ctx.font = "400 11px system-ui";
    ctx.fillStyle = "#b8d4f0";
    ctx.globalAlpha = 0.75;
    ctx.fillText("Kla'ed Fleet wants to know your location", cx, 235);
    ctx.globalAlpha = 1;

    // ── Sector names — staggered reveal ──
    const SECTOR_NAMES = ["I · Kla'ed Frontier", "II · Nairan Expanse", "III · Nautolan Depths", "IV · Void Core"];
    ctx.font = "500 10px system-ui";
    for (let i = 0; i < SECTOR_NAMES.length; i++) {
      const elapsed = t - (0.8 + i * 0.45);
      if (elapsed <= 0) break;
      const alpha = Math.min(1, elapsed / 0.35) * 0.55;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#b8d4f0";
      // Fit all four entries in the lower console bay: clear of both the
      // central divider and the lower rail.
      ctx.fillText(SECTOR_NAMES[i], cx, 294 + i * 12);
    }
    ctx.globalAlpha = 1;

    // ── Best score — prominent, above button ──
    if (this.best > 0) {
      ctx.font = "700 13px system-ui";
      ctx.fillStyle = CONFIG.colors.cyan;
      ctx.globalAlpha = 0.85;
      ctx.fillText(`✦ BEST  ${Math.floor(this.best)}`, cx, 488);
      ctx.globalAlpha = 1;
    }

    // ── Start button — pulsing outline + ripple ──
    const btnX = 72, btnY = 515, btnW = 276, btnH = 66, btnR = 24;
    const btnCx = btnX + btnW / 2, btnCy = btnY + btnH / 2;

    // Ripple — expands every 3s, fades out
    const ripplePhase = (t % 3.0) / 3.0; // 0→1 every 3s
    if (ripplePhase < 0.55) {
      const rippleR = (btnW * 0.5 + 20) * (ripplePhase / 0.55);
      const rippleA = (1 - ripplePhase / 0.55) * 0.35;
      ctx.globalAlpha = rippleA;
      ctx.strokeStyle = CONFIG.colors.cyan;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = CONFIG.colors.cyan;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(btnCx, btnCy, rippleR, rippleR * (btnH / btnW), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Button interior stays intentionally quiet; the generated frame carries
    // the visual weight while the live label remains clear.
    ctx.fillStyle = "rgba(5,17,36,0.78)";
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, btnR);
    ctx.fill();
    const startFrame = this.loader.get("uiStartRunButtonFrame");
    if (startFrame) {
      const btnPulse = 0.78 + Math.sin(t * 2.8) * 0.14;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = btnPulse;
      ctx.drawImage(startFrame, 0, 0, 1059, 238, btnX - 4, btnY - 4, btnW + 8, btnH + 8);
      ctx.restore();
    }
    // Label
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 20px system-ui";
    ctx.shadowColor = CONFIG.colors.cyan;
    ctx.shadowBlur = 8;
    ctx.fillText("START RUN", cx, btnY + 42);
    ctx.shadowBlur = 0;

    // ── Bottom info ──
    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "600 12px system-ui";
    ctx.fillText("Drag to move · Auto-fire · Survive the fleet", cx, 614);

    if (this.loader.errors.length) {
      ctx.fillStyle = CONFIG.colors.orange;
      ctx.font = "700 11px system-ui";
      ctx.fillText("Some assets failed. Fallback visuals enabled.", cx, 650);
    }

    ctx.restore();
  }

  drawGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(2,4,12,0.78)";
    ctx.fillRect(0, 0, CONFIG.designW, CONFIG.designH);
    this.drawDefeatFrame(ctx);
    ctx.textAlign = "center";
    ctx.fillStyle = CONFIG.colors.red;
    ctx.font = "900 28px system-ui";
    ctx.fillText("SHIP DESTROYED", CONFIG.designW / 2, 110);

    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "900 40px system-ui";
    ctx.fillText(Math.floor(this.score).toString(), CONFIG.designW / 2, 175);

    ctx.fillStyle = CONFIG.colors.dim;
    ctx.font = "700 13px system-ui";
    ctx.fillText(`Kills: ${this.kills} · Time: ${fmtTime(this.runTime)}`, CONFIG.designW / 2, 213);
    ctx.fillText(`Best: ${Math.floor(this.best)}`, CONFIG.designW / 2, 237);

    this.drawRunReview(ctx, 350, "END SHIP", false);

    this.drawVictoryButton(ctx, VICTORY_PLAY_BUTTON, "PLAY AGAIN");
    this.drawHangarButton(ctx, VICTORY_HANGAR_BUTTON, "RETURN TO HANGAR");
    ctx.restore();
  }

  drawDefeatFrame(ctx) {
    ctx.save();
    const x = 36, y = 24, w = 348, h = 300, cut = 22;
    ctx.fillStyle = "rgba(24,8,27,0.92)";
    ctx.strokeStyle = "#b33f68";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const rail = this.loader.get("uiBossAlertFrame");
    if (rail) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(rail, x - 7, y - 3, w + 14, 42);
      ctx.drawImage(rail, x - 7, y + h - 39, w + 14, 42);
    }
    ctx.strokeStyle = CONFIG.colors.red;
    ctx.shadowColor = CONFIG.colors.red;
    ctx.shadowBlur = this.lowEffects ? 0 : 10;
    ctx.lineWidth = 3;
    for (const side of [x + 8, x + w - 8]) {
      ctx.beginPath();
      ctx.moveTo(side, y + 49);
      ctx.lineTo(side, y + 112);
      ctx.moveTo(side, y + h - 112);
      ctx.lineTo(side, y + h - 49);
      ctx.stroke();
    }
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

  drawRunReview(ctx, y, title, compact) {
    const summary = this.lastRun || {
      outcome: this.state === "victory" ? "victory" : "defeat",
      sectorReached: Math.max(1, this.currentSectorIndex + 1),
      sectorsCleared: this.sectorsCleared || 0,
      modules: [],
      keystoneName: null,
      cause: null,
      branch: this.player.shipBranch(),
    };
    const x = 34, w = 352, h = compact ? 140 : 166;
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(5,15,35,0.86)";
    ctx.strokeStyle = summary.outcome === "victory" ? "rgba(88,230,255,0.58)" : "rgba(255,70,107,0.58)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = summary.outcome === "victory" ? CONFIG.colors.cyan : CONFIG.colors.red;
    ctx.font = "800 10px ui-monospace, monospace";
    ctx.fillText(title, x + 14, y + 20);

    this._drawEndShipPreview(ctx, x + 74, y + (compact ? 78 : 88));
    const tx = x + 136;
    const branch = (summary.branch || this.player.shipBranch()).toUpperCase();
    ctx.fillStyle = CONFIG.colors.white;
    ctx.font = "800 14px system-ui";
    const tier = ["I", "II", "III", "IV"][(summary.tier || this.player.shipTier()) - 1];
    ctx.fillText(`MK-${tier} · ${branch}`, tx, y + 43);

    ctx.fillStyle = "rgba(225,240,255,0.76)";
    ctx.font = "600 11px system-ui";
    ctx.fillText(`Keystone: ${summary.keystoneName || "No keystone installed"}`, tx, y + 64);
    const sector = SECTORS[Math.min(SECTORS.length - 1, Math.max(0, (summary.sectorReached || 1) - 1))];
    ctx.fillText(`Reached ${sector.shortName} · Cleared ${summary.sectorsCleared || 0}/${SECTORS.length}`, tx, y + 83);
    ctx.fillText(`Cause: ${this._runCause(summary)}`, tx, y + 102);

    const modules = summary.modules?.length
      ? summary.modules.map(module => `${module.name} ${module.level}`).join(" · ")
      : "Starter systems only";
    ctx.fillStyle = CONFIG.colors.dim;
    drawWrappedText(ctx, modules, tx, y + 124, w - (tx - x) - 12, compact ? 2 : 2, 10, 600);
    ctx.restore();
  }

  _drawEndShipPreview(ctx, x, y) {
    const player = Object.assign(Object.create(Object.getPrototypeOf(this.player)), this.player);
    player.x = x;
    player.y = y;
    player.bank = 0;
    player.vx = 0;
    player.vy = 0;
    player.hitFlash = 0;
    player.invuln = 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.86, 0.86);
    ctx.translate(-x, -y);
    player.draw(ctx, this.loader, { showShield: true });
    ctx.restore();
  }

  _runCause(summary) {
    if (summary.outcome === "victory") return "Void Core secured";
    if (summary.cause?.kind === "collision") return summary.cause.boss ? "Boss collision" : "Enemy collision";
    if (summary.cause?.kind === "projectile") return "Enemy fire";
    return "Hull failure";
  }

  // ── Rendering helpers (used by entities via this.game.*) ───────────────────
}

export const menuRenderingMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(MenuRenderingMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
