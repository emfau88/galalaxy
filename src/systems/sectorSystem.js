import { CONFIG, SECTORS } from "../config.js";
import { SECTOR_ASSET_GROUPS } from "../assets.js";
import { Player } from "../entities/player.js";
import { Enemy } from "../entities/enemy.js";
import { FLEETS } from "../data/fleets.js";
import {
  FORMATION_SHAPES,
  WAVE_CARDS,
  createEncounterDirector,
  encounterProfileFor,
  pickPressureRole,
  pickRoleEnemy,
  pickWaveCard,
  pressureIntervalFor,
} from "../data/encounters.js";

class SectorMethods {
  updateSpawning(dt) {
    if (this.bossActive) return;

    this.sectorTimer -= dt;
    if (this.sectorTimer <= 0) {
      this.sectorTimer = 0;
      this.bossActive = true;
      this.bossWarning = 3.1;
      this.sounds?.play("boss");
      const sector = SECTORS[this.currentSectorIndex];
      const fleet = FLEETS[sector.fleet];
      this.spawnEnemy(sector.bossType || fleet.bossType, true);
      return;
    }

    const sector = SECTORS[this.currentSectorIndex];
    const sectorElapsed = sector.duration - this.sectorTimer;
    const sectorProgress = 1 - this.sectorTimer / sector.duration;
    const profile = encounterProfileFor(this.currentSectorIndex);
    if (!this.encounterDirector || this.encounterDirector.sectorIndex !== this.currentSectorIndex) {
      this.encounterDirector = createEncounterDirector(this.currentSectorIndex);
    }
    if (this.encounterDirector.disabled) return;

    const director = this.encounterDirector;
    director.timer -= dt;
    director.pressureTimer -= dt;

    // Authored formations get first claim on newly available slots. Events
    // that hit the cap remain queued instead of disappearing from the run.
    this._drainPendingEncounterEvents(profile, sector, sectorProgress);
    this._updatePursuitPressure(profile, sector, sectorProgress);

    if (director.phase === "entry-prep") {
      const card = WAVE_CARDS[director.waveId];
      const livingEnemies = this.enemies.filter(enemy => !enemy.dead).length;
      if (!card || livingEnemies <= (card.entryCap ?? 0)) {
        this._activateEncounterWave(card, profile, sectorProgress);
      }
      return;
    }

    if (director.phase === "recovery") {
      if (director.timer <= 0) this._startEncounterWave(profile, sectorProgress, sectorElapsed);
      return;
    }

    const card = WAVE_CARDS[director.waveId];
    if (!card) {
      this._startEncounterRecovery(profile);
      return;
    }

    director.waveElapsed += dt;
    while (director.eventIndex < card.events.length &&
           card.events[director.eventIndex].at <= director.waveElapsed) {
      this._queueEncounterEvent(card.events[director.eventIndex], card);
      director.eventIndex++;
    }
    this._drainPendingEncounterEvents(profile, sector, sectorProgress);
    if (director.timer <= 0) this._startEncounterRecovery(profile);
  }

  _startEncounterWave(profile, sectorProgress, sectorElapsed) {
    const director = this.encounterDirector;
    if (director.pendingEvents.length) {
      director.timer = 0.2;
      return;
    }
    const card = pickWaveCard(profile, sectorProgress, sectorElapsed, director.lastWaveId);
    const livingEnemies = this.enemies.filter(enemy => !enemy.dead).length;
    if (card.entryCap !== undefined && livingEnemies > card.entryCap) {
      director.phase = "entry-prep";
      director.waveId = card.id;
      director.phaseDuration = 0;
      director.waveElapsed = 0;
      director.eventIndex = 0;
      return;
    }
    this._activateEncounterWave(card, profile, sectorProgress);
  }

  _activateEncounterWave(card, profile, sectorProgress) {
    if (!card) {
      this._startEncounterRecovery(profile);
      return;
    }
    const director = this.encounterDirector;
    director.phase = "active";
    director.waveId = card.id;
    director.lastWaveId = card.id;
    director.timer = card.duration;
    director.phaseDuration = card.duration;
    director.waveElapsed = 0;
    director.eventIndex = 0;
    director.waveCount++;
    this.runStats?.encounterStart?.(this, card, profile);
    // Events authored at t=0 should appear on the exact phase boundary.
    while (director.eventIndex < card.events.length && card.events[director.eventIndex].at <= 0) {
      this._queueEncounterEvent(card.events[director.eventIndex], card);
      director.eventIndex++;
    }
    this._drainPendingEncounterEvents(
      profile, SECTORS[this.currentSectorIndex], sectorProgress,
    );
  }

