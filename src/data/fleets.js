// Fleet definitions — enemy types, spawn weights, and boss per fleet.
// Sector difficulty progresses from index 0 → 3; weights reflect escalation.

export const FLEETS = {
  klaed: {
    bossType: "dreadnought",
    // spawnBias: cumulative weights by sector progress phase (early / mid / late)
    phases: [
      { scout: 0.60, fighter: 0.30, bomber: 0.10 },                             // sector start
      { scout: 0.40, fighter: 0.35, bomber: 0.20, frigate: 0.05 },              // mid
      { scout: 0.25, fighter: 0.30, bomber: 0.25, frigate: 0.15, battlecruiser: 0.05 } // late
    ]
  },

  nairan: {
    bossType: "nairanDreadnought",
    // Nairan: faster, more fighters and frigates — midrange threat focus
    phases: [
      { nairanScout: 0.50, nairanFighter: 0.35, nairanBomber: 0.15 },
      { nairanScout: 0.30, nairanFighter: 0.35, nairanBomber: 0.20, nairanFrigate: 0.15 },
      { nairanScout: 0.20, nairanFighter: 0.28, nairanBomber: 0.22, nairanFrigate: 0.20, nairanBattlecruiser: 0.10 }
    ]
  },

  nautolan: {
    bossType: "nautolanDreadnought",
    // Nautolan: slower, heavier — more bombers, frigates, and cruisers
    phases: [
      { nautolanScout: 0.45, nautolanFighter: 0.30, nautolanBomber: 0.25 },
      { nautolanScout: 0.25, nautolanFighter: 0.25, nautolanBomber: 0.28, nautolanFrigate: 0.22 },
      { nautolanScout: 0.15, nautolanFighter: 0.18, nautolanBomber: 0.25, nautolanFrigate: 0.25, nautolanBattlecruiser: 0.17 }
    ]
  }
};

function _pickFromBias(bias) {
  const roll = Math.random();
  let acc = 0;
  for (const [type, weight] of Object.entries(bias)) {
    acc += weight;
    if (roll < acc) return type;
  }
  return Object.keys(bias)[0];
}

// Standard pick — used for formations (scouts/fighters expected).
export function pickFleetEnemy(fleet, sectorProgress) {
  const phaseIndex = sectorProgress < 0.4 ? 0 : sectorProgress < 0.75 ? 1 : 2;
  return _pickFromBias(fleet.phases[phaseIndex]);
}

// Solo-chaser pick — scouts/fighters halved in weight so heavier units dominate solo spawns.
export function pickSoloEnemy(fleet, sectorProgress) {
  const phaseIndex = sectorProgress < 0.4 ? 0 : sectorProgress < 0.75 ? 1 : 2;
  const base = fleet.phases[phaseIndex];
  const adjusted = {};
  let total = 0;
  for (const [type, w] of Object.entries(base)) {
    const iw = /scout|fighter/i.test(type) ? w * 0.4 : w;
    adjusted[type] = iw;
    total += iw;
  }
  // Renormalize
  for (const t of Object.keys(adjusted)) adjusted[t] /= total;
  return _pickFromBias(adjusted);
}
