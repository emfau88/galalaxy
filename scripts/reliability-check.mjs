import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { Player } from "../src/entities/player.js";
import { Enemy } from "../src/entities/enemy.js";
import { COMBAT_PICKUP_DROP_CONFIG, CombatPickup } from "../src/entities/pickup.js";
import { UpgradeSystem } from "../src/systems/upgrades.js";
import { RunStats } from "../src/runStats.js";
import { wrapText } from "../src/rendering/text.js";
import { SECTOR_ENVIRONMENTS, SECTORS } from "../src/config.js";
import { SECTOR_ENCOUNTER_PROFILES, WAVE_CARDS } from "../src/data/encounters.js";
import { BOSS_PROFILES } from "../src/data/bosses.js";
import { FLEETS } from "../src/data/fleets.js";
import { KONGREGATE_STATS, isKongregateHost, kongregateStatsForRun } from "../src/kongregate.js";

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
    nextCombatPickupAt: 0,
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
  const trackedEnemy = new Enemy(game, "fighter", 120, 180);
  stats.enemySpawn(game, trackedEnemy, "pursuit-pressure");
  stats.enemyKill(game, trackedEnemy);
  stats.enemyEscape(game, new Enemy(game, "scout", 0, 0));
  stats.combatTick(game, 1.5);
  game.runTime = 10;
  const trackedBoss = new Enemy(game, "dreadnought", 210, 140, true);
  stats.enemySpawn(game, trackedBoss, "boss");
  game.runTime = 19.4;
  stats.enemyKill(game, trackedBoss);
  const keystone = { id: "reactor", keystone: true };
  game.runTime = 22;
  stats.offer(game, [keystone], [keystone]);
  assert.equal(stats.current.firstDraftAt, 22, "The first upgrade draft time is recorded for pacing review");
  game.runTime = 42;
  stats.pick(game, keystone);
  game.runTime = 59;
  game.player.keystoneId = "reactor";
  const summary = stats.complete(game, "defeat", { kind: "projectile" });
  assert.equal(summary.keystoneName, "Pulse Reactor");
  assert.equal(summary.timeAfterKeystone, 17);
  assert.equal(summary.keystoneOfferCount, 1);
  assert.equal(summary.regularEnemiesSpawned, 1);
  assert.equal(summary.pursuitEnemiesSpawned, 1);
  assert.equal(summary.regularEnemiesKilled, 1);
  assert.equal(summary.enemiesEscaped, 1);
  assert.equal(summary.regularKillScore, trackedEnemy.score);
  assert.equal(summary.bossKillScore, trackedBoss.score);
  assert.deepEqual(summary.sectorStats[0], {
    sector: 1,
    name: SECTORS[0].name,
    combatSeconds: 1.5,
    timeScore: 3.6,
    regularEnemiesSpawned: 1,
    pursuitEnemiesSpawned: 1,
    regularEnemiesKilled: 1,
    enemiesEscaped: 1,
    regularKillScore: trackedEnemy.score,
    bossKillScore: trackedBoss.score,
    bossStartedAt: 10,
    bossFightSeconds: 9.4,
    score: Math.floor(3.6 + trackedEnemy.score + trackedBoss.score),
  });
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

function testPlayerStartsReady() {
  const game = createGame();
  assert.equal(game.player.shield, game.player.maxShield, "A new run starts with a full shield");
  assert.equal(game.player.hudShieldTrail, game.player.maxShield, "The HUD trail starts synchronized");
}

function testSurvivalFeedback() {
  const game = createGame();
  const played = [];
  game.shake = 0;
  game.sounds.play = name => played.push(name);
  game.player.shield = 2;

  game.player.damage(1);
  assert.equal(game.player.shield, 1, "Shield damage is absorbed before hull damage");
  game.player.invuln = 0;
  game.player.damage(1);
  assert.equal(game.player.shield, 0, "The second hit breaks the remaining shield");
  assert.ok(game.player.shieldBreakFlash > 0, "A shield break starts the HUD alert");
  game.player.invuln = 0;
  game.player.damage(1);
  assert.equal(game.player.hp, game.player.maxHp - 1, "Unshielded damage reaches the hull");
  assert.deepEqual(played, ["shield", "shieldBreak", "hit"], "Each survival state has distinct audio feedback");
}