  _startEncounterRecovery(profile) {
    const director = this.encounterDirector;
    const [minRecovery, maxRecovery] = profile.recovery;
    const recovery = minRecovery + Math.random() * (maxRecovery - minRecovery);
    director.phase = "recovery";
    director.timer = recovery;
    director.phaseDuration = recovery;
    director.waveElapsed = 0;
    director.eventIndex = 0;
    this.runStats?.encounterRecovery?.(this, recovery);
  }

  _queueEncounterEvent(event, card) {
    const formationSerial = this.encounterDirector.formationCount ?? 0;
    this.encounterDirector.pendingEvents.push({
      event,
      card,
      remaining: event.count,
      spawned: 0,
      formationId: event.formation
        ? `${card.id}-${this.encounterDirector.waveCount}-${formationSerial}`
        : null,
    });
    if (event.formation) this.encounterDirector.formationCount = formationSerial + 1;
  }

  _drainPendingEncounterEvents(profile, sector, sectorProgress) {
    const pending = this.encounterDirector.pendingEvents;
    while (pending.length) {
      const item = pending[0];
      const startIndex = item.spawned ?? 0;
      const spawned = this._spawnEncounterEvent(
        item.event, item.card, profile, sector, sectorProgress,
        item.remaining, startIndex, item.formationId,
      );
      item.remaining -= spawned;
      item.spawned = startIndex + spawned;
      if (item.remaining <= 0) pending.shift();
      else break;
    }
  }

  _updatePursuitPressure(profile, sector, sectorProgress) {
    const director = this.encounterDirector;
    const activeCard = WAVE_CARDS[director.waveId];
    if (activeCard?.suppressPressure) {
      if (director.phase === "entry-prep") return;
      if (director.phase === "active" &&
          director.waveElapsed < (activeCard.pressureResumeAt ?? Number.POSITIVE_INFINITY)) return;
    }
    if (director.pressureTimer > 0 || director.pendingEvents.length) return;

    const livingEnemies = this.enemies.filter(enemy => !enemy.dead).length;
    if (livingEnemies >= Math.min(profile.enemyCap, CONFIG.enemyCap)) {
      // Do not accumulate a burst while the arena is full. Retry soon and
      // restore the old continuous pressure as soon as one slot opens.
      director.pressureTimer = 0.12;
      return;
    }

    const pressureIndex = director.pressureCount;
    const pursuitSlot = (pressureIndex * 7) % 10;
    const activePursuers = this.enemies.filter(enemy =>
      !enemy.dead && enemy.encounterId === "pursuit-pressure").length;
    const usesPursuit = pursuitSlot < profile.pursuitChance * 10 &&
      activePursuers < profile.pursuitCap;
    const role = pickPressureRole(profile, sectorProgress);
    const type = pickRoleEnemy(sector.encounterFleet || sector.fleet, role, sectorProgress);
    const teachingLock = this.currentSectorIndex === 0 && sectorProgress < 15 / sector.duration
      ? this.simTime + Math.max(0, 15 - sectorProgress * sector.duration)
      : 0;
    const placement = usesPursuit
      ? this._pursuitPlacement(pressureIndex)
      : this._lanePressurePlacement(type, pressureIndex, sector.enemySpeedMult ?? 1);
    this.spawnEnemy(type, false, sector.enemySpeedMult ?? 1, placement.flyby, {
      x: placement.x,
      y: placement.y,
      fireLockedUntil: teachingLock,
      encounterId: usesPursuit ? "pursuit-pressure" : "lane-pressure",
    });
    director.pressureCount++;
    director.pressureTimer = pressureIntervalFor(profile);
  }

  _pursuitPlacement(index) {
    // Active hunters only enter from the forward and upper-side arcs. Rear
    // spawns made the player feel surrounded before a threat was readable.
    const entries = [
      { x: 82, y: -52 },
      { x: 210, y: -52 },
      { x: 338, y: -52 },
      { x: -52, y: 178 },
      { x: CONFIG.designW + 52, y: 238 },
    ];
    return { ...entries[index % entries.length], flyby: null };
  }

