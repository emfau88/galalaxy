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
    // Release early: the ship may keep moving, so a long wind-up made a
    // close-range lightning cast feel detached from the player's action.
    releaseFrames: [3],
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