function testCombatPickups() {
  const game = createGame();
  game.isQaRun = false;
  const played = [];
  game.sounds.play = name => played.push(name);
  game.simTime = 30;
  game.player.hp = 40;
  game.player.shield = game.player.maxShield;

  const random = Math.random;
  try {
    Math.random = () => 0;
    const pickup = game.maybeDropCombatPickup({ x: 120, y: 180, score: 100 });
    assert.equal(pickup.kind, "repair", "Low hull prioritizes the repair pickup");
    assert.equal(game.nextCombatPickupAt, game.simTime + COMBAT_PICKUP_DROP_CONFIG.cooldownSeconds,
      "A successful utility drop starts the configured cooldown");
    pickup.x = game.player.x;
    pickup.y = game.player.y;
    pickup.update(0.01, game);
    assert.equal(game.player.hp, 58, "Repair restores 18 hull");
    assert.equal(pickup.dead, true);
    assert.equal(game.runStats.current.combatPickupsCollected, 1, "Normal runs record collected combat pickups");
    assert.equal(game.runStats.current.pickupHullRestored, 18, "Normal runs record effective repair value");

    const overdrive = new CombatPickup(game.player.x, game.player.y, "overdrive");
    overdrive.apply(game);
    assert.equal(game.player.overdriveTimer, 7, "Overdrive lasts seven active seconds");
    assert.ok(Math.abs(game.player.getCombatFireRateMultiplier() - 0.72) < 0.001,
      "Overdrive accelerates the complete auto-fire cycle");
    assert.deepEqual(played, ["pickup", "pickup"], "Utility pickups share one restrained audio cue");

    game.simTime = 45;
    assert.equal(game.maybeDropCombatPickup({ x: 0, y: 0, score: 500 }), null,
      "The utility-drop cooldown prevents pickup clutter");

    game.simTime = 100;
    game.nextCombatPickupAt = 0;
    game.pickups.push(new CombatPickup(10, 10, "shield"));
    assert.equal(game.maybeDropCombatPickup({ x: 0, y: 0, score: 500 }), null,
      "Only one live combat pickup may exist at once");
  } finally {
    Math.random = random;
  }
}

function testSectorScoreScaling() {
  const game = createGame();
  game.currentSectorIndex = 3;
  const enemy = new Enemy(game, "nairanBattlecruiser", 210, 160);
  assert.equal(enemy.baseScore, 240, "Enemy retains its progression and drop basis");
  assert.equal(enemy.score, 420, "Sector-IV execution earns the authored 1.75x score reward");

  let droppedXp = 0;
  game.dropXp = (_x, _y, value) => { droppedXp = value; };
  game.maybeDropCombatPickup = () => null;
  game.spawnEnemyDestruction = () => {};
  game.explosion = () => {};
  game.deathBurst = () => {};
  game.burst = () => {};
  enemy.kill();
  assert.equal(droppedXp, 4,
    "Sector score scaling does not accelerate XP progression");
}

