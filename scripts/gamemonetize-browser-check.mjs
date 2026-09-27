import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.GALALAXY_GAMEMONETIZE_QA_URL || "http://127.0.0.1:8766";
const output = resolve("release/gamemonetize/qa");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: process.env.GALALAXY_BROWSER_CHANNEL || "msedge" });
const context = await browser.newContext({
  viewport: { width: 420, height: 760 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});

await page.route("https://api.gamemonetize.com/sdk.js", route => route.fulfill({
  contentType: "application/javascript",
  body: `
    window.__gmStub = { showCount: 0, events: [] };
    window.sdk = {
      showBanner() {
        window.__gmStub.showCount += 1;
        window.__gmStub.events.push("request");
        window.SDK_OPTIONS.onEvent({ name: "SDK_GAME_PAUSE" });
        const game = window.__galalaxyTestGame;
        window.__gmStub.duringAd = {
          audioGuard: Boolean(game?._platformAdAudio),
          musicPaused: Boolean(game?._music?.paused),
        };
        setTimeout(() => {
          window.__gmStub.events.push("complete");
          window.SDK_OPTIONS.onEvent({ name: "SDK_GAME_START" });
        }, 60);
      }
    };
    setTimeout(() => window.SDK_OPTIONS.onEvent({ name: "SDK_READY" }), 0);
  `,
}));

try {
  await page.goto(`${base}/?test=hud-layout`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  await page.waitForFunction(() => window.__galalaxyTestGame?.gameMonetize?.ready);
  await page.evaluate(() => {
    const game = window.__galalaxyTestGame;
    game.state = "title";
    game.startRunWithPortalAd();
  });
  await page.waitForFunction(() => {
    const game = window.__galalaxyTestGame;
    return window.__gmStub?.showCount === 1 && game?.state === "playing" && !game?.gameMonetize?.inFlight;
  });

  const report = await page.evaluate(() => {
    const game = window.__galalaxyTestGame;
    return {
      platform: window.__GALALAXY_PLATFORM__,
      configuredGameId: window.SDK_OPTIONS?.gameId,
      sdkReady: game.gameMonetize.ready,
      sdkEnabled: game.gameMonetize.enabled,
      showCount: window.__gmStub.showCount,
      events: window.__gmStub.events,
      duringAd: window.__gmStub.duringAd,
      finalState: game.state,
      adGuardCleared: !game._platformAdAudio,
      requestLockCleared: !game._runStartAdPending,
      errors,
    };
  });

  assert.equal(report.platform, "gamemonetize");
  assert.equal(report.configuredGameId, "aigvlrz2fcu4j3648qlmni6v8xwacflx");
  assert.equal(report.sdkReady, true);
  assert.equal(report.sdkEnabled, true);
  assert.equal(report.showCount, 1);
  assert.deepEqual(report.events, ["request", "complete"]);
  assert.deepEqual(report.duringAd, { audioGuard: true, musicPaused: true });
  assert.equal(report.finalState, "playing");
  assert.equal(report.adGuardCleared, true);
  assert.equal(report.requestLockCleared, true);
  assert.deepEqual(report.errors, []);

  await page.screenshot({ path: resolve(output, "play-after-ad.png") });
  await writeFile(resolve(output, "report.json"), JSON.stringify({ ...report, ok: true }, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, ok: true }, null, 2));
} finally {
  await browser.close();
}
