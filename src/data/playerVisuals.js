export const PLAYER_ANIMATION_FPS = 10;
export const PLAYER_MODULE_FRAME = 48;
export const PLAYER_SHIELD_FRAME = 64;

export const PLAYER_ENGINE_VISUALS = [
  {
    moduleKey: "playerEngine",
    idle: { assetKey: "engineBaseIdle", frameCount: 3 },
    powering: { assetKey: "engineBasePower", frameCount: 4 },
  },
  {
    moduleKey: "playerEnginePulse",
    idle: { assetKey: "enginePulseIdle", frameCount: 4 },
    powering: { assetKey: "enginePulsePower", frameCount: 4 },
  },
  {
    moduleKey: "playerEngineBurst",
    idle: { assetKey: "engineBurstIdle", frameCount: 7 },
    powering: { assetKey: "engineBurstPower", frameCount: 6 },
  },
  {
    moduleKey: "playerEngineSuper",
    idle: { assetKey: "engineSuperIdle", frameCount: 4 },
    powering: { assetKey: "engineSuperPower", frameCount: 4 },
  },
];

export const PLAYER_SHIELD_VISUALS = [
  { assetKey: "shieldFront", frameCount: 10 },
  { assetKey: "shieldFrontSide", frameCount: 6 },
  { assetKey: "shieldRound", frameCount: 12 },
];

export const PLAYER_INVINCIBILITY_VISUAL = {
  assetKey: "shieldInvincible",
  frameCount: 10,
};

export const PLAYER_WEAPON_VISUALS = {
  auto: {
    assetKey: "weaponAuto",
    projectileKey: "playerAuto",
    activePriority: 1,
    frameCount: 7,
    releaseFrames: [3],
    muzzles: [{ x: -17, y: -29 }, { x: 17, y: -29 }],
  },
  rockets: {
    assetKey: "weaponRockets",
    projectileKey: "playerRocket",
    activePriority: 2,
    frameCount: 17,
    releaseFrames: [3, 7, 11],
    muzzles: [{ x: -27, y: -23 }, { x: 27, y: -23 }],
  },
  zapper: {
    assetKey: "weaponZapper",
    projectileKey: "playerZapper",
    activePriority: 3,
    frameCount: 14,
    releaseFrames: [8],
    muzzles: [{ x: 0, y: -30 }],
  },
  bigGun: {
    assetKey: "weaponBigGun",
    projectileKey: "playerBigGun",
    activePriority: 4,
    frameCount: 12,
    releaseFrames: [7],
    muzzles: [{ x: 0, y: -31 }],
  },
};

export function playerEngineVisual(level) {
  return PLAYER_ENGINE_VISUALS[Math.min(PLAYER_ENGINE_VISUALS.length - 1, Math.max(0, level))];
}

export function playerShieldVisual(level) {
  return PLAYER_SHIELD_VISUALS[Math.min(PLAYER_SHIELD_VISUALS.length - 1, Math.max(0, level))];
}

// The Foozle weapon sprites share one 48x48 mounting space. Choosing one
// dominant system keeps the silhouette readable instead of stacking sprites.
export function playerWeaponVisualKey(player) {
  if (player.keystoneId === "overcharged") return "zapper";
  if (player.keystoneId === "siege") return "rockets";

  const scores = {
    auto: player.fireLevel > 0 || player.twin > 0
      ? 1 + Math.min(4, player.twin) + Math.min(5, player.fireLevel) * 0.35
      : -1,
    rockets: player.rocket > 0 && !player.rocketDisabled ? player.rocket + player.barrage * 2 : -1,
    zapper: player.zapper > 0 ? player.zapper : -1,
    bigGun: player.beam > 0 ? player.beam * 3 : -1,
  };

  return Object.entries(scores).reduce(
    (best, entry) => entry[1] > best[1] ? entry : best,
    [null, -1],
  )[0];
}
