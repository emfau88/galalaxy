import { CONFIG } from "./config.js";
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

export class RunStats {
  constructor() {
    const saved = SaveSystem.readJson(CONFIG.runHistoryKey, { history: [] });
    this.history = Array.isArray(saved.history) ? saved.history.slice(0, MAX_HISTORY) : [];
    this.current = null;
  }

  start(game) {
    this.current = {
      version: 1,
      offers: 0,
      picks: 0,
      eligibleOfferCount: 0,
      keystoneOfferCount: 0,
      firstEligibleOfferAt: null,
      firstKeystoneOfferAt: null,
      firstKeystonePickAt: null,
      offeredKeystones: [],
      pickedKeystone: null,
      sectorsCleared: 0,
    };
    this.current.sectorReached = Math.max(1, game.currentSectorIndex + 1);
  }

  offer(game, picked, candidates) {
    if (!this.current || game.isQaRun) return;
    const eligible = candidates.filter(upgrade => upgrade.keystone);
    const offered = picked.filter(upgrade => upgrade.keystone);
    this.current.offers++;
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

  complete(game, outcome, cause = null) {
    const player = game.player;
    const current = this.current || {};
    const modules = moduleEntries(player)
      .filter(([, level]) => level > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([name, level]) => ({ name, level }));
    const summary = {
      ...current,
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
