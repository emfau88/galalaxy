// Capture reproducible marketing scenes from the real game renderer.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.GALALAXY_QA_URL || "http://127.0.0.1:8765";
const output = new URL("../docs/kongregate/source/", import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: process.env.GALALAXY_BROWSER_CHANNEL || "msedge",
});
const context = await browser.newContext({
  viewport: { width: 780, height: 1400 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

function outputPath(name) {
  return new URL(name, output).pathname.replace(/^\/([A-Z]:)/, "$1");
}

async function openScene() {
  await page.goto(`${base}/?test=hud-layout`);
  await page.waitForFunction(() => window.__galalaxyTestGame?.state === "playing");
}

async function stageActionScene(variant) {
  await page.evaluate(async variantName => {
    const g = window.__galalaxyTestGame;
    const [{ Enemy }, { Projectile }] = await Promise.all([
      import("/src/entities/enemy.js"),
      import("/src/entities/projectile.js"),
    ]);
    await g._loadAssetGroups(["shared", "klaed", "nairan", "nautolan"]);

    const finale = variantName === "finale";
    g.state = "playing";
    g.currentSectorIndex = finale ? 3 : 1;
    g.sectorTimer = finale ? 31 : 38;
    g.level = finale ? 15 : 8;
    g.score = finale ? 68420 : 24860;
    g.best = 52110;
    g.kills = finale ? 137 : 49;
    g.runTime = finale ? 472 : 228;
    g.xp = finale ? 31 : 14;
    g.xpNeed = finale ? 48 : 27;
    g.bossActive = true;
    g.bossWarning = 0;
    g.shake = 0;
    g.time = finale ? 12.4 : 9.8;
    g.simTime = g.time;
    g.input.active = true;

    Object.assign(g.player, {
      x: finale ? 155 : 270,
      y: finale ? 625 : 640,
      vx: 150,
      vy: -35,
      bank: finale ? -0.08 : 0.09,
      hp: finale ? 82 : 91,
      maxHp: finale ? 118 : 109,
      shieldLevel: finale ? 3 : 2,
      shield: finale ? 67 : 71,
      maxShield: finale ? 103 : 79,
      speedLevel: finale ? 3 : 2,
      fireLevel: finale ? 3 : 2,
      twin: finale ? 3 : 2,
      rocket: 4,
      barrage: 2,
      zapper: finale ? 5 : 0,
      beam: finale ? 3 : 2,
      pulse: finale ? 3 : 0,
      hpLevel: finale ? 2 : 1,
      magnet: finale ? 2 : 1,
      keystoneId: finale ? "reactor" : "siege",
      pulseReactor: finale,
      siegePayload: !finale,
      emergencyAegis: false,
      invuln: 0,
      _pulseActive: finale,
      _pulseLife: finale ? 0.43 : 0,
      _pulseR: finale ? 118 : 0,
    });

    const makeEnemy = (type, x, y, boss = false) => {
      const enemy = new Enemy(g, type, x, y, boss);
      enemy.fireTimer = 99;
      enemy.wobble = 0.7;
      return enemy;
    };

    const boss = makeEnemy(finale ? "nautolanDreadnought" : "nairanDreadnought", finale ? 255 : 140, finale ? 150 : 170, true);
    boss.hp = boss.maxHp * (finale ? 0.28 : 0.63);
    boss.shield = finale ? 0 : boss.maxShield * 0.45;
    boss.hitFlash = 0;
    g.enemies = finale
      ? [
          boss,
          makeEnemy("nautolanBattlecruiser", 70, 260),
          makeEnemy("nautolanFrigate", 350, 315),
          makeEnemy("nautolanBomber", 305, 435),
          makeEnemy("nautolanFighter", 82, 445),
        ]
      : [
          boss,
          makeEnemy("nairanBattlecruiser", 340, 255),
          makeEnemy("nairanFrigate", 78, 345),
          makeEnemy("nairanFighter", 325, 430),
          makeEnemy("nairanBomber", 128, 485),
        ];

    const shot = (x, y, angle, owner, kind, key, age = 0.22) => {
      const projectile = new Projectile(x, y, angle, 180, 1, owner, kind, key, { life: 9 });
      projectile.age = age;
      return projectile;
    };

    const enemyShots = [];
    const bossOrigin = finale ? { x: 255, y: 215 } : { x: 140, y: 235 };
    for (let i = -3; i <= 3; i++) {
      enemyShots.push(shot(
        bossOrigin.x + i * 13,
        bossOrigin.y + Math.abs(i) * 13,
        Math.PI / 2 + i * 0.18,
        "enemy", "enemy", finale ? "nautolanBoss" : "nairanBoss", 0.08 + (i + 3) * 0.04,
      ));
    }
    enemyShots.push(...(finale
      ? [
          shot(80, 330, 1.08, "enemy", "enemy", "nautolanFrigate"),
          shot(342, 365, 2.02, "enemy", "enemy", "nautolanBattlecruiser"),
          shot(306, 500, 2.35, "enemy", "enemy", "nautolanBomber"),
        ]
      : [
          shot(330, 320, 1.93, "enemy", "enemy", "nairanBattlecruiser"),
          shot(84, 405, 0.88, "enemy", "enemy", "nairanFrigate"),
          shot(318, 485, 2.18, "enemy", "enemy", "nairanBomber"),
        ]));

    g.projectiles = [...enemyShots];
    g.player.pendingWeaponShots = [];
    g.player.weaponAnimations = {};
    g.player._fireAuto(0.72);
    g.player._tryFireRockets(true);
    g.player.fireBigGun(true);
    // Keep this shot focused on the Pulse/Rocket synergy. The Zapper is a
    // brief, jagged chain effect in live play and gets its own future capture
    // rather than being misrepresented as a sustained laser.
    // Advance only the authentic player-fired shots. The enemy salvo was
    // positioned to communicate its pattern and should remain frozen.
    for (let step = 0; step < 23; step++) {
      const dt = 0.05;
      g.simTime += dt;
      g.player.updatePendingWeaponShots(dt);
      for (const projectile of g.projectiles) {
        if (projectile.owner === "player" && !projectile.dead) projectile.update(dt, g);
      }
    }
    g.projectiles = g.projectiles.filter(projectile => !projectile.dead);
    // Any Zapper arcs now come only from _tryFireZapper above. Do not draw a
    // hand-authored line: the marketing frame must match the live weapon's
    // muzzle position, target selection and chain behavior exactly.
    g.particles = [];
    g.enemyDeaths = [];
    g.update = () => {};
    g.draw();
  }, variant);
  await page.waitForTimeout(120);
}

async function renderShip(name, upgrades) {
  const dataUrl = await page.evaluate(upgradeState => {
    const g = window.__galalaxyTestGame;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.scale(3, 3);
    Object.assign(g.player, {
      x: 80,
      y: 80,
      vx: 145,
      vy: 0,
      bank: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 55,
      speedLevel: 0,
      shieldLevel: 0,
      fireLevel: 0,
      twin: 0,
      rocket: 0,
      barrage: 0,
      zapper: 0,
      beam: 0,
      pulse: 0,
      hpLevel: 0,
      magnet: 0,
      keystoneId: null,
      pulseReactor: false,
      siegePayload: false,
      emergencyAegis: false,
      invuln: 0,
      ...upgradeState,
    });
    if (g.player.shieldLevel > 0) {
      g.player.maxShield = 55 + g.player.shieldLevel * 12;
      g.player.shield = g.player.maxShield;
    }
    g.state = "visualTest";
    g.time = 3.15;
    g.input.active = true;
    g.player.draw(ctx, g.loader);
    return canvas.toDataURL("image/png");
  }, upgrades);
  await writeFile(outputPath(name), Buffer.from(dataUrl.split(",")[1], "base64"));
}

try {
  await openScene();
  await stageActionScene("fleet");
  await page.screenshot({ path: outputPath("fleet-assault.png") });

  await openScene();
  await stageActionScene("finale");
  await page.screenshot({ path: outputPath("finale-assault.png") });

  await openScene();
  await renderShip("ship-01-starter.png", {});
  await renderShip("ship-02-armed.png", {
    speedLevel: 2, shieldLevel: 1, fireLevel: 1, twin: 1, rocket: 2,
  });
  await renderShip("ship-03-ascended.png", {
    speedLevel: 3, shieldLevel: 3, fireLevel: 3, twin: 3, rocket: 4,
    barrage: 2, zapper: 5, beam: 3, pulse: 3, hpLevel: 2, magnet: 2,
    keystoneId: "overcharged",
  });
  console.log("Kongregate source scenes captured");
} finally {
  await browser.close();
}