function testOptInKeyboardMovement() {
  const game = createGame();
  const player = game.player;
  player.fireTimer = Number.MAX_VALUE;
  player.x = 210;
  player.y = 420;
  let vector = { x: 1, y: 0, active: true };
  Object.assign(game.input, {
    active: true,
    shipX: 80,
    shipY: 420,
    movementVector: () => vector,
  });

  player.update(0.1);
  const keyboardX = player.x;
  assert.ok(keyboardX > 210, "Opt-in keyboard movement takes priority while a key is held");

  vector = { x: 0, y: 0, active: false };
  player.update(0.1);
  assert.ok(player.x < keyboardX, "Pointer steering resumes after keyboard movement is released");

  game.input.active = false;
  player.x = 210;
  player.y = 420;
  vector = { x: 1, y: 0, active: true };
  player.update(0.1);
  const cardinalDistance = Math.hypot(player.x - 210, player.y - 420);

  player.x = 210;
  player.y = 420;
  const diagonal = 1 / Math.sqrt(2);
  vector = { x: diagonal, y: -diagonal, active: true };
  player.update(0.1);
  const diagonalDistance = Math.hypot(player.x - 210, player.y - 420);
  assert.ok(Math.abs(cardinalDistance - diagonalDistance) < 0.001,
    "Diagonal keyboard movement uses the same top speed as cardinal movement");
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

function simulateEncounterSector(sectorIndex, seconds = 48, randomSource = () => 0.25) {
  const game = createGame();
  game.currentSectorIndex = sectorIndex;
  game.sectorTimer = SECTORS[sectorIndex].duration;
  game.bossActive = false;
  game.bossWarning = 0;
  game.encounterDirector = null;
  let elapsed = 0;
  const events = [];
  const phases = [];
  game.runStats = {
    encounterStart(_game, card, profile) {
      phases.push({ phase: "active", at: elapsed, duration: card.duration, wave: card.id, profile: profile.id });
    },
    encounterRecovery(_game, duration) {
      phases.push({ phase: "recovery", at: elapsed, duration });
    },
  };
  game.spawnEnemy = (type, boss, _speedMult, flyby, options = {}) => {
    events.push({ time: elapsed, type, boss, flyby, options });
    return { type, dead: false };
  };
  const random = Math.random;
  try {
    Math.random = randomSource;
    const step = 0.05;
    for (let frame = 1; frame <= seconds / step; frame++) {
      elapsed = frame * step;
      game.simTime = elapsed;
      game.runTime = elapsed;
      game.updateSpawning(step);
    }
  } finally {
    Math.random = random;
  }
  return { events, phases };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function modeledFullClearScore(randomSource) {
  let score = Math.floor(SECTORS.reduce((sum, sector) => sum + sector.duration, 0) * 2.4);
  for (let sectorIndex = 0; sectorIndex < SECTORS.length; sectorIndex++) {
    const sector = SECTORS[sectorIndex];
    const simulation = simulateEncounterSector(sectorIndex, sector.duration, randomSource);
    score += simulation.events.reduce((total, event) =>
      total + Math.round(Enemy.defs[event.type].score * sector.scoreMult), 0);
    const bossType = sector.bossType || FLEETS[sector.fleet].bossType;
    score += Enemy.defs[bossType].score * 8;
  }
  return score;
}

function percentile(sortedValues, fraction) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * fraction) - 1));
  return sortedValues[index];
}

function modelScoreDistribution(sampleCount = 500) {
  const scores = Array.from({ length: sampleCount }, (_, index) =>
    modeledFullClearScore(seededRandom(index + 1))).sort((a, b) => a - b);
  const distribution = {
    samples: scores.length,
    min: scores[0],
    p10: percentile(scores, 0.10),
    median: percentile(scores, 0.50),
    p90: percentile(scores, 0.90),
    max: scores.at(-1),
  };
  assert.equal(distribution.samples, sampleCount, "Score telemetry covers every requested seed");
  assert.ok(distribution.min < distribution.median && distribution.median < distribution.max,
    "Seeded score telemetry captures genuine encounter-role variance");
  assert.ok(distribution.p10 <= distribution.median && distribution.median <= distribution.p90,
    "Score percentiles remain ordered");
  return distribution;
}