  _lanePressurePlacement(type, index, speedMult) {
    const baseSpeed = Enemy.defs[type]?.speed ?? 90;
    const flightSpeed = baseSpeed * speedMult * 1.04;
    const pattern = index % 5;
    if (pattern === 1 || pattern === 4) {
      const fromLeft = pattern === 1;
      return {
        x: fromLeft ? -54 : CONFIG.designW + 54,
        y: pattern === 1 ? 205 : 285,
        flyby: {
          vx: (fromLeft ? 1 : -1) * flightSpeed * 1.16,
          vy: 18,
          sineAmp: 6,
          sineFreq: 1.5,
        },
      };
    }
    const laneXs = [72, 210, 348];
    return {
      x: laneXs[pattern % laneXs.length],
      y: -52,
      flyby: { vx: 0, vy: flightSpeed, sineAmp: 0, sineFreq: 0 },
    };
  }

  _spawnEncounterEvent(
    event, card, profile, sector, sectorProgress,
    requestedCount = event.count, startIndex = 0, formationId = null,
  ) {
    const livingEnemies = this.enemies.filter(enemy => !enemy.dead).length;
    const eventEnemyCap = Math.min(card.enemyCap ?? profile.enemyCap, profile.enemyCap, CONFIG.enemyCap);
    const available = Math.max(0, eventEnemyCap - livingEnemies);
    const roleLimit = event.role === "torpedo"
      ? (this.enemies.some(enemy => !enemy.dead && enemy.type === "nairanTorpedoShip") ? 0 : 1)
      : event.role === "support"
        ? (this.enemies.some(enemy => !enemy.dead && enemy.type === "nautolanSupport") ? 0 : 1)
        : requestedCount;
    const count = Math.min(requestedCount, available, roleLimit);
    for (let localIndex = 0; localIndex < count; localIndex++) {
      const index = startIndex + localIndex;
      const role = event.roles?.[index % event.roles.length] ?? event.role;
      const type = pickRoleEnemy(sector.encounterFleet || sector.fleet, role, sectorProgress);
      const placement = this._encounterPlacement(
        event, card, type, index, event.count, sector.enemySpeedMult ?? 1,
      );
      const teachingLock = this.currentSectorIndex === 0 && sectorProgress < 15 / sector.duration
        ? this.simTime + Math.max(0, 15 - sectorProgress * sector.duration)
        : 0;
      this.spawnEnemy(type, false, sector.enemySpeedMult ?? 1, placement.flyby, {
        x: placement.x,
        y: placement.y,
        fireLockedUntil: Math.max(teachingLock, this.simTime + (event.fireDelay ?? 0)),
        encounterId: card.id,
        formationId,
        formationSlot: formationId ? index : null,
        formationSize: formationId ? event.count : null,
      });
    }
    return count;
  }

  _encounterPlacement(event, card, type, index, count, speedMult) {
    const baseSpeed = Enemy.defs[type]?.speed ?? 90;
    const flightSpeed = baseSpeed * speedMult * 1.14;
    const split = [56, 116, 304, 364];
    const edge = [72, 348];
    const left = [62, 118, 172];
    const right = [358, 302, 248];
    const centered = [210, 154, 266, 104, 316];
    const entry = event.entry;

    if (event.formation) {
      const shape = FORMATION_SHAPES[event.formation];
      const slot = shape?.[index % shape.length] ?? { across: 0, trail: index * 34 };
      const sharedSpeed = (event.flightSpeed ?? baseSpeed * 0.78) * speedMult;
      const alternatesFromLeft = (this.encounterDirector?.waveCount ?? 0) % 2 === 1;
      const fromLeft = entry === "side-left" ||
        (entry === "side-alternating" && alternatesFromLeft);
      const fromRight = entry === "side-right" ||
        (entry === "side-alternating" && !alternatesFromLeft);
      let anchorX = CONFIG.designW / 2;
      let anchorY = -58;
      let unitX = 0;
      let unitY = 1;
      if (fromLeft || fromRight) {
        anchorX = fromLeft ? -58 : CONFIG.designW + 58;
        anchorY = event.band === "middle" ? 320 : 230;
        unitX = fromLeft ? 1 : -1;
        unitY = 0;
      }
      const perpendicularX = unitY;
      const perpendicularY = -unitX;
      return {
        x: anchorX - unitX * slot.trail + perpendicularX * slot.across,
        y: anchorY - unitY * slot.trail + perpendicularY * slot.across,
        flyby: {
          vx: unitX * sharedSpeed,
          vy: unitY * sharedSpeed,
          sineAmp: 0,
          sineFreq: 0,
        },
      };
    }

    if (entry === "side-left" || entry === "side-right") {
      const fromLeft = entry === "side-left";
      const baseY = event.band === "middle" ? 300 : 178;
      return {
        x: fromLeft ? -54 - index * 34 : CONFIG.designW + 54 + index * 34,
        y: baseY + index * 54,
        flyby: {
          vx: (fromLeft ? 1 : -1) * flightSpeed * 1.22,
          vy: 24,
          sineAmp: 8,
          sineFreq: 1.7,
        },
      };
    }

    let xs = centered;
    if (entry === "top-split") xs = split;
    else if (entry === "top-edges") xs = edge;
    else if (entry === "top-edge") {
      const side = (this.encounterDirector?.waveCount ?? 0) % 2;
      xs = [edge[side], edge[1 - side]];
    }
    else if (entry === "top-left") xs = left;
    else if (entry === "top-right") xs = right;

    const x = xs[index % xs.length];
    const isFormationFlyby = entry === "top-split" || (event.role === "light" && count > 1);
    return {
      x,
      y: -52 - Math.floor(index / xs.length) * 42,
      flyby: isFormationFlyby
        ? { vx: 0, vy: flightSpeed, sineAmp: 0, sineFreq: 0 }
        : null,
    };
  }

