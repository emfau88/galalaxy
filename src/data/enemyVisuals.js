// Authored layer metadata for the currently playable Kla'ed fleet. Keeping
// frames, firing beats and source sizes together makes the other fleet packs a
// straightforward data addition instead of a second renderer.
const KLAED_ROOT = "klaed";

export const KLAED_VISUALS = {
  scout: {
    frame: 64, engine: { assetKey: `${KLAED_ROOT}ScoutEngine`, frameCount: 10, fps: 10 },
    weapon: { assetKey: `${KLAED_ROOT}ScoutWeapon`, frameCount: 6, releaseFrame: 2, fps: 10 },
    shield: { assetKey: `${KLAED_ROOT}ScoutShield`, frameCount: 14, fps: 10 },
    destruction: { assetKey: `${KLAED_ROOT}ScoutDestruction`, frameCount: 10, fps: 14 },
  },
  fighter: {
    frame: 64, engine: { assetKey: `${KLAED_ROOT}FighterEngine`, frameCount: 10, fps: 10 },
    weapon: { assetKey: `${KLAED_ROOT}FighterWeapon`, frameCount: 6, releaseFrame: 2, fps: 10 },
    shield: { assetKey: `${KLAED_ROOT}FighterShield`, frameCount: 10, fps: 10 },
    destruction: { assetKey: `${KLAED_ROOT}FighterDestruction`, frameCount: 9, fps: 14 },
  },
  bomber: {
    frame: 64, engine: { assetKey: `${KLAED_ROOT}BomberEngine`, frameCount: 10, fps: 10 },
    weapon: null,
    shield: { assetKey: `${KLAED_ROOT}BomberShield`, frameCount: 6, fps: 10 },
    destruction: { assetKey: `${KLAED_ROOT}BomberDestruction`, frameCount: 8, fps: 14 },
  },
  frigate: {
    frame: 64, engine: { assetKey: `${KLAED_ROOT}FrigateEngine`, frameCount: 12, fps: 10 },
    weapon: { assetKey: `${KLAED_ROOT}FrigateWeapon`, frameCount: 6, releaseFrame: 2, fps: 10 },
    shield: { assetKey: `${KLAED_ROOT}FrigateShield`, frameCount: 40, fps: 12 },
    destruction: { assetKey: `${KLAED_ROOT}FrigateDestruction`, frameCount: 9, fps: 14 },
  },
  battlecruiser: {
    frame: 128, engine: { assetKey: `${KLAED_ROOT}BattlecruiserEngine`, frameCount: 12, fps: 10 },
    weapon: { assetKey: `${KLAED_ROOT}BattlecruiserWeapon`, frameCount: 30, releaseFrame: 11, fps: 12 },
    shield: { assetKey: `${KLAED_ROOT}BattlecruiserShield`, frameCount: 16, fps: 10 },
    destruction: { assetKey: `${KLAED_ROOT}BattlecruiserDestruction`, frameCount: 14, fps: 14 },
  },
  dreadnought: {
    frame: 128, engine: { assetKey: `${KLAED_ROOT}DreadnoughtEngine`, frameCount: 12, fps: 10 },
    weapon: { assetKey: `${KLAED_ROOT}DreadnoughtWeapon`, frameCount: 60, releaseFrame: 22, fps: 12 },
    shield: { assetKey: `${KLAED_ROOT}DreadnoughtShield`, frameCount: 10, fps: 10 },
    destruction: { assetKey: `${KLAED_ROOT}DreadnoughtDestruction`, frameCount: 12, fps: 14 },
  },
};

export function enemyVisualFor(type) {
  const key = type.replace(/^nairan|^nautolan/, "") || type;
  return KLAED_VISUALS[key] || null;
}