function testEncounterDirector() {
  const cards = Object.values(WAVE_CARDS);
  assert.ok(cards.length >= 5, "At least five authored wave cards exist");
  assert.ok(cards.every(card => card.duration >= 8 && card.duration <= 12),
    "Every encounter danger window lasts 8-12 seconds");
  assert.ok(cards.every(card => card.safeCorridor), "Every wave card reserves an escape corridor");
  assert.ok(SECTOR_ENCOUNTER_PROFILES.every(profile =>
    profile.recovery[0] >= 3 && profile.recovery[1] <= 5),
  "Every sector recovery range stays within 3-5 seconds");

  const cardUse = new Map();
  for (const profile of SECTOR_ENCOUNTER_PROFILES) {
    const deck = new Set([...profile.earlyDeck, ...profile.midDeck, ...profile.lateDeck]);
    for (const id of deck) {
      cardUse.set(id, (cardUse.get(id) || 0) + 1);
      const authoredCount = WAVE_CARDS[id].events.reduce((sum, event) => sum + event.count, 0);
      assert.ok(authoredCount <= profile.enemyCap, `${id} respects the ${profile.id} enemy budget`);
    }
  }
  assert.ok([...cardUse.values()].filter(count => count >= 2).length >= 5,
    "At least five wave cards are reused across sector decks");
  assert.equal(new Set(SECTOR_ENCOUNTER_PROFILES.map(profile => profile.identity)).size, 4,
    "Every sector has a distinct gameplay identity");

  const eliteCards = [WAVE_CARDS["torpedo-lock"], WAVE_CARDS["support-screen"]];
  assert.ok(eliteCards.every(card => card.elite && card.suppressPressure),
    "Torpedo and support cards reserve isolated elite-combat windows");
  assert.ok(eliteCards.every(card => card.entryCap === 2 && card.enemyCap === 4),
    "Elite encounters wait for a clear arena and stay inside a four-enemy budget");
  assert.equal(WAVE_CARDS["support-screen"].events
    .filter(event => event.role === "heavy")
    .reduce((sum, event) => sum + event.count, 0), 1,
  "The support encounter contains only one heavy protected target");

  const frontier = simulateEncounterSector(0, 45);
  assert.ok(Math.abs(frontier.events[0].time - 1.2) < 0.06, "Sector I begins after a 1.2s orientation beat");
  const teachingWindow = frontier.events.filter(event => event.time < 15);
  assert.ok(teachingWindow.every(event => event.type === "scout" || event.type === "fighter"),
    "Sector I teaches with light ships only");
  assert.ok(teachingWindow.every(event => event.options.fireLockedUntil >= 14.99),
    "Sector-I teaching ships cannot fire before 15s");
  assert.ok(frontier.phases.filter(phase => phase.phase === "active" && phase.at < 25)
    .every(phase => phase.wave === "single-file"),
  "Dense formations remain locked until 25s");
  assert.ok(frontier.events[7].time >= 12 && frontier.events[7].time <= 14,
    "The restored pursuit stream brings the eighth XP target in before 14s");

  const nairan = simulateEncounterSector(1);
  const lateralDirections = new Set(nairan.events
    .filter(event => event.flyby?.vx)
    .map(event => Math.sign(event.flyby.vx)));
  assert.deepEqual([...lateralDirections].sort(), [-1, 1], "Sector II attacks quickly from both sides");

  const nautolan = simulateEncounterSector(2);
  assert.ok(nautolan.events.some(event => /Bomber|Frigate|Battlecruiser/.test(event.type)),
    "Sector III centers robust space-control roles");
  assert.ok(nautolan.phases.some(phase => phase.wave === "anchor-corridor"),
    "Sector III opens with a readable anchor corridor");

  const finale = simulateEncounterSector(3);
  assert.ok(finale.phases.some(phase => phase.wave === "finale-relay"),
    "Sector IV uses a dedicated learned-role combination card");
  for (const simulation of [frontier, nairan, nautolan, finale]) {
    assert.ok(simulation.phases.filter(phase => phase.phase === "recovery")
      .every(phase => phase.duration >= 3 && phase.duration <= 5),
    "Simulated recovery windows remain in the authored range");
  }

  const historicalModeledCounts = [79.8, 143.1, 188.0, 221.9];
  const recoveryBands = [[0.80, 0.90], [0.80, 0.90], [0.65, 0.75], [0.70, 0.80]];
  const fullSectors = SECTORS.map((sector, sectorIndex) =>
    simulateEncounterSector(sectorIndex, sector.duration));
  let modeledRunScore = Math.floor(SECTORS.reduce((sum, sector) => sum + sector.duration, 0) * 2.4);
  for (let sectorIndex = 0; sectorIndex < fullSectors.length; sectorIndex++) {
    const simulation = fullSectors[sectorIndex];
    const sector = SECTORS[sectorIndex];
    const recoveryRatio = simulation.events.length / historicalModeledCounts[sectorIndex];
    const [minimumRecovery, maximumRecovery] = recoveryBands[sectorIndex];
    assert.ok(recoveryRatio >= minimumRecovery && recoveryRatio <= maximumRecovery,
      `Sector ${sectorIndex + 1} stays inside its post-playtest density band`);
    const pursuers = simulation.events.filter(event =>
      event.options.encounterId === "pursuit-pressure");
    assert.ok(pursuers.length / simulation.events.length >= 0.20 &&
      pursuers.length / simulation.events.length <= 0.45,
    `Sector ${sectorIndex + 1} keeps pursuit pressure present but subordinate`);
    assert.ok(pursuers.every(event => event.flyby === null),
      "Pressure enemies use active player pursuit rather than flyby movement");
    assert.ok(pursuers.every(event => event.options.y <= 238),
      "Active pursuers never spawn behind the player");
    if (sectorIndex >= 2) {
      const lanePressure = simulation.events.filter(event =>
        event.options.encounterId === "lane-pressure");
      assert.ok(lanePressure.length > pursuers.length * 2,
        `Sector ${sectorIndex + 1} favors readable lanes over pursuit swarms`);
      assert.ok(pursuers.every(event => !/Battlecruiser/.test(event.type)),
        `Sector ${sectorIndex + 1} keeps heavy homing ships out of the pursuit stream`);
    }

    modeledRunScore += simulation.events.reduce((score, event) =>
      score + Math.round(Enemy.defs[event.type].score * sector.scoreMult), 0);
    const bossType = sector.bossType || FLEETS[sector.fleet].bossType;
    modeledRunScore += Enemy.defs[bossType].score * 8;
  }
  assert.ok(modeledRunScore >= 58000 && modeledRunScore <= 63000,
    `The legacy low-value calibration seed remains reproducible (${modeledRunScore})`);

  const queuedGame = createGame();
  queuedGame.currentSectorIndex = 0;
  queuedGame.encounterDirector = {
    pendingEvents: [{
      event: { at: 0, role: "light", count: 2, entry: "top-center" },
      card: WAVE_CARDS["single-file"],
      remaining: 2,
    }],
  };
  queuedGame.enemies = Array.from({ length: 8 }, () => ({ dead: false, type: "scout" }));
  queuedGame._drainPendingEncounterEvents(SECTOR_ENCOUNTER_PROFILES[0], SECTORS[0], 0.5);
  assert.equal(queuedGame.encounterDirector.pendingEvents[0].remaining, 2,
    "An authored event remains queued while the arena is full");
  queuedGame.enemies[0].dead = true;
  queuedGame.enemies[1].dead = true;
  queuedGame._drainPendingEncounterEvents(SECTOR_ENCOUNTER_PROFILES[0], SECTORS[0], 0.5);
  assert.equal(queuedGame.encounterDirector.pendingEvents.length, 0,
    "The complete authored event spawns when capacity returns");

  const eliteGame = createGame();
  eliteGame.currentSectorIndex = 1;
  eliteGame.sectorTimer = SECTORS[1].duration * 0.5;
  eliteGame.encounterDirector = {
    sectorIndex: 1,
    phase: "elite-prep",
    waveId: "torpedo-lock",
    lastWaveId: null,
    timer: 0,
    phaseDuration: 0,
    waveElapsed: 0,
    eventIndex: 0,
    waveCount: 0,
    pressureCount: 0,
    pressureTimer: 0,
    pendingEvents: [],
  };
  eliteGame.enemies = Array.from({ length: 5 }, () => ({ dead: false, type: "nairanFighter" }));
  eliteGame.updateSpawning(0.1);
  assert.equal(eliteGame.enemies.length, 5,
    "Elite preparation neither adds a wave nor background pressure to a crowded arena");
  assert.equal(eliteGame.encounterDirector.phase, "elite-prep",
    "The elite encounter waits until the arena has visibly thinned out");
  eliteGame.enemies.slice(0, 3).forEach(enemy => { enemy.dead = true; });
  eliteGame.updateSpawning(0.1);
  assert.equal(eliteGame.encounterDirector.phase, "active",
    "The elite encounter begins as soon as only two prior enemies remain");
  assert.equal(eliteGame.enemies.filter(enemy => !enemy.dead).length, 3,
    "The torpedo introduction starts as a compact three-threat moment");
  return {
    legacySeedScore: modeledRunScore,
    scoreDistribution: modelScoreDistribution(500),
  };
}