  _hitRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  returnToHangar() {
    this.clearArena();
    this._unloadAssetGroups(["nairan", "nautolan", "victory"]);
    this._loadAssetGroups(["shared", "klaed"]);
    this.player = new Player(this);
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.zaps = [];
    this.enemyDeaths = [];
    this.bossRewardData = null;
    this.resumeAfterUpgradeState = null;
    this.pendingUpgrades = 0;
    this.input.cancelMovement();
    this.titleTime = 0;
    this.state = "title";
  }

  onBossKilled(bossX, bossY, bossXp = 12, bossProfile = null) {
    // Bank only existing, uncollected XP. Surviving enemies grant no free kills.
    const recoveredXp = this.pickups.reduce((sum, p) =>
      sum + (p.dead || !Number.isFinite(p.value) ? 0 : p.value), 0);
    this.clearArena();
    this.bossActive = false;
    this.bossWarning = 0;
    this.sectorsCleared = this.currentSectorIndex + 1;
    const finalBoss = this.currentSectorIndex >= SECTORS.length - 1;

    if (!finalBoss) {
      // Advance sector immediately so shipTier() already reflects the new tier
      // when the reward overlay renders the ship.
      this.currentSectorIndex++;
      this.sectorTimer = SECTORS[this.currentSectorIndex].duration;
    }

    // Build reward data snapshot for the overlay
    const tier   = this.player.shipTier();   // now the new tier
    const branch = this.player.shipBranch();
    const BRANCH_COLORS_HEX = { assault: "#c8d8ff", energy: "#88ccff", siege: "#ffaa40" };
    const MOVE_BONUS  = ["", "+0%", "+5%", "+8%", "+10%"];
    const FIRE_BONUS  = ["", "+0%", "+6%", "+10%", "+14%"];

    const rewardDuration = finalBoss ? 4.3 : 3.2;
    this.bossRewardData = {
      tier,
      branch,
      branchColor:  BRANCH_COLORS_HEX[branch] || CONFIG.colors.cyan,
      moveBonusStr: MOVE_BONUS[tier]  || "",
      fireBonusStr: FIRE_BONUS[tier]  || "",
      bossX,
      bossY,
      bossXp: bossXp + recoveredXp,
      finalBoss,
      bossName: bossProfile?.name || "SECTOR COMMANDER",
      duration: rewardDuration,
      minimumHold: finalBoss ? 2.4 : 1.2,
    };

    // The finale receives a slightly longer destruction/silence beat before
    // the victory screen; intermediate bosses retain the established cadence.
    this.bossRewardTimer = rewardDuration;
    this.state = "bossReward";
  }

