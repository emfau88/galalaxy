import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { Player } from "../src/entities/player.js";
import { Enemy } from "../src/entities/enemy.js";
import { UpgradeSystem } from "../src/systems/upgrades.js";
import { RunStats } from "../src/runStats.js";
import { wrapText } from "../src/rendering/text.js";
import { SECTORS } from "../src/config.js";

function createGame() {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    state: "playing",
    simTime: 0,
    time: 0,
    xp: 0,
    xpNeed: 8,
    level: 1,
    pendingUpgrades: 0,
    currentSectorIndex: 0,
    sectorsCleared: 0,
    runTime: 0,
    score: 0,
    kills: 0,
    particleCap: 220,
    zapCap: 28,
    particles: [],
    zaps: [],
    enemyDeaths: [],
    enemies: [],
    projectiles: [],
    pickups: [],
    input: { cancelMovement() {} },
    sounds: { play() {} },
    isQaRun: true,
    runFinished: false,
    best: 0,
  });
  game.player = new Player(game);
  game.upgrades = new UpgradeSystem(game);
  game.runStats = new RunStats();
  game.runStats.start(game);
  return game;
}

function testQueuedLevelUps() {
  const game = createGame();
  game.gainXp(22);
  assert.equal(game.level, 3, "the XP batch earns two levels");
  assert.equal(game.pendingUpgrades, 2, "both choices remain pending");
  assert.equal(game.state, "levelUp", "first choice is shown");
  game.upgrades.pick(0);
  assert.equal(game.pendingUpgrades, 1, "first choice does not discard the second");
  assert.equal(game.state, "levelUp", "second choice is shown immediately");
  game.upgrades.pick(0);
  assert.equal(game.pendingUpgrades, 0, "all earned choices are resolved");
  assert.equal(game.state, "playing", "play resumes after the final choice");
}

function testPausedCombatClock() {
  const game = createGame();
  const enemy = new Enemy(game, "frigate", 80, 160);
  enemy._queueWeaponShot(0, { delay: 0.72, skipWeaponAnimation: true });
  game.state = "paused";
  game.time += 8;
  enemy._releaseQueuedShots();
  assert.equal(game.projectiles.length, 0, "wall-clock time cannot release a queued shot");
  game.state = "playing";
  game.simTime = 0.73;
  enemy._releaseQueuedShots();
  assert.equal(game.projectiles.length, 1, "the shot releases only after active combat time elapses");
}

function testArenaCleanup() {
  const game = createGame();
  const enemy = new Enemy(game, "frigate", 80, 160);
  enemy.pendingShots.push({ at: 1, angle: 0, options: {} });
  const projectile = { dead: false };
  game.enemies.push(enemy);
  game.projectiles.push(projectile);
  game.pickups.push({ value: 1, dead: false });
  game.particles.push({});
  game.zaps.push({});
  game.enemyDeaths.push({});
  game.clearArena();
  assert.equal(enemy.dead, true, "old enemy cannot update after transition");
  assert.deepEqual(enemy.pendingShots, [], "old enemy cannot release a delayed shot");
  assert.equal(projectile.dead, true, "old projectile is invalidated");
  assert.deepEqual([game.enemies, game.projectiles, game.pickups, game.particles, game.zaps, game.enemyDeaths].map(items => items.length), [0, 0, 0, 0, 0, 0]);
}

function testTextWrapping() {
  const context = { measureText: value => ({ width: value.length * 7 }) };
  const source = "Hull hits trigger 1.8s invulnerability. 18s cooldown.";
  const lines = wrapText(context, source, 150);
  assert.equal(lines.join(" "), source, "wrapping preserves word order");
}

function testKeystoneMeasurement() {
  const game = createGame();
  game.isQaRun = false;
  const stats = new RunStats();
  stats.start(game);
  const keystone = { id: "reactor", keystone: true };
  stats.offer(game, [keystone], [keystone]);
  game.runTime = 42;
  stats.pick(game, keystone);
  game.runTime = 59;
  game.player.keystoneId = "reactor";
  const summary = stats.complete(game, "defeat", { kind: "projectile" });
  assert.equal(summary.keystoneName, "Pulse Reactor");
  assert.equal(summary.timeAfterKeystone, 17);
  assert.equal(summary.keystoneOfferCount, 1);
}

function testAegis() {
  const game = createGame();
  Object.assign(game.player, { emergencyAegis: true, keystoneId: "aegis", shield: 0, shieldLevel: 2 });
  const hp = game.player.hp;
  game.player.damage(30);
  assert.equal(game.player.hp, hp, "Aegis blocks the triggering hull hit");
  assert.equal(game.player.invuln, 1.8);
  assert.equal(game.player.aegisCooldown, 18);
  game.player.damage(30);
  assert.equal(game.player.hp, hp, "Aegis blocks follow-up hits during protection");
  game.player.invuln = 0;
  game.player.damage(30);
  assert.equal(game.player.hp, hp - 30, "Aegis does not retrigger during cooldown");
  const preview = game.upgrades._previewPlayer(game.upgrades.pool.find(u => u.id === "aegis"), true);
  assert.equal(preview.invuln, 0, "Installation preview keeps the normal shield visible");
  assert.equal(preview.shieldLevel, 2, "Aegis preserves the installed shield module");
}