function testEncounterProjectileBudget() {
  const game = createGame();
  game.bossActive = false;
  game.encounterDirector = { projectileCap: 2 };
  assert.ok(game.spawnProjectile(0, 0, 0, 100, 1, "enemy", "enemy"));
  assert.ok(game.spawnProjectile(0, 0, 0, 100, 1, "enemy", "enemy"));
  assert.equal(game.spawnProjectile(0, 0, 0, 100, 1, "enemy", "enemy"), null,
    "Encounter projectile budget blocks excess hostile fire");
  assert.ok(game.spawnProjectile(0, 0, 0, 100, 1, "player", "laser"),
    "Hostile projectile budget never suppresses player fire");
}

function testPursuitDisengage() {
  const game = createGame();
  game.currentSectorIndex = 2;
  const enemy = game.spawnEnemy("nautolanFighter", false, 1, null, {
    x: 90,
    y: game.player.y + 60,
    encounterId: "pursuit-pressure",
  });
  enemy.fireTimer = Number.MAX_VALUE;
  enemy.update(0.01);
  assert.equal(enemy.encounterId, "pursuit-exit",
    "A hunter disengages after crossing behind the player");
  assert.ok(enemy.flyby?.vy > 0,
    "A disengaged hunter exits forward instead of homing back toward the player");
}

