// Projectile visual configs keyed by visualKey.
// w/h: render bounds in canvas pixels. rotOffset: added to travel angle before drawing.
// frameW/frameH/frameCount/fps: explicit horizontal sprite-strip metadata exported
// from the source Aseprite files. Keeping this data explicit avoids mistaking a
// complete animation strip for one projectile image.
// color/glowColor: fallback canvas draw when assetKey is null or image fails to load.
export const PROJECTILE_VISUALS = {
  // --- Player ---
  // Ship modules and projectiles share 32px source cells, but their visible
  // pixel silhouettes are very different. Tune them as weapons, not as hull
  // attachments: cannon rounds stay nimble while rockets read as the heavier
  // payload at a glance.
  // The auto-cannon's bright sprite has a deceptively heavy silhouette; keep
  // it tight so a multi-shot volley reads as precision fire rather than a wall.
  playerAuto:   { assetKey: "projectileAuto",   w: 28, h: 28, rotOffset: Math.PI / 2, color: "#58e6ff", glowColor: "#58e6ff", frameW: 32, frameH: 32, frameCount: 4,  fps: 10 },
  // Rocket source frames are intentionally thin. Width has to be amplified
  // independently of length so the flight reads as a physical missile, not a
  // small bright line with a long exhaust trail.
  playerRocket: { assetKey: "projectileRocket", w: 68, h: 68, scaleX: 1.35, rotOffset: Math.PI / 2, color: "#ffb347", glowColor: "#ff8a32", frameW: 32, frameH: 32, frameCount: 3,  fps: 10 },
  playerZapper: { assetKey: "projectileZapper", w: 51, h: 51, rotOffset: Math.PI / 2, color: "#dc78ff", glowColor: "#bd55ff", frameW: 32, frameH: 32, frameCount: 8,  fps: 10 },
  playerBigGun: { assetKey: "projectileBigGun", w: 51, h: 51, rotOffset: 0,           color: "#85ff8e", glowColor: "#4cff72", frameW: 32, frameH: 32, frameCount: 10, fps: 10 },

  // Legacy canvas fallbacks remain valid for old save/runtime call sites.
  laser:  { assetKey: null, w: 18, h: 7, rotOffset: 0, color: "#58e6ff", glowColor: "#58e6ff" },
  rocket: { assetKey: null, w: 22, h: 7, rotOffset: 0, color: "#ffb347", glowColor: "#ffb347" },

  // --- Kla'ed ---
  // Bomber: deliberate canvas orb — feels like a raw energy shot, no asset needed
  klaedBomber:       { assetKey: null,             w: 11, h: 11, rotOffset: 0,           color: "#ff466b", glowColor: "#ff2040" },
  klaedFrigate:      { assetKey: "klaedBullet",    w: 10, h: 24, rotOffset: Math.PI / 2, color: "#ff466b", glowColor: "#ff2040", frameW: 4,  frameH: 16, frameCount: 4, fps: 12 },
  klaedBattlecruiser:{ assetKey: "klaedRay",       w: 18, h: 38, rotOffset: Math.PI / 2, color: "#ff6680", glowColor: "#ff2040", frameW: 18, frameH: 38, frameCount: 4, fps: 12 },
  klaedBoss:         { assetKey: "klaedBigBullet", w: 14, h: 28, rotOffset: Math.PI / 2, color: "#ff8899", glowColor: "#ff2040", frameW: 8,  frameH: 16, frameCount: 4, fps: 10 },
  klaedTorpedo:      { assetKey: "klaedTorpedo",   w: 18, h: 38, rotOffset: Math.PI / 2, color: "#ff9166", glowColor: "#ff5428", frameW: 11, frameH: 32, frameCount: 3, fps: 10 },
  klaedWave:         { assetKey: "klaedWave",      w: 64, h: 24, scaleX: 2.4,  rotOffset: -Math.PI / 2, color: "#ffbb55", glowColor: "#ff7a22", frameW: 64, frameH: 64, frameCount: 6, fps: 12 },

  // --- Nairan ---
  nairanBomber:       { assetKey: "nairanBolt",    w: 12, h: 12, rotOffset: Math.PI / 2, color: "#cc88ff", glowColor: "#aa44ff", frameW: 9, frameH: 9,  frameCount: 5, fps: 14 },
  nairanFrigate:      { assetKey: "nairanRay",     w: 18, h: 38, rotOffset: Math.PI / 2, color: "#cc88ff", glowColor: "#aa44ff", frameW: 18, frameH: 38, frameCount: 4, fps: 14 },
  nairanBattlecruiser:{ assetKey: "nairanRocket",  w: 14, h: 25, rotOffset: Math.PI / 2, color: "#dd99ff", glowColor: "#aa44ff", frameW: 9, frameH: 16, frameCount: 4, fps: 12 },
  nairanBoss:         { assetKey: "nairanTorpedo", w: 15, h: 34, rotOffset: Math.PI / 2, color: "#ee99ff", glowColor: "#aa44ff", frameW: 9, frameH: 24, frameCount: 3, fps: 10 },

  // --- Nautolan ---
  nautolanBomber:       { assetKey: "nautolanSpinningBullet", w: 16, h: 16, rotOffset: Math.PI / 2, color: "#44ffcc", glowColor: "#00ddaa", frameW: 8,  frameH: 8,  frameCount: 8,  fps: 16 },
  nautolanFrigate:      { assetKey: "nautolanRay",            w: 18, h: 38, rotOffset: Math.PI / 2, color: "#44ffcc", glowColor: "#00ddaa", frameW: 18, frameH: 38, frameCount: 4,  fps: 10 },
  nautolanBattlecruiser:{ assetKey: "nautolanRocket",         w: 18, h: 36, rotOffset: Math.PI / 2, color: "#66ffdd", glowColor: "#00ddaa", frameW: 16, frameH: 32, frameCount: 6,  fps: 10 },
  nautolanBoss:         { assetKey: "nautolanBomb",           w: 24, h: 24, rotOffset: Math.PI / 2, color: "#88ffee", glowColor: "#00ddaa", frameW: 16, frameH: 16, frameCount: 16, fps: 18 },
};

