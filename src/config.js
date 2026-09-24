export const CONFIG = {
  designW: 420,
  designH: 760,
  maxDt: 0.033,
  playerRadius: 24,
  enemyCap: 72,
  projectileCap: 180,
  particleCap: 220,
  pickupCap: 80,
  saveKey: "void_drift_best_score_v1",
  settingsKey: "galalaxy_settings_v1",
  runHistoryKey: "galalaxy_run_history_v1",
  kongregateStatsKey: "galalaxy_kongregate_stats_v1",
  assetTimeoutMs: 9000,
  colors: {
    bg: "#050716",
    cyan: "#58e6ff",
    blue: "#3388ff",
    pink: "#ff4fd8",
    orange: "#ffb347",
    red: "#ff466b",
    green: "#67ff9a",
    white: "#edf7ff",
    dim: "rgba(220,235,255,0.64)"
  }
};

export const RENDER_CONFIG = {
  player: { w: 76, h: 76 },
  // Shield source frames are 64x64 around a 48x48 ship registration.
  playerShield: { w: 76 * (64 / 48), h: 76 * (64 / 48) },
  enemies: {
    // Kla'ed Fleet 1
    scout:              { w: 68,  h: 68  },
    fighter:            { w: 77,  h: 77  },
    bomber:             { w: 78,  h: 78  },
    frigate:            { w: 88,  h: 88  },
    battlecruiser:      { w: 104, h: 104 },
    dreadnought:        { w: 136, h: 136 },
    // Nairan Fleet 2
    nairanScout:        { w: 65,  h: 65  },
    nairanFighter:      { w: 74,  h: 74  },
    nairanBomber:       { w: 76,  h: 76  },
    nairanFrigate:      { w: 86,  h: 86  },
    nairanBattlecruiser:{ w: 102, h: 102 },
    nairanDreadnought:  { w: 138, h: 138 },
    nairanTorpedoShip:  { w: 92,  h: 92  },
    // Nautolan Fleet 3
    nautolanScout:        { w: 70,  h: 70  },
    nautolanFighter:      { w: 82,  h: 82  },
    nautolanBomber:       { w: 82,  h: 82  },
    nautolanFrigate:      { w: 94,  h: 94  },
    nautolanBattlecruiser:{ w: 110, h: 110 },
    nautolanDreadnought:  { w: 142, h: 142 },
    nautolanSupport:      { w: 88,  h: 88  },
    voidSovereign:        { w: 158, h: 158 }
  },
  pickups: { w: 46, h: 46 },
  planet:  { w: 190, h: 190 },
  asteroid:{ wMin: 24, wMax: 46 }
};

export const STRIP_RATIO = 2.2;

// Engine level 0–3: each upgrade has a tangible increase in top speed.
export const PLAYER_ENGINE_SPEEDS = [260, 300, 345, 395];

// Delay before a damaged shield may begin recovering. Higher shield stages
// recover more quickly and resume sooner, so they remain a meaningful choice.
export const PLAYER_SHIELD_RECHARGE_DELAYS = [6, 4, 2, 1];

// Passive weapons supplement the auto cannon. Their values account for the
// authored firing animations, which impose a practical cadence limit.
export const PLAYER_WEAPON_BALANCE = {
  rocket: {
    baseChance: 0.28,
    chancePerLevel: 0.08,
    baseDamage: 28,
    damagePerLevel: 6,
    barrageDamagePerLevel: 6,
  },
  zapper: {
    baseChance: 0.40,
    chancePerLevel: 0.08,
    baseDamage: 28,
    damagePerLevel: 7,
    chainDamageMultiplier: 0.65,
  },
};

export const CONTROL_CONFIG = {
  // Applied only on touch input: ship leads the finger by this many design-pixels upward.
  // Keeps the ship visible above the thumb. Clamped so ship can't leave the play area.
  touchOffsetY: 70,
  // No horizontal offset — lateral precision matters more than thumb coverage.
  touchOffsetX: 0,
  // Mouse/desktop: zero offset, ship follows cursor directly.
  mouseOffsetY: 0,
};

export const SECTOR_ENVIRONMENTS = Object.freeze([
  {
    id: "frontier-lane",
    gradient: ["#05091a", "#09182d", "#03060d"],
    landmark: "planet",
    landmarkX: 368, landmarkY: 142, landmarkSize: 190, landmarkAlpha: 0.26,
    asteroidCount: 6, asteroidAlpha: 0.12, starAlpha: 1,
    starColor: "#e8f8ff", edgeColor: [74, 126, 205],
  },
  {
    id: "nairan-expanse",
    gradient: ["#100719", "#17102c", "#05050e"],
    landmark: "environmentNairanStar",
    landmarkX: 70, landmarkY: 164, landmarkSize: 128, landmarkAlpha: 0.28,
    asteroidCount: 3, asteroidAlpha: 0.08, starAlpha: 0.82,
    starColor: "#f2e8ff", edgeColor: [148, 72, 184],
  },
  {
    id: "nautolan-depths",
    gradient: ["#03100f", "#08251f", "#020908"],
    landmark: "environmentNautolanStar",
    landmarkX: 350, landmarkY: 176, landmarkSize: 116, landmarkAlpha: 0.23,
    asteroidCount: 8, asteroidAlpha: 0.15, starAlpha: 0.72,
    starColor: "#dcfff2", edgeColor: [50, 142, 112],
  },
  {
    id: "void-core",
    gradient: ["#09030a", "#180710", "#020104"],
    landmark: "environmentVoidCore",
    landmarkX: 210, landmarkY: 148, landmarkSize: 205, landmarkAlpha: 0.24,
    asteroidCount: 4, asteroidAlpha: 0.12, starAlpha: 0.48,
    starColor: "#ecdce6", edgeColor: [154, 42, 68],
  },
]);

export const SECTORS = [
  {
    index: 0,
    name: "Kla'ed Frontier",
    shortName: "SECTOR I",
    duration: 70,
    fleet: "klaed",
    tint: [30, 60, 140],
    scoreMult: 1.0,
    enemySpeedMult: 0.9   // regular enemies 10% slower; does not affect boss
  },
  {
    index: 1,
    name: "Nairan Expanse",
    shortName: "SECTOR II",
    duration: 90,
    fleet: "nairan",
    tint: [100, 30, 140],
    scoreMult: 1.08,
    enemySpeedMult: 1.0
  },
  {
    index: 2,
    name: "Nautolan Depths",
    shortName: "SECTOR III",
    duration: 105,
    fleet: "nautolan",
    tint: [30, 110, 80],
    scoreMult: 1.12,
    enemySpeedMult: 1.0
  },
  {
    index: 3,
    name: "Void Core",
    shortName: "SECTOR IV",
    duration: 115,
    fleet: "nautolan",
    encounterFleet: "void",
    bossType: "voidSovereign",
    tint: [140, 30, 30],
    scoreMult: 1.2,
    enemySpeedMult: 1.0
  }
];
