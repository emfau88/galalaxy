import { SECTORS } from "../config.js";
import { ASSET_GROUPS, SECTOR_ASSET_GROUPS } from "../assets.js";
import { Enemy } from "../entities/enemy.js";

const TEST_TIMEOUT_MS = 15000;

function waitFor(predicate, label, timeoutMs = TEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${label}`));
        return;
      }
      setTimeout(check, 16);
    };
    check();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function groupLoaded(game, groupName) {
  return Object.keys(ASSET_GROUPS[groupName]).every(key => game.loader.get(key));
}

function groupReleased(game, groupName) {
  return Object.keys(ASSET_GROUPS[groupName]).every(key => !game.loader.get(key));
}

function publish(report) {
  document.documentElement.dataset.fullRunTest = report.ok ? "pass" : "fail";
  document.documentElement.dataset.fullRunReport = JSON.stringify(report);
  document.title = report.ok ? "Galalaxy QA PASS" : "Galalaxy QA FAIL";
}

export async function runFullRunTest(game) {
  const report = {
    ok: false,
    transitions: [],
    replay: false,
    hangar: false,
    arenaCleanup: false,
    queuedLevels: false,
    pausedCombatClock: false,
  };

  try {
    game.startRun();
    await waitFor(
      () => game.state === "playing" && game.currentSectorIndex === 0,
      "the first playable sector",
    );
    assert(groupLoaded(game, "klaed"), "Kla'ed assets were not ready at run start");

    // A multi-level pickup must produce two decisions rather than overwriting
    // the first card set. Start a fresh run before the transition assertions.
    game.gainXp(22);
    assert(game.pendingUpgrades === 2 && game.state === "levelUp", "multiple earned levels did not queue two choices");
    game.upgrades.pick(0);
    assert(game.pendingUpgrades === 1 && game.state === "levelUp", "the second earned upgrade was discarded");
    game.upgrades.pick(0);
    assert(game.pendingUpgrades === 0 && game.state === "playing", "play did not resume after queued upgrades");
    report.queuedLevels = true;

    // Enemy telegraphs use simulation time; UI time while paused cannot spend
    // their delay. This avoids instant attacks on resume.
    const queuedEnemy = new Enemy(game, "frigate", 80, 160);
    queuedEnemy._queueWeaponShot(0, { delay: 0.72, skipWeaponAnimation: true });
    game.state = "paused";
    const pausedSimTime = game.simTime;
    game.update(0.9);
    assert(game.simTime === pausedSimTime, "simulation time advanced while paused");
    queuedEnemy._releaseQueuedShots();
    assert(game.projectiles.length === 0, "a queued enemy shot released while paused");
    game.state = "playing";
    game.simTime += 0.73;
    queuedEnemy._releaseQueuedShots();
    assert(game.projectiles.length === 1, "queued enemy shot did not release after active combat time");
    game.projectiles = [];
    report.pausedCombatClock = true;

    for (let nextSectorIndex = 1; nextSectorIndex < SECTORS.length; nextSectorIndex++) {
      const finishedSectorIndex = nextSectorIndex - 1;
      const finishedGroup = SECTOR_ASSET_GROUPS[finishedSectorIndex];
      const activeGroup = SECTOR_ASSET_GROUPS[nextSectorIndex];

      game.bossActive = true;
      const survivor = new Enemy(game, "frigate", 80, 160);
      survivor.pendingShots.push({ at: game.simTime + 1, angle: 0, options: {} });
      game.enemies.push(survivor);
      game.spawnProjectile(80, 160, 0, 100, 1, "enemy", "enemy", "klaedFrigate");
      game.pickups.push({ value: 1, dead: false });
      game.onBossKilled(game.player.x, game.player.y, 0);
      game.bossRewardTimer = 0;
      game._endBossReward();

      await waitFor(
        () => game.state === "playing" && game.currentSectorIndex === nextSectorIndex,
        `sector ${nextSectorIndex + 1}`,
      );
      assert(groupLoaded(game, activeGroup), `${activeGroup} assets were missing after transition`);
      if (finishedGroup !== activeGroup) {
        assert(groupReleased(game, finishedGroup), `${finishedGroup} assets were not released`);
      }
      assert(game.enemies.length === 0 && game.projectiles.length === 0 && game.pickups.length === 0,
        "old sector combat objects remained after transition");

      report.transitions.push({
        from: finishedSectorIndex + 1,
        to: nextSectorIndex + 1,
        activeGroup,
        sharedFleetGroup: finishedGroup === activeGroup,
      });
    }
    report.arenaCleanup = true;

    game.bossActive = true;
    game.onBossKilled(game.player.x, game.player.y, 0);
    game.bossRewardTimer = 0;
    game._endBossReward();
    await waitFor(() => game.state === "victory", "victory");
    assert(groupLoaded(game, "victory"), "Victory assets were not ready");
    assert(groupReleased(game, "nautolan"), "Final fleet assets were not released");

    game.startRun();
    await waitFor(
      () => game.state === "playing" && game.currentSectorIndex === 0,
      "play again",
    );
    assert(groupLoaded(game, "klaed"), "Kla'ed assets were not restored for replay");
    report.replay = true;

    game.state = "victory";
    game.returnToHangar();
    await waitFor(
      () => game.state === "title" && groupLoaded(game, "klaed"),
      "return to hangar",
    );
    assert(groupReleased(game, "victory"), "Victory assets were retained in the hangar");
    report.hangar = true;
    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    console.error("Full-run QA failed", error);
  }

  publish(report);
  return report;
}