// Enemy attack profiles deliberately separate threat roles. The projectile
// renderer owns sprite metadata above; these values own combat behaviour.
// Boss cadence and spread still live in Enemy so the existing phase rhythm is
// preserved, while speed/damage/steering come from the fleet weapon profile.
export const ENEMY_WEAPON_PROFILES = {
  // Kla'ed: readable baseline fleet.
  klaedBomber:        { speed: 180, damage: 8,  cooldown: 3.2, hitRadius: 6,   life: 3.4, behavior: "straight" },
  klaedFrigate:       { speed: 250, damage: 7,  cooldown: 2.5, hitRadius: 4,   life: 2.8, behavior: "straight" },
  klaedBattlecruiser: { speed: 355, damage: 10, cooldown: 3.1, hitRadius: 4.5, life: 2.2, behavior: "ray" },
  klaedBoss:          { speed: 275, damage: 12, cooldown: 1.1, wideCooldown: 1.6, hitRadius: 6, life: 3.3, behavior: "straight" },
  klaedTorpedo:       { speed: 132, damage: 15, cooldown: 4.2, hitRadius: 5, life: 4.8, behavior: "homing", turnRate: 0.92, homingDuration: 1.0, acceleration: 105 },
  klaedWave:          { speed: 210, damage: 10, cooldown: 4.8, hitRadius: 5, life: 3.4, behavior: "straight", hitWidth: 58, hitHeight: 12 },

  // Nairan: fast precision fire and gently tracking missiles.
  nairanBomber:        { speed: 315, damage: 7,  cooldown: 2.2, hitRadius: 4.5, life: 2.5, behavior: "straight" },
  nairanFrigate:       { speed: 410, damage: 9,  cooldown: 2.8, hitRadius: 4,   life: 1.9, behavior: "ray" },
  nairanBattlecruiser: { speed: 225, damage: 12, cooldown: 3.1, hitRadius: 6,   life: 3.8, behavior: "homing", turnRate: 0.72 },
  nairanBoss:          { speed: 210, damage: 14, cooldown: 1.1, wideCooldown: 1.6, hitRadius: 7, life: 4.2, behavior: "homing", turnRate: 0.42, acceleration: 16 },

  // Nautolan: slower, heavier projectiles with more commitment.
  nautolanBomber:        { speed: 205, damage: 10, cooldown: 3.0, hitRadius: 6,   life: 3.6, behavior: "straight" },
  nautolanFrigate:       { speed: 300, damage: 12, cooldown: 3.4, hitRadius: 5,   life: 2.7, behavior: "ray" },
  nautolanBattlecruiser: { speed: 165, damage: 16, cooldown: 3.8, hitRadius: 7.5, life: 4.8, behavior: "homing", turnRate: 0.38 },
  nautolanBoss:          { speed: 135, damage: 18, cooldown: 1.2, wideCooldown: 1.8, hitRadius: 9, life: 5.4, behavior: "heavy" },
};
