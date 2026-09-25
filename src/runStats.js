import { CONFIG, SECTORS } from "./config.js";
import { SaveSystem } from "./saveSystem.js";

const MAX_HISTORY = 24;

const KEYSTONE_NAMES = {
  overcharged: "Overcharged Core",
  siege: "Siege Payload",
  reactor: "Pulse Reactor",
  aegis: "Emergency Aegis",
};

const moduleEntries = player => [
  ["Multi Cannon", player.twin],
  ["Homing Rockets", player.rocketDisabled ? 0 : player.rocket],
  ["Zapper Chain", player.zapper],
  ["Big Space Gun", player.beam],
  ["Pulse Wave", player.pulse],
  ["Rocket Barrage", player.rocketDisabled ? 0 : player.barrage],
  ["Engine Boost", player.speedLevel],
  ["Shield Array", player.shieldLevel],
  ["Hull Upgrade", player.hpLevel],
  ["Pickup Magnet", player.magnet],
  ["Fire Rate", player.fireLevel],
];

const createSectorStats = () => SECTORS.map((sector, index) => ({
  sector: index + 1,
  name: sector.name,
  combatSeconds: 0,
  timeScore: 0,
  regularEnemiesSpawned: 0,
  pursuitEnemiesSpawned: 0,
  regularEnemiesKilled: 0,
  enemiesEscaped: 0,
  regularKillScore: 0,
  bossKillScore: 0,
  bossStartedAt: null,
  bossFightSeconds: null,
}));

export class RunStats {
  constructor() {
    const saved = SaveSystem.readJson(CONFIG.runHistoryKey, { history: [] });
    this.history = Array.isArray(saved.history) ? saved.history.slice(0, MAX_HISTORY) : [];
    this.current = null;
  }

  start(game) {
    this.current = {
      version: 4,
      offers: 0,
      picks: 0,
      firstDraftAt: null,
      eligibleOfferCount: 0,
      keystoneOfferCount: 0,
      firstEligibleOfferAt: null,
      firstKeystoneOfferAt: null,
      firstKeystonePickAt: null,
      offeredKeystones: [],
      pickedKeystone: null,
      sectorsCleared: 0,
      combatPickupsCollected: 0,
      combatPickupCounts: { repair: 0, shield: 0, overdrive: 0 },
      pickupHullRestored: 0,
      pickupShieldRestored: 0,
      pickupOverdriveSeconds: 0,
      encounterCount: 0,
      encounterTimeline: [],
      regularEnemiesSpawned: 0,
      pursuitEnemiesSpawned: 0,
      regularEnemiesKilled: 0,
      enemiesEscaped: 0,
      regularKillScore: 0,
      bossKillScore: 0,
      sectorStats: createSectorStats(),
    };
    this.current.sectorReached = Math.max(1, game.currentSectorIndex + 1);
  }

  offer(game, picked, candidates) {
    if (!this.current || game.isQaRun) return;
    const eligible = candidates.filter(upgrade => upgrade.keystone);
    const offered = picked.filter(upgrade => upgrade.keystone);
    this.current.offers++;
    this.current.firstDraftAt ??= game.runTime;
    if (eligible.length) {
      this.current.eligibleOfferCount++;
      this.current.firstEligibleOfferAt ??= game.runTime;
    }
    if (offered.length) {
      this.current.keystoneOfferCount++;
      this.current.firstKeystoneOfferAt ??= game.runTime;
      this.current.offeredKeystones.push(...offered.map(upgrade => upgrade.id));
    }
  }

  pick(game, upgrade) {
    if (!this.current || game.isQaRun) return;
    this.current.picks++;
    if (upgrade.keystone) {
      this.current.pickedKeystone = upgrade.id;
      this.current.firstKeystonePickAt ??= game.runTime;
    }
  }

  pickup(game, kind, appliedAmount) {
    if (!this.current || game.isQaRun) return;
    this.current.combatPickupsCollected++;
    if (Object.hasOwn(this.current.combatPickupCounts, kind)) {
      this.current.combatPickupCounts[kind]++;
    }
    if (kind === "repair") this.current.pickupHullRestored += appliedAmount;
    else if (kind === "shield") this.current.pickupShieldRestored += appliedAmount;
    else if (kind === "overdrive") this.current.pickupOverdriveSeconds += appliedAmount;
  }

  encounterStart(game, card, profile) {
    if (!this.current || game.isQaRun) return;
    this.current.encounterCount++;
    if (this.current.encounterTimeline.length >= 40) return;
    this.current.encounterTimeline.push({
      sector: game.currentSectorIndex + 1,
      wave: card.id,
      startedAt: Number(game.runTime.toFixed(1)),
      activeSeconds: card.duration,
      recoverySeconds: null,
      safeCorridor: card.safeCorridor,
      profile: profile.id,
    });
  }

  encounterRecovery(game, recoverySeconds) {
    if (!this.current || game.isQaRun || !this.current.encounterTimeline.length) return;
    const latest = this.current.encounterTimeline.at(-1);
    latest.recoverySeconds = Number(recoverySeconds.toFixed(1));
  }

