// Requires Playwright (resolvable through NODE_PATH) and the generated Y8
// build served over HTTP. The SDK request is intercepted with a deterministic
// test implementation, so no live ads or Y8 account are involved.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { Y8_APP_ID, Y8_GAME_ID, Y8_SDK_URL } from "../src/y8.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.GALALAXY_Y8_QA_URL || "http://127.0.0.1:8766";
const browser = await chromium.launch({ headless: true, channel: process.env.GALALAXY_BROWSER_CHANNEL || "msedge" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.route(Y8_SDK_URL, route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `
      window.__y8Qa = { init: null, ads: [] };
      window.y8 = {
        sdk() {
          return {
            init(appConfig, adConfig) {
              window.__y8Qa.init = { appConfig, adConfig };
              adConfig.onReady();
            },
            onAuth(callback) { callback(null, null); },
            showAd(options) {
              window.__y8Qa.ads.push({ type: options.type, name: options.name });
              options.beforeAd();
              options.afterAd();
              options.adBreakDone({ breakStatus: "viewed" });
              return Promise.resolve();
            }
          };
        },
        emitReadyEvent() { window.dispatchEvent(new Event("y8sdk.ready")); }
      };
      queueMicrotask(() => window.y8.emitReadyEvent());
    `,
  }));

  await page.goto(`${base}/?test=hud-layout`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.y8?.ready, { timeout: 15000 });

  const report = await page.evaluate(async () => {
    const game = window.__galalaxyTestGame;
    game.state = "gameOver";
    let starts = 0;
    game.startRun = () => {
      starts++;
      game.state = "playing";
      return true;
    };
    game.startRunFromResults();
    await new Promise(resolve => setTimeout(resolve, 0));
    return {
      platform: window.__GALALAXY_PLATFORM__,
      ready: game.y8.ready,
      init: window.__y8Qa.init,
      ads: window.__y8Qa.ads,
      starts,
      pending: game._runRestartAdPending,
      audioRestored: game._platformAdAudio === null,
    };
  });

  assert.equal(report.platform, "y8");
  assert.equal(report.ready, true);
  assert.equal(report.init.appConfig.appId, Y8_APP_ID);
  assert.equal(report.init.adConfig.gameId, Y8_GAME_ID);
  assert.deepEqual(report.ads, [{ type: "next", name: "new-run" }]);
  assert.equal(report.starts, 1);
  assert.equal(report.pending, false);
  assert.equal(report.audioRestored, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} finally {
  await browser.close();
}
