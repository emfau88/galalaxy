// Projectile visual configs keyed by visualKey.
// w/h: render size in canvas pixels. rotOffset: added to travel angle before drawing.
// color/glowColor: fallback canvas draw when assetKey is null or image fails to load.
export const PROJECTILE_VISUALS = {
  // --- Player ---
  laser:  { assetKey: null, w: 18, h: 7,  rotOffset: 0, color: "#58e6ff", glowColor: "#58e6ff" },
  rocket: { assetKey: null, w: 22, h: 7,  rotOffset: 0, color: "#ffb347", glowColor: "#ffb347" },

  // --- Kla'ed ---
  // Bomber: deliberate canvas orb — feels like a raw energy shot, no asset needed
  klaedBomber:       { assetKey: null,          w: 11,  h: 11, rotOffset: 0,            color: "#ff466b", glowColor: "#ff2040" },
  klaedFrigate:      { assetKey: "klaedBullet", w: 18,  h: 18, rotOffset: Math.PI / 2,  color: "#ff466b", glowColor: "#ff2040" },
  klaedBattlecruiser:{ assetKey: "klaedRay",    w: 72,  h: 38, rotOffset: Math.PI / 2,  color: "#ff6680", glowColor: "#ff2040" },
  klaedBoss:         { assetKey: "klaedBigBullet", w: 32, h: 16, rotOffset: Math.PI / 2, color: "#ff8899", glowColor: "#ff2040" },

  // --- Nairan ---
  nairanBomber:       { assetKey: "nairanBolt",    w: 9,   h: 9,  rotOffset: Math.PI / 2, color: "#cc88ff", glowColor: "#aa44ff" },
  nairanFrigate:      { assetKey: "nairanRay",     w: 72,  h: 38, rotOffset: Math.PI / 2, color: "#cc88ff", glowColor: "#aa44ff" },
  nairanBattlecruiser:{ assetKey: "nairanRocket",  w: 16,  h: 16, rotOffset: Math.PI / 2, color: "#dd99ff", glowColor: "#aa44ff" },
  nairanBoss:         { assetKey: "nairanTorpedo", w: 27,  h: 24, rotOffset: Math.PI / 2, color: "#ee99ff", glowColor: "#aa44ff" },

  // --- Nautolan ---
  nautolanBomber:       { assetKey: "nautolanSpinningBullet", w: 16, h: 16, rotOffset: Math.PI / 2, color: "#44ffcc", glowColor: "#00ddaa" },
  nautolanFrigate:      { assetKey: "nautolanRay",            w: 72, h: 38, rotOffset: Math.PI / 2, color: "#44ffcc", glowColor: "#00ddaa" },
  nautolanBattlecruiser:{ assetKey: "nautolanRocket",         w: 32, h: 32, rotOffset: Math.PI / 2, color: "#66ffdd", glowColor: "#00ddaa" },
  nautolanBoss:         { assetKey: "nautolanBomb",           w: 16, h: 16, rotOffset: Math.PI / 2, color: "#88ffee", glowColor: "#00ddaa" },
};