  enemySpawn(game, enemy, source) {
    if (!this.current || game.isQaRun) return;
    const sector = this.current.sectorStats?.[game.currentSectorIndex];
    if (enemy.boss) {
      if (sector && sector.bossStartedAt === null) sector.bossStartedAt = game.runTime;
      return;
    }
    this.current.regularEnemiesSpawned++;
    if (source === "pursuit-pressure") this.current.pursuitEnemiesSpawned++;
    if (sector) {
      sector.regularEnemiesSpawned++;
      if (source === "pursuit-pressure") sector.pursuitEnemiesSpawned++;
    }
  }

  enemyKill(game, enemy) {
    if (!this.current || game.isQaRun) return;
    const sector = this.current.sectorStats?.[game.currentSectorIndex];
    if (enemy.boss) {
      this.current.bossKillScore += enemy.score;
      if (sector) {
        sector.bossKillScore += enemy.score;
        if (sector.bossStartedAt !== null) {
          sector.bossFightSeconds = Math.max(0, game.runTime - sector.bossStartedAt);
        }
      }
    } else {
      this.current.regularEnemiesKilled++;
      this.current.regularKillScore += enemy.score;
      if (sector) {
        sector.regularEnemiesKilled++;
        sector.regularKillScore += enemy.score;
      }
    }
  }

  enemyEscape(game, enemy) {
    if (!this.current || game.isQaRun || enemy.boss) return;
    this.current.enemiesEscaped++;
    const sector = this.current.sectorStats?.[game.currentSectorIndex];
    if (sector) sector.enemiesEscaped++;
  }

  combatTick(game, dt) {
    if (!this.current || game.isQaRun || !Number.isFinite(dt) || dt <= 0) return;
    const sector = this.current.sectorStats?.[game.currentSectorIndex];
    if (!sector) return;
    sector.combatSeconds += dt;
    sector.timeScore += dt * 2.4;
  }

  complete(game, outcome, cause = null) {
    const player = game.player;
    const current = this.current || {};
    const modules = moduleEntries(player)
      .filter(([, level]) => level > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([name, level]) => ({ name, level }));
    const sectorStats = (current.sectorStats || createSectorStats()).map(sector => ({
      ...sector,
      combatSeconds: Number((sector.combatSeconds || 0).toFixed(1)),
      timeScore: Number((sector.timeScore || 0).toFixed(1)),
      bossFightSeconds: sector.bossFightSeconds === null
        ? null
        : Number(sector.bossFightSeconds.toFixed(1)),
      score: Math.floor(
        (sector.timeScore || 0) +
        (sector.regularKillScore || 0) +
        (sector.bossKillScore || 0)
      ),
    }));
    const summary = {
      ...current,
      sectorStats,
      outcome,
      score: Math.floor(game.score),
      kills: game.kills,
      time: Math.floor(game.runTime),
      level: game.level,
      sectorReached: Math.max(1, game.currentSectorIndex + 1),
      sectorsCleared: Math.max(current.sectorsCleared || 0, game.sectorsCleared || 0),
      branch: player.shipBranch(),
      tier: player.shipTier(),
      modules,
      keystone: player.keystoneId,
      keystoneName: player.keystoneId ? KEYSTONE_NAMES[player.keystoneId] : null,
      timeAfterKeystone: current.firstKeystonePickAt === null || current.firstKeystonePickAt === undefined
        ? 0
        : Math.max(0, Math.floor(game.runTime - current.firstKeystonePickAt)),
      cause,
    };
    this.current = null;
    if (!game.isQaRun) {
      this.history.unshift(summary);
      this.history = this.history.slice(0, MAX_HISTORY);
      SaveSystem.writeJson(CONFIG.runHistoryKey, { history: this.history });
    }
    return summary;
  }

  keystoneSummary() {
    const runs = this.history;
    const eligibleRuns = runs.filter(run => run.eligibleOfferCount > 0);
    const offeredRuns = runs.filter(run => run.keystoneOfferCount > 0);
    const pickedRuns = runs.filter(run => run.keystone);
    return {
      runs: runs.length,
      eligibleRuns: eligibleRuns.length,
      offeredRuns: offeredRuns.length,
      pickedRuns: pickedRuns.length,
      offerRate: runs.length ? offeredRuns.length / runs.length : null,
      offerRateWhenEligible: eligibleRuns.length ? offeredRuns.length / eligibleRuns.length : null,
      pickRateWhenOffered: offeredRuns.length ? pickedRuns.length / offeredRuns.length : null,
      meanTimeToFirstOffer: offeredRuns.length
        ? Math.round(offeredRuns.reduce((sum, run) => sum + run.firstKeystoneOfferAt, 0) / offeredRuns.length)
        : null,
      meanTimeToPick: pickedRuns.length
        ? Math.round(pickedRuns.reduce((sum, run) => sum + run.firstKeystonePickAt, 0) / pickedRuns.length)
        : null,
      meanTimeAfterKeystone: pickedRuns.length
        ? Math.round(pickedRuns.reduce((sum, run) => sum + run.timeAfterKeystone, 0) / pickedRuns.length)
        : null,
    };
  }
}