function testUpgradeCameraShake() {
  const game = createGame();
  const translations = [];
  Object.assign(game, {
    shake: 4,
    renderDpr: 1, viewportW: 420, viewportH: 760,
    scale: 1, offsetX: 0, offsetY: 0,
    ctx: {
      save() {}, restore() {}, setTransform() {}, clearRect() {}, fillRect() {}, scale() {},
      translate(x, y) { translations.push([x, y]); },
    },
    drawBackground() {}, drawWorld() {}, drawFullscreenButton() {}, drawMuteButton() {},
    drawPaused() {}, drawHud() {}, drawPauseButton() {},
  });
  game.input.consumeTap = () => null;
  game.upgrades.draw = () => {};
  game.gainXp(22);
  assert.equal(game.state, "levelUp");
  // Render immediately on entering the modal, before shake has time to decay.
  game.draw();
  for (let i = 0; i < 120; i++) { game.update(1 / 60); game.draw(); }
  assert.ok(translations.every(([x, y]) => x === 0 && y === 0), "Upgrade screen never inherits camera jitter");
  assert.equal(game.shake, 0, "Residual camera shake settles during the modal");
  assert.equal(game.simTime, 0, "Visual settling does not spend combat time");
  game.upgrades.pick(0);
  game.draw();
  assert.equal(game.state, "levelUp", "Second queued choice remains a stable modal");
  game.upgrades.pick(0);
  assert.equal(game.state, "playing");
  assert.equal(game.shake, 0, "Resume does not restore stale shake");
  translations.length = 0;
  game.shake = 4;
  game.draw();
  assert.ok(translations.some(([x, y]) => x !== 0 || y !== 0), "Fresh combat camera shake still works");
  translations.length = 0;
  game.state = "paused";
  game.draw();
  assert.ok(translations.every(([x, y]) => x === 0 && y === 0), "Pause screen also stays still");
}

function testSectorOnePacing() {
  const game = createGame();
  game._assetGroupsReady = () => true;
  game._preloadNextSectorAssets = () => {};
  game.startRun();
  let elapsed = 0;
  const events = [];
  game.spawnEnemy = (type, boss) => events.push({ time: elapsed, kind: boss ? "boss" : "solo" });
  game.spawnFormation = () => events.push({ time: elapsed, kind: "formation" });
  const random = Math.random;
  try {
    // Always request formations when allowed, to exercise the exact gate.
    Math.random = () => 0;
    for (let frame = 1; frame <= 7010; frame++) {
      elapsed = frame / 100;
      game.updateSpawning(0.01);
    }
    assert.ok(Math.abs(events[0].time - 1.2) < 0.02, "First enemy arrives after 1.2s");
    const early = events.filter(event => event.time < 10);
    assert.ok(early.length >= 6 && early.length <= 8, "Opening ten seconds retain regular XP opportunities");
    for (let i = 1; i < early.length; i++) {
      assert.ok(Math.abs(early[i].time - early[i - 1].time - 1.25) < 0.02, "Opening spawn interval is 1.25s");
    }
    const regular = events.filter(event => event.time > 12 && event.time < 21);
    assert.ok(regular.length >= 8, "Normal cadence resumes after the opening");
    const firstFormation = events.find(event => event.kind === "formation");
    assert.ok(firstFormation.time >= 22 && firstFormation.time < 24, "Formations start after 22s");
    const bosses = events.filter(event => event.kind === "boss");
    assert.equal(bosses.length, 1);
    assert.ok(Math.abs(bosses[0].time - 70) < 0.02, "Boss arrives after 70 active seconds");
    assert.deepEqual(SECTORS.slice(1).map(sector => sector.duration), [90, 105, 115]);
    game.currentSectorIndex = 1;
    game.sectorTimer = SECTORS[1].duration;
    game.spawnTimer = 0;
    game.bossActive = false;
    game.bossWarning = 0;
    game.updateSpawning(0.01);
    assert.equal(events.at(-1).kind, "formation", "Later sectors keep their existing formation rules");
  } finally {
    Math.random = random;
  }
}

testQueuedLevelUps();
testPausedCombatClock();
testArenaCleanup();
testTextWrapping();
testKeystoneMeasurement();
testAegis();
testUpgradeCameraShake();
testSectorOnePacing();
console.log("Reliability checks passed");
