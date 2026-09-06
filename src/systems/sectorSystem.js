import { CONFIG, SECTORS } from "../config.js";
import { SECTOR_ASSET_GROUPS } from "../assets.js";
import { clamp } from "../utils.js";
import { Player } from "../entities/player.js";
import { Enemy } from "../entities/enemy.js";
import { FLEETS, pickSoloEnemy } from "../data/fleets.js";

class SectorMethods {
  updateSpawning(dt) {
    if (this.bossActive) return;

    this.sectorTimer -= dt;
    if (this.sectorTimer <= 0) {
      this.sectorTimer = 0;
      this.bossActive = true;
      this.bossWarning = 3.1;
      this.sounds?.play("boss");
      const fleet = FLEETS[SECTORS[this.currentSectorIndex].fleet];
      this.spawnEnemy(fleet.bossType, true);
      return;
    }

    this.spawnTimer -= dt;
    const sector = SECTORS[this.currentSectorIndex];
    const sectorElapsed = sector.duration - this.sectorTimer;
    const sectorProgress = 1 - this.sectorTimer / sector.duration;
    const difficulty = 1 + this.currentSectorIndex * 0.6 + sectorProgress * 0.5;
    // Sector I briefly eases entry, then returns to the existing spawn curve.
    const normalInterval = clamp((1.0 - difficulty * 0.08) / (sector.spawnMult ?? 1.0), 0.22, 1.0);
    const interval = this.currentSectorIndex === 0 && sectorElapsed < 10
      ? 1.25
      : normalInterval;

    if (this.spawnTimer <= 0 && this.enemies.length < CONFIG.enemyCap) {
      this.spawnTimer = interval;
      const fleet = FLEETS[sector.fleet];
      const speedMult = sector.enemySpeedMult ?? 1.0;

      // Formation chance per sector; suppressed in Sector I before 22s elapsed
      // and suppressed during bossWarning. Formation replaces the normal solo spawn.
      const formationChance = [0.25, 0.30, 0.34, 0.36][this.currentSectorIndex] ?? 0.25;
      const formationAllowed = !this.bossWarning &&
                               !(this.currentSectorIndex === 0 && sectorElapsed < 22) &&
                               this.enemies.length + 5 <= CONFIG.enemyCap;

      if (formationAllowed && Math.random() < formationChance) {
        // Formation tick — spawn formation instead of solo enemy; give a longer cooldown
        this.spawnTimer = interval * 2.2;
        this.spawnFormation(fleet, sectorProgress, speedMult);
      } else {
        const type = pickSoloEnemy(fleet, sectorProgress);
        // Scouts/fighters that do spawn solo cross diagonally instead of chasing.
        const isLight = /scout|fighter/i.test(type);
        const soloFlyby = isLight && Math.random() < 0.50
          ? this._makeDiagonalFlyby(Enemy.defs[type]?.speed ?? 90, speedMult)
          : null;
        this.spawnEnemy(type, false, speedMult, soloFlyby);
        if (difficulty > 1.8 && Math.random() < 0.2) {
          this.spawnEnemy(pickSoloEnemy(fleet, sectorProgress), false, speedMult);
        }
      }
    }
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

  onBossKilled(bossX, bossY, bossXp = 12) {
    // Bank only existing, uncollected XP. Surviving enemies grant no free kills.
    const recoveredXp = this.pickups.reduce((sum, p) => sum + (p.dead ? 0 : p.value), 0);
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
    };

    this.bossRewardTimer = 3.2; // total display time in seconds
    this.state = "bossReward";
  }

