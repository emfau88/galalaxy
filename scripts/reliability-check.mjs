import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { Player } from "../src/entities/player.js";
import { Enemy } from "../src/entities/enemy.js";
import { UpgradeSystem } from "../src/systems/upgrades.js";
import { RunStats } from "../src/runStats.js";
import { wrapText } from "../src/rendering/text.js";

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

testQueuedLevelUps();
testPausedCombatClock();
testArenaCleanup();
testTextWrapping();
testKeystoneMeasurement();
testAegis();
console.log("Reliability checks passed");
