// Requires Playwright (resolvable through NODE_PATH) and a local HTTP server.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.GALALAXY_QA_URL || "http://127.0.0.1:8765";
const output = new URL("../docs/qa/reliability-2026-09-05/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.GALALAXY_BROWSER_CHANNEL || "msedge" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const report = {};
const screenshot = name => page.screenshot({ path: new URL(`${name}.png`, output).pathname.replace(/^\/([A-Z]:)/, "$1") });
try {
  await page.goto(`${base}/?test=full-run`);
  await page.waitForFunction(() => document.documentElement.dataset.fullRunTest, { timeout: 20000 });
  report.fullRun = await page.evaluate(() => JSON.parse(document.documentElement.dataset.fullRunReport));
  assert.equal(report.fullRun.ok, true, JSON.stringify(report.fullRun));
  await screenshot("title");

  // Final boss rewards must finish every earned choice before saving victory.
  report.finalReward = await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    await g._loadAssetGroups(["victory"]);
    g.currentSectorIndex = 3;
    g.state = "playing";
    g.onBossKilled(210, 100, 22);
    g._endBossReward();
    const queued = g.pendingUpgrades;
    g.upgrades.pick(0);
    const between = g.state;
    g.upgrades.pick(0);
    return { queued, between, state: g.state, outcome: g.lastRun?.outcome, cleared: g.lastRun?.sectorsCleared };
  });
  assert.deepEqual(report.finalReward, { queued: 2, between: "levelUp", state: "victory", outcome: "victory", cleared: 4 });

  await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    await g._loadAssetGroups(["klaed"]);
    g.startRun();
    g.spawnTimer = 999;
    g.sectorTimer = 999;
    g.player.invuln = 999;
  });
  const pausePoint = await page.evaluate(() => {
    const g = window.__galalaxyTestGame, z = g._pauseBtnZone;
    return { x: g.offsetX + (z.x + z.w / 2) * g.scale, y: g.offsetY + (z.y + z.h / 2) * g.scale };
  });
  await page.touchscreen.tap(pausePoint.x, pausePoint.y);
  await page.waitForFunction(() => window.__galalaxyTestGame.state === "paused");
  report.pause = await page.evaluate(() => {
    const g = window.__galalaxyTestGame, time = g.simTime;
    g.update(8);
    return { frozen: time === g.simTime, pointerReleased: !g.input.active };
  });
  assert.deepEqual(report.pause, { frozen: true, pointerReleased: true });
  await screenshot("pause");
  await page.touchscreen.tap(195, 422);
  await page.waitForFunction(() => window.__galalaxyTestGame.state === "playing");
  report.pointerLifecycle = await page.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const pointer = (type, id, x, y) => g.canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: "touch", clientX: g.offsetX + x * g.scale,
      clientY: g.offsetY + y * g.scale, bubbles: true, cancelable: true,
    }));
    pointer("pointerdown", 101, 140, 480);
    pointer("pointerdown", 102, 270, 530);
    pointer("pointermove", 102, 300, 560);
    pointer("pointerup", 102, 300, 560);
    const ownerPreserved = g.input.pointerId === 101 && g.input.worldX === 140;
    // The first finger still has an unconsumed tap when focus is lost.
    window.dispatchEvent(new Event("blur"));
    g.update(1);
    const stayedPaused = g.state === "paused" && !g.input.active && g.input.pointerId === null;
    return { ownerPreserved, stayedPaused };
  });
  assert.deepEqual(report.pointerLifecycle, { ownerPreserved: true, stayedPaused: true });
  await page.touchscreen.tap(195, 422);
  await page.waitForFunction(() => window.__galalaxyTestGame.state === "playing");

  report.soundCues = await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    const { Enemy } = await import("/src/entities/enemy.js");
    const enemy = new Enemy(g, "frigate", 100, 100);
    enemy.damage(10000);
    g.player.invuln = 0;
    g.player.damage(1, { kind: "projectile" });
    g.gainXp(8);
    g.upgrades.pick(0);
    g.sectorTimer = 0;
    g.updateSpawning(0.01);
    return { state: g.sounds.context?.state, played: [...g.sounds.lastPlayed.keys()].sort() };
  });
  assert.deepEqual(report.soundCues, { state: "running", played: ["boss", "hit", "kill", "upgrade"] });

  // Use an actual recorded run with all four module rows and the longest name.
  report.runReview = await page.evaluate(() => {
    const g = window.__galalaxyTestGame;
    g.clearArena();
    g.currentSectorIndex = 2;
    g.sectorsCleared = 2;
    g.runTime = 500;
    g.score = 12000;
    g.kills = 101;
    Object.assign(g.player, { rocket: 4, zapper: 5, shieldLevel: 3, speedLevel: 3, keystoneId: "overcharged" });
    g.endRun({ kind: "projectile" });
    return { outcome: g.lastRun.outcome, modules: g.lastRun.modules.length, sector: g.lastRun.sectorReached, cause: g.lastRun.cause.kind };
  });
  assert.deepEqual(report.runReview, { outcome: "defeat", modules: 4, sector: 3, cause: "projectile" });
  await screenshot("game-over");
  await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    await g._loadAssetGroups(["victory"]);
    g.currentSectorIndex = 3;
    g.sectorsCleared = 4;
    g.runFinished = false;
    g.finishRun("victory");
    g.state = "victory";
  });
  await screenshot("victory");

  for (const family of ["aegis", "rocket"]) {
    await page.goto(`${base}/?test=upgrade-cards&upgradeFamily=${family}`);
    await page.waitForFunction(() => window.__galalaxyTestGame?.state === "levelUp");
    await screenshot(`upgrades-${family}`);
  }
  await page.goto(`${base}/?test=hud-layout`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  await page.evaluate(() => { window.__galalaxyTestGame.update = () => {}; });
  await screenshot("hud");
  report.hudLayouts = [];
  for (const [width, height, safeTop] of [[390, 844, 0], [360, 900, 0], [320, 740, 0], [430, 932, 0], [390, 1000, 44], [900, 420, 0]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(({ safeTop }) => {
      const g = window.__galalaxyTestGame;
      document.documentElement.style.setProperty("--safe-top", `${safeTop}px`);
      g.resize();
      // Inspect the actual Canvas transforms used by both render paths.
      const ctx = g.ctx, roundRect = ctx.roundRect, drawImage = ctx.drawImage;
      let headerTop, headerBottom, bossFrameTop;
      ctx.roundRect = function(x, y, w, h, ...rest) {
        if (w === 400 && h === 74) {
          const m = this.getTransform();
          headerTop = (m.d * y + m.f) / g.renderDpr;
          headerBottom = (m.d * (y + h) + m.f) / g.renderDpr;
        }
        return roundRect.call(this, x, y, w, h, ...rest);
      };
      ctx.drawImage = function(img, ...args) {
        if (img.src?.includes("boss-alert-frame") && args.length === 8) {
          const m = this.getTransform();
          bossFrameTop = (m.d * args[5] + m.f) / g.renderDpr;
        }
        return drawImage.call(this, img, ...args);
      };
      try { g.draw(); } finally { ctx.roundRect = roundRect; ctx.drawImage = drawImage; }
      const pauseTop = g.offsetY + g._pauseBtnZone.y * g.scale;
      const pauseBottom = pauseTop + g._pauseBtnZone.h * g.scale;
      return { headerOffset: g.hudHeaderOffsetY(), headerTop, gap: (bossFrameTop - headerBottom) / g.scale,
        pauseInsideHeader: pauseTop >= headerTop && pauseBottom <= headerBottom };
    }, { safeTop });
    assert.ok(Math.abs(layout.gap - 6) < 0.001, `Boss frame gap: ${JSON.stringify(layout)}`);
    assert.ok(layout.pauseInsideHeader, "Pause control follows the relocated header");
    assert.ok(layout.headerTop >= safeTop, "HUD respects top safe area");
    report.hudLayouts.push({ width, height, safeTop, ...layout });
    await screenshot(`hud-${width}x${height}-safe${safeTop}`);
  }
  assert.ok(report.hudLayouts.some(layout => layout.headerOffset < 0), "Test covers a relocated header");
  assert.ok(report.hudLayouts.some(layout => layout.headerOffset === 0), "Test covers an in-field header");
  assert.deepEqual(errors, [], "No browser errors or failed asset responses");
  report.errors = errors;
  report.ok = true;
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
