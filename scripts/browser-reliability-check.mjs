// Requires Playwright (resolvable through NODE_PATH) and a local HTTP server.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.GALALAXY_QA_URL || "http://127.0.0.1:8765";
const output = process.env.GALALAXY_QA_OUTPUT
  ? new URL(`${pathToFileURL(resolve(process.env.GALALAXY_QA_OUTPUT)).href}/`)
  : new URL("../docs/qa/reliability-2026-09-05/", import.meta.url);
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
  const controlsPage = await context.newPage();
  controlsPage.on("pageerror", error => errors.push(`controls page: ${error.message}`));
  controlsPage.on("response", response => {
    if (response.status() >= 400) errors.push(`controls page: ${response.status()} ${response.url()}`);
  });
  await controlsPage.goto(`${base}/?test=hud-layout`);
  await controlsPage.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    g.input.cancelMovement();
    g.player.x = 210;
    g.player.y = 420;
    g.player.fireTimer = Number.MAX_VALUE;
  });
  await controlsPage.keyboard.down("w");
  const enabledMovement = await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const before = g.player.y;
    g.player.update(0.1);
    return {
      enabled: g.input.keyboardMovementEnabled,
      movedUp: g.player.y < before,
      vectorActive: g.input.movementVector().active,
    };
  });
  await controlsPage.keyboard.up("w");
  const releaseAndPointer = await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const released = !g.input.movementVector().active;
    g.player.x = 210;
    g.player.y = 420;
    g.input.active = true;
    g.input.shipX = 120;
    g.input.shipY = 420;
    g.player.update(0.1);
    return { released, pointerResumed: g.player.x < 210 };
  });
  await controlsPage.keyboard.down("d");
  const pauseClearsKeys = await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    g.togglePause();
    const cleared = !g.input.movementVector().active;
    g.togglePause();
    return cleared;
  });
  await controlsPage.keyboard.up("d");
  await controlsPage.goto(`${base}/?test=hud-layout&controls=pointer`);
  await controlsPage.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    g.input.cancelMovement();
    g.player.x = 210;
    g.player.y = 420;
    g.player.fireTimer = Number.MAX_VALUE;
  });
  await controlsPage.keyboard.down("w");
  const pointerFallback = await controlsPage.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const before = g.player.y;
    g.player.update(0.1);
    return { enabled: g.input.keyboardMovementEnabled, stayedPut: g.player.y === before };
  });
  await controlsPage.keyboard.up("w");
  await controlsPage.close();
  report.keyboardControl = { ...enabledMovement, ...releaseAndPointer, pauseClearsKeys, pointerFallback };
  assert.deepEqual(report.keyboardControl, {
    enabled: true,
    movedUp: true,
    vectorActive: true,
    released: true,
    pointerResumed: true,
    pauseClearsKeys: true,
    pointerFallback: { enabled: false, stayedPut: true },
  });
  report.encounterDefinitions = await page.evaluate(async () => {
    const { WAVE_CARDS, SECTOR_ENCOUNTER_PROFILES } = await import("/src/data/encounters.js");
    return {
      cardCount: Object.keys(WAVE_CARDS).length,
      durationsValid: Object.values(WAVE_CARDS).every(card => card.duration >= 8 && card.duration <= 12),
      corridorsPresent: Object.values(WAVE_CARDS).every(card => Boolean(card.safeCorridor)),
      identities: SECTOR_ENCOUNTER_PROFILES.map(profile => profile.id),
      openings: SECTOR_ENCOUNTER_PROFILES.map(profile => profile.openingWave),
      budgets: SECTOR_ENCOUNTER_PROFILES.map(profile => ({
        enemies: profile.enemyCap,
        projectiles: profile.projectileCap,
        recovery: profile.recovery,
      })),
    };
  });
  assert.equal(report.encounterDefinitions.cardCount, 12);
  assert.equal(report.encounterDefinitions.durationsValid, true);
  assert.equal(report.encounterDefinitions.corridorsPresent, true);
  assert.equal(new Set(report.encounterDefinitions.identities).size, 4);
  assert.deepEqual(report.encounterDefinitions.openings,
    ["single-file", "side-sweep", "anchor-corridor", "finale-relay"]);
  await screenshot("title");

  // Final boss rewards must finish every earned choice before saving victory.
  report.finalReward = await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    await g._loadAssetGroups(["victory"]);
    g.currentSectorIndex = 3;
    g.state = "playing";
    g.onBossKilled(210, 100, 22);
    const duration = g.bossRewardData.duration;
    const minimumHold = g.bossRewardData.minimumHold;
    g._endBossReward();
    const queued = g.pendingUpgrades;
    g.upgrades.pick(0);
    const between = g.state;
    g.upgrades.pick(0);
    return { queued, between, state: g.state, outcome: g.lastRun?.outcome,
      cleared: g.lastRun?.sectorsCleared, duration, minimumHold };
  });
  assert.deepEqual(report.finalReward, {
    queued: 2, between: "levelUp", state: "victory", outcome: "victory", cleared: 4,
    duration: 4.3, minimumHold: 2.4,
  });

  await page.evaluate(async () => {
    const g = window.__galalaxyTestGame;
    await g._loadAssetGroups(["klaed"]);
    g.startRun();
    g.sectorTimer = 999;
    g.encounterDirector = { disabled: true, sectorIndex: g.currentSectorIndex };
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
    g.player.shield = 2;
    g.player.damage(1, { kind: "projectile" });
    g.player.invuln = 0;
    g.player.damage(1, { kind: "projectile" });
    g.player.invuln = 0;
    g.player.damage(1, { kind: "projectile" });
    g.gainXp(8);
    g.upgrades.pick(0);
    g.sectorTimer = 0;
    g.updateSpawning(0.01);
    return { state: g.sounds.context?.state, played: [...g.sounds.lastPlayed.keys()].sort() };
  });
  assert.deepEqual(report.soundCues, { state: "running", played: ["boss", "hit", "kill", "shield", "shieldBreak", "upgrade"] });

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
  await page.goto(`${base}/?test=pickup-showcase`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  report.pickupShowcase = await page.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const kinds = g.pickups.filter(pickup => pickup.kind).map(pickup => pickup.kind).sort();
    const assetsLoaded = ["combatPickupRepair", "combatPickupShield", "combatPickupOverdrive"]
      .every(key => Boolean(g.loader.get(key)));
    return { kinds, assetsLoaded };
  });
  assert.deepEqual(report.pickupShowcase, {
    kinds: ["overdrive", "repair", "shield"],
    assetsLoaded: true,
  });
  await screenshot("pickup-assets");

  report.encounterScenes = [];
  for (let sectorIndex = 0; sectorIndex < 4; sectorIndex++) {
    await page.goto(`${base}/?test=sector-map&sector=${sectorIndex}`);
    await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
    const scene = await page.evaluate(async sectorIndex => {
      const g = window.__galalaxyTestGame;
      const { SECTORS } = await import("/src/config.js");
      const { SECTOR_ASSET_GROUPS } = await import("/src/assets.js");
      const { encounterProfileFor } = await import("/src/data/encounters.js");
      await g._loadAssetGroups([SECTOR_ASSET_GROUPS[sectorIndex]]);
      g.clearArena();
      g.currentSectorIndex = sectorIndex;
      g.sectorTimer = SECTORS[sectorIndex].duration;
      g.encounterDirector = null;
      g.bossActive = false;
      g.bossWarning = 0;
      g.state = "playing";
      g.player.x = 210;
      g.player.y = 630;
      g.player.fireTimer = Number.MAX_VALUE;
      g.player.invuln = Number.POSITIVE_INFINITY;
      const update = g.update.bind(g);
      // Advance just into the authored opening wave, then freeze for a stable
      // visual proof of each sector's distinct entry pattern.
      const previewSeconds = encounterProfileFor(sectorIndex).openingDelay + (sectorIndex === 3 ? 7 : 5);
      for (let i = 0; i < Math.ceil(previewSeconds * 60); i++) update(1 / 60);
      g.update = () => {};
      const profile = encounterProfileFor(sectorIndex);
      return {
        sector: sectorIndex + 1,
        profile: profile.id,
        wave: g.encounterDirector?.waveId,
        enemies: g.enemies.filter(enemy => !enemy.dead).length,
        enemyCap: profile.enemyCap,
        enemyProjectiles: g.projectiles.filter(projectile => projectile.owner === "enemy" && !projectile.dead).length,
        projectileCap: profile.projectileCap,
      };
    }, sectorIndex);
    assert.ok(scene.enemies <= scene.enemyCap, JSON.stringify(scene));
    assert.ok(scene.enemyProjectiles <= scene.projectileCap, JSON.stringify(scene));
    report.encounterScenes.push(scene);
    await screenshot(`encounter-sector-${sectorIndex + 1}`);
    if (sectorIndex === 1) {
      report.nairanTargetLock = await page.evaluate(async () => {
        const g = window.__galalaxyTestGame;
        const { Enemy } = await import("/src/entities/enemy.js");
        const enemy = new Enemy(g, "nairanFrigate", 105, 175);
        enemy.fireTimer = 0;
        g.enemies = [enemy];
        g.projectiles = [];
        enemy.update(0.01);
        return {
          kind: enemy.specialCharge?.kind,
          targetX: enemy.specialCharge?.targetX,
          targetY: enemy.specialCharge?.targetY,
          queuedShots: enemy.pendingShots.length,
        };
      });
      assert.deepEqual(report.nairanTargetLock, {
        kind: "precision", targetX: 210, targetY: 630, queuedShots: 1,
      });
      await screenshot("encounter-sector-2-target-lock");
    }
  }
  assert.deepEqual(report.encounterScenes.map(scene => scene.wave),
    ["single-file", "side-sweep", "anchor-corridor", "finale-relay"]);

  report.formationScenes = [];
  const formationScenarios = [
    { sectorIndex: 0, cardId: "open-v", expected: 5 },
    { sectorIndex: 1, cardId: "split-v", expected: 6 },
    { sectorIndex: 2, cardId: "escort-box", expected: 5 },
    { sectorIndex: 3, cardId: "finale-spear", expected: 7 },
  ];
  for (const scenario of formationScenarios) {
    await page.goto(`${base}/?test=sector-map&sector=${scenario.sectorIndex}`);
    await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
    const scene = await page.evaluate(async ({ sectorIndex, cardId }) => {
      const g = window.__galalaxyTestGame;
      const { SECTORS } = await import("/src/config.js");
      const { SECTOR_ASSET_GROUPS } = await import("/src/assets.js");
      const {
        WAVE_CARDS, createEncounterDirector, encounterProfileFor,
      } = await import("/src/data/encounters.js");
      await g._loadAssetGroups([SECTOR_ASSET_GROUPS[sectorIndex]]);
      g.clearArena();
      g.currentSectorIndex = sectorIndex;
      g.sectorTimer = SECTORS[sectorIndex].duration;
      g.encounterDirector = createEncounterDirector(sectorIndex);
      g.bossActive = false;
      g.bossWarning = 0;
      g.state = "playing";
      g.player.x = 210;
      g.player.y = 630;
      g.player.fireTimer = Number.MAX_VALUE;
      g.player.invuln = Number.POSITIVE_INFINITY;
      g._activateEncounterWave(WAVE_CARDS[cardId], encounterProfileFor(sectorIndex), 0.55);
      const update = g.update.bind(g);
      for (let i = 0; i < Math.ceil(2.4 * 60); i++) update(1 / 60);
      g.update = () => {};
      const group = g.enemies.filter(enemy => !enemy.dead && enemy.formationId);
      const speeds = group.map(enemy => Math.hypot(enemy.flyby.vx, enemy.flyby.vy));
      return {
        sector: sectorIndex + 1,
        cardId,
        ships: group.length,
        groupIds: [...new Set(group.map(enemy => enemy.formationId))],
        slots: group.map(enemy => enemy.formationSlot).sort((a, b) => a - b),
        sharedVelocity: new Set(group.map(enemy => `${enemy.flyby.vx},${enemy.flyby.vy}`)).size === 1,
        maxSpeed: Math.max(...speeds),
        allVisible: group.every(enemy => enemy.x >= -20 && enemy.x <= 440 && enemy.y >= -20 && enemy.y <= 760),
        bounds: {
          left: Math.min(...group.map(enemy => enemy.x)),
          right: Math.max(...group.map(enemy => enemy.x)),
          top: Math.min(...group.map(enemy => enemy.y)),
          bottom: Math.max(...group.map(enemy => enemy.y)),
        },
      };
    }, scenario);
    assert.equal(scene.ships, scenario.expected, JSON.stringify(scene));
    assert.equal(scene.groupIds.length, 1, JSON.stringify(scene));
    assert.deepEqual(scene.slots, Array.from({ length: scenario.expected }, (_, index) => index));
    assert.equal(scene.sharedVelocity, true, JSON.stringify(scene));
    assert.ok(scene.maxSpeed <= 120, JSON.stringify(scene));
    assert.equal(scene.allVisible, true, JSON.stringify(scene));
    report.formationScenes.push(scene);
    await screenshot(`formation-sector-${scenario.sectorIndex + 1}`);
  }

  report.enemyRoles = {};
  await page.goto(`${base}/?test=enemy-role&role=torpedo`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  report.enemyRoles.torpedo = await page.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const enemy = g.enemies.find(candidate => candidate.type === "nairanTorpedoShip");
    enemy.x = 210;
    enemy.y = 175;
    enemy.pendingShots = [];
    enemy.specialCharge = null;
    enemy.fireTimer = 0;
    enemy.update(0.01);
    g.update = () => {};
    const keys = ["nairanTorpedoShip", "nairanTorpedoShipEngine", "nairanTorpedoShipWeapon",
      "nairanTorpedoShipShield", "nairanTorpedoShipDestruction", "nairanTorpedo"];
    return {
      charge: enemy.specialCharge?.kind,
      warningSeconds: enemy.specialCharge?.duration,
      queuedShots: enemy.pendingShots.length,
      fullyVisible: enemy._isFullyOnscreen(),
      assetsLoaded: keys.every(key => Boolean(g.loader.get(key))),
    };
  });
  assert.deepEqual(report.enemyRoles.torpedo, {
    charge: "torpedo-lock", warningSeconds: 1.05, queuedShots: 1, fullyVisible: true, assetsLoaded: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await screenshot("enemy-role-torpedo-small");

  await page.goto(`${base}/?test=enemy-role&role=support`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  report.enemyRoles.support = await page.evaluate(() => {
    const g = window.__galalaxyTestGame;
    const support = g.enemies.find(candidate => candidate.type === "nautolanSupport");
    support._refreshSupportTargets();
    g.update = () => {};
    return {
      protectedTargets: support.supportTargets.length,
      visibleSources: support.supportTargets.every(target => target.supportSource === support),
      vulnerable: support.maxHp < Math.min(...support.supportTargets.map(target => target.maxHp)),
      assetsLoaded: ["nautolanSupport", "nautolanSupportEngine", "nautolanSupportDestruction"]
        .every(key => Boolean(g.loader.get(key))),
    };
  });
  assert.deepEqual(report.enemyRoles.support, {
    protectedTargets: 1, visibleSources: true, vulnerable: true, assetsLoaded: true,
  });
  await screenshot("enemy-role-support-small");
  await page.setViewportSize({ width: 390, height: 844 });

  report.bossScenes = [];
  const bossPhases = [1, 1, 2, 3];
  for (let sector = 1; sector <= 4; sector++) {
    const phase = bossPhases[sector - 1];
    await page.goto(`${base}/?test=boss&sector=${sector}&phase=${phase}`);
    await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
    const scene = await page.evaluate(({ sector, phase }) => {
      const g = window.__galalaxyTestGame;
      const boss = g.enemies.find(enemy => enemy.boss && !enemy.dead);
      boss.pendingShots = [];
      boss.specialCharge = null;
      boss.fireTimer = 0;
      if (sector === 1) boss._klaedPattern = 2;
      else if (sector >= 3) boss._bossPattern = 1;
      boss.update(0.01);
      const support = g.enemies.find(enemy => enemy.type === "nautolanSupport" && !enemy.dead);
      g.update = () => {};
      return {
        sector,
        type: boss.type,
        name: boss.bossProfile?.name,
        movement: boss.bossProfile?.movement,
        phase: boss.bossPhase,
        attack: boss.specialCharge?.kind,
        safeLanes: boss.specialCharge?.safeLane === undefined ? null : 1,
        protectedBySupport: Boolean(support?.supportTargets.includes(boss)),
        voidCoreLoaded: sector !== 4 || Boolean(g.loader.get("environmentVoidCore")),
      };
    }, { sector, phase });
    report.bossScenes.push(scene);
    await screenshot(`boss-sector-${sector}-phase-${phase}`);
  }
  assert.deepEqual(report.bossScenes.map(scene => scene.type),
    ["dreadnought", "nairanDreadnought", "nautolanDreadnought", "voidSovereign"]);
  assert.equal(new Set(report.bossScenes.map(scene => scene.name)).size, 4);
  assert.equal(new Set(report.bossScenes.map(scene => scene.movement)).size, 4);
  assert.deepEqual(report.bossScenes.map(scene => scene.attack),
    ["torpedo", "boss-target-lock", "control-gate", "void-rift"]);
  assert.equal(report.bossScenes[2].protectedBySupport, true);
  assert.ok(report.bossScenes.slice(2).every(scene => scene.safeLanes === 1));
  assert.ok(report.bossScenes.every(scene => scene.voidCoreLoaded));

  await page.goto(`${base}/?test=hud-layout`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
  await page.evaluate(() => { window.__galalaxyTestGame.update = () => {}; });
  await screenshot("hud");
  report.hudLayouts = [];
  for (const [width, height, safeTop] of [[390, 844, 0], [360, 800, 0], [360, 900, 0], [320, 740, 0], [430, 932, 0], [390, 1000, 44], [900, 420, 0]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(({ safeTop }) => {
      const g = window.__galalaxyTestGame;
      document.documentElement.style.setProperty("--safe-top", `${safeTop}px`);
      g.resize();
      // Inspect the actual Canvas transforms used by both render paths.
      const ctx = g.ctx, roundRect = ctx.roundRect, drawImage = ctx.drawImage;
      let headerTop, headerBottom, bossFrameTop;
      ctx.roundRect = function(x, y, w, h, ...rest) {
        if (w === 400 && h === 82) {
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
    assert.ok(Math.abs(layout.gap - 12) < 0.001, `Boss frame gap: ${JSON.stringify(layout)}`);
    assert.ok(layout.pauseInsideHeader, "Pause control follows the relocated header");
    assert.ok(Math.abs(layout.headerTop - (safeTop + 4)) < 0.01,
      `HUD is anchored 4px below the safe area: ${JSON.stringify(layout)}`);
    report.hudLayouts.push({ width, height, safeTop, ...layout });
    await screenshot(`hud-${width}x${height}-safe${safeTop}`);
  }
  assert.ok(report.hudLayouts.every(layout => layout.headerOffset < 0),
    "Every tested viewport relocates the header to the physical safe-area edge");
  assert.deepEqual(errors, [], "No browser errors or failed asset responses");
  report.errors = errors;
  report.ok = true;
  await writeFile(new URL("report.json", output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