  _endBossReward() {
    const reward = this.bossRewardData;
    if (!reward) return;

    const requiredGroups = reward.finalBoss
      ? ["victory"]
      : this.currentSectorIndex === 3
        ? ["nautolan", "nairan"]
        : [SECTOR_ASSET_GROUPS[this.currentSectorIndex]];
    if (!this._assetGroupsReady(requiredGroups)) {
      this.state = "loading";
      this._loadAssetGroups(requiredGroups).then(() => {
        if (this.state === "loading" && this.bossRewardData === reward) {
          this.state = "bossReward";
          this._endBossReward();
        }
      });
      return;
    }

    // The reward screen is already a natural, player-controlled break. Ask
    // Y8 for an interstitial exactly once before continuing into the next
    // sector. A capped, unavailable, or failed break continues immediately.
    if (reward.y8AdPending) return;
    if (!reward.finalBoss && !reward.y8AdRequested && this.y8?.enabled) {
      reward.y8AdRequested = true;
      reward.y8AdPending = true;
      this.y8.showInterstitial("sector-complete", () => {
        reward.y8AdPending = false;
        if (this.bossRewardData === reward && this.state === "bossReward") this._endBossReward();
      });
      return;
    }

    this.bossRewardData = null;
    // The boss death effect may have been created after onBossKilled returned.
    // Release every fleet reference before unloading its image group.
    this.clearArena();

    const finishedSectorIndex = reward.finalBoss
      ? this.currentSectorIndex
      : this.currentSectorIndex - 1;
    const finishedGroup = SECTOR_ASSET_GROUPS[finishedSectorIndex];
    const activeGroup = reward.finalBoss ? null : SECTOR_ASSET_GROUPS[this.currentSectorIndex];
    if (finishedGroup !== activeGroup) this._unloadAssetGroups([finishedGroup]);
    if (reward.finalBoss) this._unloadAssetGroups(["nairan"]);
    if (!reward.finalBoss) this._preloadNextSectorAssets();

    const nextState = reward.finalBoss ? "victory" : "playing";
    if (!reward.finalBoss) {
      this.sectorTransition = 2.2;
    }

    // Award the exact former boss-drop total only after every visible shard
    // has reached the ship. If it earns a level, the upgrade picker naturally
    // follows the reward screen before the run continues (or reaches victory).
    this.resumeAfterUpgradeState = nextState;
    this.gainXp(reward.bossXp);
    if (this.state === "bossReward") {
      this.state = nextState;
      this.resumeAfterUpgradeState = null;
      if (nextState === "victory") this.finishRun("victory");
    }
  }

  spawnEnemy(type, boss, speedMult = 1.0, flyby = null, options = {}) {
    let x, y;
    if (boss) {
      x = CONFIG.designW / 2;
      y = -90;
    } else if (Number.isFinite(options.x) && Number.isFinite(options.y)) {
      x = options.x;
      y = options.y;
    } else if (flyby && flyby.vx !== 0) {
      // Diagonal flyby: enter from the edge the velocity comes from, at a random vertical position.
      x = flyby.vx > 0 ? -50 : CONFIG.designW + 50;
      y = CONFIG.designH * (0.05 + Math.random() * 0.45); // upper half — readable on mobile
    } else {
      // Weighted side selection: top 45%, left 22.5%, right 22.5%, bottom 10%.
      const r = Math.random();
      const side = r < 0.45 ? 0 : r < 0.675 ? 1 : r < 0.90 ? 2 : 3;
      if (side === 0) {
        x = Math.random() * CONFIG.designW;
        y = -50;
      } else if (side === 1) {
        x = CONFIG.designW + 50;
        y = Math.random() * CONFIG.designH * 0.65;
      } else if (side === 2) {
        x = -50;
        y = Math.random() * CONFIG.designH * 0.65;
      } else {
        x = Math.random() * CONFIG.designW;
        y = CONFIG.designH + 50;
      }
    }
    const enemy = new Enemy(this, type, x, y, boss, speedMult, flyby);
    enemy.fireLockedUntil = options.fireLockedUntil ?? 0;
    enemy.encounterId = options.encounterId ?? null;
    enemy.formationId = options.formationId ?? null;
    enemy.formationSlot = options.formationSlot ?? null;
    enemy.formationSize = options.formationSize ?? null;
    if (enemy.encounterId === "pursuit-pressure") enemy.pursuitUntil = this.simTime + 6;
    this.enemies.push(enemy);
    this.runStats?.enemySpawn?.(this, enemy, options.encounterId ?? (boss ? "boss" : "untracked"));
    if (boss) this.bossEntrance(x, y);
    return enemy;
  }

}

export const sectorMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(SectorMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