function testNairanPrecisionTelegraph() {
  const game = createGame();
  game.player.x = 210;
  game.player.y = 620;
  const enemy = new Enemy(game, "nairanFrigate", 100, 160);
  enemy.fireTimer = 0;
  enemy.update(0.01);
  assert.equal(enemy.specialCharge?.kind, "precision", "Nairan shooter exposes a precision target lock");
  assert.equal(enemy.specialCharge?.targetX, 210, "Precision lock commits to the marked X position");
  assert.equal(enemy.specialCharge?.targetY, 620, "Precision lock commits to the marked Y position");
  assert.equal(enemy.pendingShots.length, 1, "Precision shot waits for its visible warning");
}

function testNairanTorpedoRole() {
  const spawnGame = createGame();
  spawnGame.currentSectorIndex = 1;
  spawnGame.encounterDirector = { waveCount: 1 };
  spawnGame._spawnEncounterEvent(
    { at: 0, role: "torpedo", count: 3, entry: "top-center" },
    WAVE_CARDS["torpedo-lock"], SECTOR_ENCOUNTER_PROFILES[1], SECTORS[1], 0.5,
  );
  assert.equal(spawnGame.enemies.filter(enemy => enemy.type === "nairanTorpedoShip").length, 1,
    "The torpedo introduction permits only one torpedo ship at a time");
  const stagedTorpedo = spawnGame.enemies.find(enemy => enemy.type === "nairanTorpedoShip");
  assert.equal(stagedTorpedo.maxHp, 158, "The elite torpedo ship has enough hull to anchor its encounter");
  assert.equal(stagedTorpedo.maxShield, 44, "The elite torpedo ship has a visible defensive layer");

  const game = createGame();
  game.player.x = 210;
  game.player.y = 620;
  const torpedo = new Enemy(game, "nairanTorpedoShip", 210, -40);
  torpedo.fireTimer = 0;
  game.enemies = [torpedo];
  torpedo.update(0.01);
  assert.equal(torpedo.specialCharge, null, "Torpedo ships cannot attack from outside the visible arena");

  torpedo.x = 210;
  torpedo.y = 170;
  torpedo.fireTimer = 0;
  torpedo.update(0.01);
  assert.equal(torpedo.specialCharge?.kind, "torpedo-lock", "Torpedo attack exposes a dedicated corridor lock");
  assert.equal(torpedo.pendingShots.length, 1, "The torpedo waits behind its warning delay");
  const fixedAngle = torpedo.pendingShots[0].angle;
  game.player.x = 70;
  game.simTime = torpedo.pendingShots[0].at + 0.01;
  torpedo.update(0);
  assert.equal(game.projectiles.length, 1, "The warned torpedo is released after the delay");
  assert.ok(Math.abs(Math.atan2(game.projectiles[0].vy, game.projectiles[0].vx) - fixedAngle) < 0.001,
    "The torpedo keeps the direction fixed before the player sidesteps");
}

