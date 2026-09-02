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
    // Nautolan Fleet 3
    nautolanScout:        { w: 70,  h: 70  },
    nautolanFighter:      { w: 82,  h: 82  },
    nautolanBomber:       { w: 82,  h: 82  },
    nautolanFrigate:      { w: 94,  h: 94  },
    nautolanBattlecruiser:{ w: 110, h: 110 },
    nautolanDreadnought:  { w: 142, h: 142 }
  },
  pickups: { w: 46, h: 46 },
  planet:  { w: 190, h: 190 },
  asteroid:{ wMin: 24, wMax: 46 }
};

export const STRIP_RATIO = 2.2;

export const CONTROL_CONFIG = {
  // Applied only on touch input: ship leads the finger by this many design-pixels upward.
  // Keeps the ship visible above the thumb. Clamped so ship can't leave the play area.
  touchOffsetY: 110,
  // No horizontal offset — lateral precision matters more than thumb coverage.
  touchOffsetX: 0,
  // Mouse/desktop: zero offset, ship follows cursor directly.
  mouseOffsetY: 0,
};

export const SECTORS = [
  {
    index: 0,
    name: "Kla'ed Frontier",
    shortName: "SECTOR I",
    duration: 65,
    fleet: "klaed",
    tint: [30, 60, 140],
    spawnMult: 0.9,       // ~10% fewer regular spawns than formula baseline
    enemySpeedMult: 0.9   // regular enemies 10% slower; does not affect boss
  },
  {
    index: 1,
    name: "Nairan Expanse",
    shortName: "SECTOR II",
    duration: 90,
    fleet: "nairan",
    tint: [100, 30, 140],
    spawnMult: 1.0,
    enemySpeedMult: 1.0
  },
  {
    index: 2,
    name: "Nautolan Depths",
    shortName: "SECTOR III",
    duration: 105,
    fleet: "nautolan",
    tint: [30, 110, 80],
    spawnMult: 1.0,
    enemySpeedMult: 1.0
  },
  {
    index: 3,
    name: "Void Core",
    shortName: "SECTOR IV",
    duration: 115,
    fleet: "nautolan",
    tint: [140, 30, 30],
    spawnMult: 1.0,
    enemySpeedMult: 1.0
  }
];
