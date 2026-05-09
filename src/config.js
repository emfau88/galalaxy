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
  playerEngine: { w: 48, h: 48 },
  playerShield: { w: 92, h: 92 },
  enemies: {
    scout:        { w: 34,  h: 34  },
    fighter:      { w: 42,  h: 42  },
    bomber:       { w: 54,  h: 54  },
    frigate:      { w: 68,  h: 68  },
    battlecruiser:{ w: 82,  h: 82  },
    dreadnought:  { w: 120, h: 120 }
  },
  pickups: { w: 46, h: 46 },
  planet:  { w: 190, h: 190 },
  asteroid:{ wMin: 24, wMax: 46 }
};

export const STRIP_RATIO = 2.2;