function testNautolanSupportRole() {
  const game = createGame();
  const support = new Enemy(game, "nautolanSupport", 210, 180);
  const targets = [
    new Enemy(game, "nautolanFrigate", 150, 220),
    new Enemy(game, "nautolanBomber", 250, 225),
    new Enemy(game, "nautolanFighter", 300, 235),
  ];
  game.enemies = [support, ...targets];
  assert.equal(support.maxHp, 84, "The elite support ship survives long enough to establish its link");
  support._refreshSupportTargets();
  assert.equal(support.supportTargets.length, 1, "A support ship protects exactly one nearby ally");
  assert.ok(support.supportTargets.every(target => target.supportSource === support),
    "Every protected target points to its visible support source");
  const protectedTarget = support.supportTargets[0];
  assert.equal(protectedTarget.type, "nautolanFrigate", "Support prioritizes the most robust nearby ally");
  protectedTarget.damage(20);
  assert.equal(protectedTarget.hp, protectedTarget.maxHp - 11, "Support protection reduces incoming damage by 45%");
  support.dead = true;
  protectedTarget.damage(20);
  assert.equal(protectedTarget.hp, protectedTarget.maxHp - 31, "Protection ends immediately when support is destroyed");
  assert.ok(support.maxHp < targets[0].maxHp, "Support remains more vulnerable than the heavy ship it protects");
}

function testDistinctBossProfiles() {
  assert.deepEqual(SECTORS.map(sector => sector.bossType || FLEETS[sector.fleet].bossType), [
    "dreadnought", "nairanDreadnought", "nautolanDreadnought", "voidSovereign",
  ], "Every sector resolves to a dedicated boss type");
  assert.equal(new Set(Object.values(BOSS_PROFILES).map(profile => profile.name)).size, 4,
    "Every boss exposes a distinct name");

  const klaedGame = createGame();
  const klaed = new Enemy(klaedGame, "dreadnought", 210, 175, true);
  klaedGame.enemies = [klaed];
  klaed._klaedPattern = 2;
  klaed.fireTimer = 0;
  klaed.update(0.01);
  assert.equal(klaed.specialCharge?.kind, "torpedo", "Kla'ed boss retains its torpedo phase");
  klaed.pendingShots = [];
  klaed.specialCharge = null;
  klaed._klaedPattern = 3;
  klaed.fireTimer = 0;
  klaed.update(0.01);
  assert.equal(klaed.specialCharge?.kind, "wave", "Kla'ed boss retains its wave gate");
  assert.equal(klaed.specialCharge.activeLanes.length, 3, "Kla'ed wave gate preserves a broad escape corridor");

  const nairanGame = createGame();
  nairanGame.currentSectorIndex = 1;
  const nairan = new Enemy(nairanGame, "nairanDreadnought", 210, 170, true);
  nairanGame.enemies = [nairan];
  nairan.fireTimer = 0;
  nairan.update(0.01);
  assert.equal(nairan.specialCharge?.kind, "boss-target-lock", "Nairan boss opens with a fixed target lock");
  assert.equal(nairan.pendingShots.length, 3, "Nairan precision salvo queues three committed shots");
  nairan.pendingShots = [];
  nairan.specialCharge = null;
  nairan.fireTimer = 0;
  nairan.update(0.01);
  assert.equal(nairan.specialCharge?.kind, "beam-sweep", "Nairan boss alternates into its precision sweep");

  const nautolanGame = createGame();
  nautolanGame.currentSectorIndex = 2;
  const nautolan = new Enemy(nautolanGame, "nautolanDreadnought", 210, 170, true);
  nautolanGame.enemies = [nautolan];
  nautolan.hp = nautolan.maxHp * 0.58;
  nautolan._syncBossPhase();
  const support = nautolanGame.enemies.find(enemy => enemy.type === "nautolanSupport");
  assert.equal(nautolan.bossPhase, 2, "Nautolan boss crosses its sixty-percent phase gate");
  assert.ok(support, "Nautolan control phase summons a support ship");
  support._refreshSupportTargets();
  assert.equal(support.supportTargets[0], nautolan, "The support phase visibly protects the boss");
  nautolan.specialCharge = null;
  nautolan.fireTimer = 0;
  nautolan.update(0.01);
  nautolan.pendingShots = [];
  nautolan.specialCharge = null;
  nautolan.fireTimer = 0;
  nautolan.update(0.01);
  assert.equal(nautolan.specialCharge?.kind, "control-gate", "Nautolan boss creates a space-control gate");
  assert.equal(nautolan.specialCharge.activeLanes.length, 4, "The control gate always leaves one safe corridor");

  const voidGame = createGame();
  voidGame.currentSectorIndex = 3;
  const sovereign = new Enemy(voidGame, "voidSovereign", 210, 160, true);
  voidGame.enemies = [sovereign];
  sovereign.fireTimer = 0;
  sovereign.update(0.01);
  assert.equal(sovereign.specialCharge?.kind, "void-lock", "Void Sovereign opens with a readable lock corridor");
  sovereign.pendingShots = [];
  sovereign.hp = sovereign.maxHp * 0.58;
  sovereign._syncBossPhase();
  assert.equal(sovereign.bossPhase, 2, "Void Sovereign enters phase two at sixty percent");
  sovereign.specialCharge = null;
  sovereign.fireTimer = 0;
  sovereign.update(0.01);
  assert.equal(sovereign.specialCharge?.kind, "void-rift", "Phase two combines the lock with space control");
  assert.equal(sovereign.specialCharge.activeLanes.length, 4, "Void rift preserves one safe lane");
  sovereign.hp = sovereign.maxHp * 0.28;
  sovereign._syncBossPhase();
  assert.equal(sovereign.bossPhase, 3, "Void Sovereign enters phase three at thirty percent");
  assert.deepEqual(sovereign.bossProfile.phaseThresholds, [0.6, 0.3]);
  assert.ok(sovereign.maxHp > nautolan.maxHp, "The final boss has an independent, higher durability profile");
}