  _endBossReward() {
    const reward = this.bossRewardData;
    if (!reward) return;

    const requiredGroups = reward.finalBoss
      ? ["victory"]
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

  spawnEnemy(type, boss, speedMult = 1.0, flyby = null) {
    let x, y;
    if (boss) {
      x = CONFIG.designW / 2;
      y = -90;
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
    this.enemies.push(new Enemy(this, type, x, y, boss, speedMult, flyby));
    if (boss) this.bossEntrance(x, y);
  }

  // Spawns 3–5 small enemies in a formation using flyby behavior.
  // Patterns: 0=horizontal line, 1=diagonal line, 2=shallow-V
  // Always enters from the top. Does NOT add normal spawn timer delay.
  spawnFormation(fleet, sectorProgress, speedMult) {
    // Only scouts/fighters in formations
    const lightTypes = Object.keys(fleet.phases[0]).filter(t => /scout|fighter/i.test(t));
    if (!lightTypes.length) return;
    const type = lightTypes[Math.floor(Math.random() * lightTypes.length)];

    const baseSpeed = Enemy.defs[type]?.speed ?? 90;
    const spd = baseSpeed * speedMult * 1.15;
    const s = 46; // spacing between slots

    // 5 named shapes — each is an array of {dx, dy} offsets from formation center.
    // All offsets are in "formation space": x=across travel axis, y=along travel axis.
    const SHAPES = [
      // horizontal line (3)
      [{ dx: -s,   dy: 0 }, { dx: 0,    dy: 0 }, { dx: s,    dy: 0 }],
      // diagonal line (4)
      [{ dx: -s*1.5, dy: -s*0.5 }, { dx: -s*0.5, dy: 0 }, { dx: s*0.5, dy: s*0.5 }, { dx: s*1.5, dy: s }],
      // V-shape (5, tip leads)
      [{ dx: 0, dy: 0 }, { dx: -s, dy: s*0.7 }, { dx: s, dy: s*0.7 }, { dx: -s*2, dy: s*1.4 }, { dx: s*2, dy: s*1.4 }],
      // diamond (4)
      [{ dx: 0, dy: -s*0.7 }, { dx: -s, dy: 0 }, { dx: s, dy: 0 }, { dx: 0, dy: s*0.7 }],
      // arrow / wedge (5, tip leads)
      [{ dx: 0, dy: 0 }, { dx: -s, dy: s*0.6 }, { dx: s, dy: s*0.6 }, { dx: -s*1.8, dy: s*0.2 }, { dx: s*1.8, dy: s*0.2 }],
    ];

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const fromSide = Math.random() < 0.5;

    // All enemies in this formation share the same flyby vector — no individual wobble.
    // sineAmp:0 keeps the block tight; the shape provides all visual interest.
    if (fromSide) {
      const fromLeft = Math.random() < 0.5;
      const vx = (fromLeft ? 1 : -1) * spd;
      const cy = CONFIG.designH * (0.15 + Math.random() * 0.40);
      const flyby = { vx, vy: 0, sineAmp: 0, sineFreq: 0 };
      for (const off of shape) {
        if (this.enemies.length >= CONFIG.enemyCap) break;
        // In side-entry: dx maps to y-axis, dy maps to x-axis (along travel direction)
        const ex = fromLeft
          ? -50 - Math.max(0, off.dy)
          : CONFIG.designW + 50 + Math.max(0, -off.dy);
        const ey = clamp(cy + off.dx, 30, CONFIG.designH - 30);
        this.enemies.push(new Enemy(this, type, ex, ey, false, speedMult, flyby));
      }
    } else {
      const cx = CONFIG.designW * (0.2 + Math.random() * 0.6);
      const flyby = { vx: 0, vy: spd, sineAmp: 0, sineFreq: 0 };
      for (const off of shape) {
        if (this.enemies.length >= CONFIG.enemyCap) break;
        const ex = clamp(cx + off.dx, 30, CONFIG.designW - 30);
        const ey = -50 - Math.max(0, off.dy); // tip enters first
        this.enemies.push(new Enemy(this, type, ex, ey, false, speedMult, flyby));
      }
    }
  }

  // Returns a flyby object for a solo enemy crossing diagonally.
  // Enters from left or right edge, travels toward the opposite side with a downward angle.
  _makeDiagonalFlyby(baseSpeed, speedMult) {
    const fromLeft = Math.random() < 0.5;
    const spd = baseSpeed * speedMult * 1.1;
    // Horizontal component carries enemy across full canvas width; vertical keeps it moving down.
    // angle 15–35° below horizontal — horizontal component dominant, clearly crossing not chasing.
    const angleRad = (0.26 + Math.random() * 0.35); // ~15–35° in radians
    const vx = (fromLeft ? 1 : -1) * Math.cos(angleRad) * spd;
    const vy = Math.sin(angleRad) * spd;
    return { vx, vy, sineAmp: 12, sineFreq: 2.0 };
  }
}

export const sectorMethods = Object.fromEntries(
  Object.entries(Object.getOwnPropertyDescriptors(SectorMethods.prototype))
    .filter(([name]) => name !== "constructor"),
);
