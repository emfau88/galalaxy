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

export const NAIRAN_VISUALS = {
  scout: { frame: 64, engine: { assetKey: "nairanScoutEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nairanScoutWeapon", frameCount: 6, releaseFrame: 2, fps: 10 }, shield: { assetKey: "nairanScoutShield", frameCount: 18, fps: 10 }, destruction: { assetKey: "nairanScoutDestruction", frameCount: 16, fps: 14 } },
  fighter: { frame: 64, engine: { assetKey: "nairanFighterEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nairanFighterWeapon", frameCount: 28, releaseFrame: 11, fps: 12 }, shield: { assetKey: "nairanFighterShield", frameCount: 20, fps: 10 }, destruction: { assetKey: "nairanFighterDestruction", frameCount: 18, fps: 14 } },
  bomber: { frame: 64, engine: { assetKey: "nairanBomberEngine", frameCount: 8, fps: 10 }, weapon: null, shield: { assetKey: "nairanBomberShield", frameCount: 10, fps: 10 }, destruction: { assetKey: "nairanBomberDestruction", frameCount: 16, fps: 14 } },
  frigate: { frame: 64, engine: { assetKey: "nairanFrigateEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nairanFrigateWeapon", frameCount: 5, releaseFrame: 2, fps: 10 }, shield: { assetKey: "nairanFrigateShield", frameCount: 8, fps: 10 }, destruction: { assetKey: "nairanFrigateDestruction", frameCount: 16, fps: 14 } },
  battlecruiser: { frame: 128, engine: { assetKey: "nairanBattlecruiserEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nairanBattlecruiserWeapon", frameCount: 9, releaseFrame: 3, fps: 10 }, shield: { assetKey: "nairanBattlecruiserShield", frameCount: 8, fps: 10 }, destruction: { assetKey: "nairanBattlecruiserDestruction", frameCount: 18, fps: 14 } },
  dreadnought: { frame: 128, engine: { assetKey: "nairanDreadnoughtEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nairanDreadnoughtWeapon", frameCount: 34, releaseFrame: 14, fps: 12 }, shield: { assetKey: "nairanDreadnoughtShield", frameCount: 8, fps: 10 }, destruction: { assetKey: "nairanDreadnoughtDestruction", frameCount: 18, fps: 14 } },
};

export const NAUTOLAN_VISUALS = {
  scout: { frame: 64, engine: { assetKey: "nautolanScoutEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nautolanScoutWeapon", frameCount: 7, releaseFrame: 2, fps: 10 }, shield: { assetKey: "nautolanScoutShield", frameCount: 13, fps: 10 }, destruction: { assetKey: "nautolanScoutDestruction", frameCount: 9, fps: 14 } },
  fighter: { frame: 64, engine: { assetKey: "nautolanFighterEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nautolanFighterWeapon", frameCount: 9, releaseFrame: 3, fps: 10 }, shield: { assetKey: "nautolanFighterShield", frameCount: 10, fps: 10 }, destruction: { assetKey: "nautolanFighterDestruction", frameCount: 9, fps: 14 } },
  bomber: { frame: 64, engine: { assetKey: "nautolanBomberEngine", frameCount: 8, fps: 10 }, weapon: null, shield: { assetKey: "nautolanBomberShield", frameCount: 10, fps: 10 }, destruction: { assetKey: "nautolanBomberDestruction", frameCount: 10, fps: 14 } },
  frigate: { frame: 64, engine: { assetKey: "nautolanFrigateEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nautolanFrigateWeapon", frameCount: 9, releaseFrame: 3, fps: 10 }, shield: { assetKey: "nautolanFrigateShield", frameSize: 63, frameCount: 36, fps: 12 }, destruction: { assetKey: "nautolanFrigateDestruction", frameCount: 9, fps: 14 } },
  battlecruiser: { frame: 128, engine: { assetKey: "nautolanBattlecruiserEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nautolanBattlecruiserWeapon", frameCount: 9, releaseFrame: 3, fps: 10 }, shield: { assetKey: "nautolanBattlecruiserShield", frameCount: 11, fps: 10 }, destruction: { assetKey: "nautolanBattlecruiserDestruction", frameCount: 13, fps: 14 } },
  dreadnought: { frame: 128, engine: { assetKey: "nautolanDreadnoughtEngine", frameCount: 8, fps: 10 }, weapon: { assetKey: "nautolanDreadnoughtWeapon", frameCount: 35, releaseFrame: 14, fps: 12 }, shield: { assetKey: "nautolanDreadnoughtShield", frameCount: 20, fps: 12 }, destruction: { assetKey: "nautolanDreadnoughtDestruction", frameCount: 12, fps: 14 } },
};

export function enemyVisualFor(type) {
  const key = (type.replace(/^nairan|^nautolan/, "") || type).toLowerCase();
  if (type.startsWith("nairan")) return NAIRAN_VISUALS[key] || null;
  if (type.startsWith("nautolan")) return NAUTOLAN_VISUALS[key] || null;
  return KLAED_VISUALS[key] || null;
}