function testKongregateStats() {
  assert.equal(isKongregateHost("https://www.kongregate.com/games/dev/galalaxy"), true);
  assert.equal(isKongregateHost("https://game12345.konggames.com/"), true);
  assert.equal(isKongregateHost("https://example.com/kongregate.com"), false);
  assert.deepEqual(KONGREGATE_STATS, {
    HighScore: "Max", SectorReached: "Max", MaxLevel: "Max",
    KeystoneInstalled: "Max", GameComplete: "Max",
  });
  assert.deepEqual(kongregateStatsForRun({
    score: 18420.9, sectorReached: 4, level: 11, keystone: "reactor", outcome: "victory",
  }), {
    HighScore: 18420, SectorReached: 4, MaxLevel: 11,
    KeystoneInstalled: 1, GameComplete: 1,
  });
}

function testSectorEnvironments() {
  assert.equal(SECTOR_ENVIRONMENTS.length, SECTORS.length, "Every sector has an environment profile");
  assert.equal(new Set(SECTOR_ENVIRONMENTS.map(environment => environment.id)).size, SECTORS.length,
    "Every sector has a distinct map identity");
  assert.equal(new Set(SECTOR_ENVIRONMENTS.map(environment => environment.landmark)).size, SECTORS.length,
    "Every sector has a distinct landmark asset");
  assert.ok(SECTOR_ENVIRONMENTS.every(environment => environment.asteroidCount <= 8),
    "Sector decoration stays within the existing sparse asteroid budget");
  assert.equal(SECTOR_ENVIRONMENTS[3].landmark, "environmentVoidCore");
  assert.ok(SECTOR_ENVIRONMENTS[3].landmarkAlpha <= 0.28,
    "The finale landmark remains subdued behind combat");
  assert.ok(SECTOR_ENVIRONMENTS[3].asteroidCount <= 4,
    "The finale keeps its central combat area visually quiet");
}

testQueuedLevelUps();
testPausedCombatClock();
testArenaCleanup();
testTextWrapping();
testKeystoneMeasurement();
testAegis();
testPlayerStartsReady();
testSurvivalFeedback();
testCombatPickups();
testSectorScoreScaling();
testOptInKeyboardMovement();
testUpgradeCameraShake();
const scoreModel = testEncounterDirector();
testEncounterProjectileBudget();
testPursuitDisengage();
testNairanPrecisionTelegraph();
testNairanTorpedoRole();
testNautolanSupportRole();
testDistinctBossProfiles();
testKongregateStats();
testSectorEnvironments();
console.log(`Reliability checks passed (legacy calibration seed: ${scoreModel.legacySeedScore}; ` +
  `500-seed distribution: ${JSON.stringify(scoreModel.scoreDistribution)})`);
