// Curated encounter blocks replace the old continuous random spawn stream.
// Cards describe a readable 8-12 second danger window; sector profiles decide
// which cards are taught, repeated, and combined. Every card reserves a named
// escape corridor that its spawn layout must keep open.

// Formation slots use travel-relative coordinates. `across` is perpendicular
// to the shared flight vector and `trail` is the distance behind the leading
// ship. Every member therefore keeps the authored silhouette for the complete
// pass instead of independently chasing or wobbling out of shape.
export const FORMATION_SHAPES = Object.freeze({
  chevron: Object.freeze([
    Object.freeze({ across: 0, trail: 0 }),
    Object.freeze({ across: -42, trail: 34 }),
    Object.freeze({ across: 42, trail: 34 }),
    Object.freeze({ across: -82, trail: 68 }),
    Object.freeze({ across: 82, trail: 68 }),
  ]),
  "split-v": Object.freeze([
    Object.freeze({ across: -24, trail: 0 }),
    Object.freeze({ across: 24, trail: 0 }),
    Object.freeze({ across: -62, trail: 34 }),
    Object.freeze({ across: 62, trail: 34 }),
    Object.freeze({ across: -100, trail: 68 }),
    Object.freeze({ across: 100, trail: 68 }),
  ]),
  escort: Object.freeze([
    Object.freeze({ across: 0, trail: 36 }),
    Object.freeze({ across: -58, trail: 0 }),
    Object.freeze({ across: 58, trail: 0 }),
    Object.freeze({ across: -58, trail: 76 }),
    Object.freeze({ across: 58, trail: 76 }),
  ]),
  spearhead: Object.freeze([
    Object.freeze({ across: 0, trail: 0 }),
    Object.freeze({ across: -38, trail: 34 }),
    Object.freeze({ across: 38, trail: 34 }),
    Object.freeze({ across: -76, trail: 68 }),
    Object.freeze({ across: 76, trail: 68 }),
    Object.freeze({ across: -114, trail: 102 }),
    Object.freeze({ across: 114, trail: 102 }),
  ]),
});

export const WAVE_CARDS = Object.freeze({
  "single-file": Object.freeze({
    id: "single-file",
    duration: 9,
    safeCorridor: "right",
    tags: ["baseline", "formation"],
    events: [0, 1.6, 3.2, 4.8, 6.4].map((at, index) => ({
      at, role: index < 3 ? "light" : "skirmisher", count: 1,
      entry: index % 2 ? "top-left" : "top-center",
    })),
  }),
  "open-v": Object.freeze({
    id: "open-v",
    duration: 11,
    safeCorridor: "center",
    tags: ["baseline", "formation"],
    formation: true,
    suppressPressure: true,
    pressureResumeAt: 5.5,
    entryCap: 1,
    events: [
      { at: 0, role: "light", count: 5, entry: "top-center", formation: "chevron", flightSpeed: 92 },
      { at: 6.0, role: "shooter", count: 1, entry: "top-edge", fireDelay: 0.9 },
    ],
  }),
  "split-v": Object.freeze({
    id: "split-v",
    duration: 11,
    safeCorridor: "lower-opposite",
    tags: ["formation", "side", "nairan"],
    formation: true,
    suppressPressure: true,
    pressureResumeAt: 5,
    entryCap: 1,
    events: [
      {
        at: 0, role: "light", count: 6, entry: "side-alternating", band: "upper",
        formation: "split-v", flightSpeed: 104, fireDelay: 0.7,
        roles: ["light", "light", "skirmisher", "skirmisher", "light", "light"],
      },
    ],
  }),
  "side-sweep": Object.freeze({
    id: "side-sweep",
    duration: 8.5,
    safeCorridor: "lower",
    tags: ["speed", "side"],
    events: [
      { at: 0, role: "light", count: 2, entry: "side-left", band: "upper" },
      { at: 3.2, role: "skirmisher", count: 2, entry: "side-right", band: "middle" },
      { at: 5.8, role: "shooter", count: 1, entry: "top-edge", fireDelay: 0.8 },
    ],
  }),
  "precision-cross": Object.freeze({
    id: "precision-cross",
    duration: 10,
    safeCorridor: "lower-center",
    tags: ["precision", "side"],
    events: [
      { at: 0, role: "skirmisher", count: 2, entry: "side-left", band: "upper" },
      { at: 2.8, role: "shooter", count: 1, entry: "top-left", fireDelay: 0.65 },
      { at: 5.2, role: "skirmisher", count: 2, entry: "side-right", band: "middle" },
    ],
  }),
  "anchor-corridor": Object.freeze({
    id: "anchor-corridor",
    duration: 11,
    safeCorridor: "center",
    tags: ["control", "heavy"],
    events: [
      { at: 0, role: "shooter", count: 2, entry: "top-edges", fireDelay: 1.0 },
      { at: 4.2, role: "heavy", count: 1, entry: "top-edge", fireDelay: 1.2 },
    ],
  }),
  "hammer-wing": Object.freeze({
    id: "hammer-wing",
    duration: 10.5,
    safeCorridor: "opposite-side",
    tags: ["control", "mixed"],
    events: [
      { at: 0, role: "heavy", count: 1, entry: "top-left", fireDelay: 1.0 },
      { at: 2.6, role: "light", count: 3, entry: "side-right", band: "upper" },
      { at: 6.2, role: "shooter", count: 1, entry: "top-right", fireDelay: 0.9 },
    ],
  }),
  "escort-box": Object.freeze({
    id: "escort-box",
    duration: 11,
    safeCorridor: "outer-lanes",
    tags: ["formation", "control", "escort"],
    formation: true,
    suppressPressure: true,
    pressureResumeAt: 4,
    entryCap: 1,
    events: [
      {
        at: 0, role: "light", count: 5, entry: "top-center",
        formation: "escort", flightSpeed: 84, fireDelay: 0.9,
        roles: ["shooter", "light", "light", "skirmisher", "skirmisher"],
      },
    ],
  }),
  "finale-relay": Object.freeze({
    id: "finale-relay",
    duration: 12,
    safeCorridor: "alternating",
    tags: ["speed", "precision", "control", "finale"],
    events: [
      { at: 0, role: "light", count: 2, entry: "side-left", band: "upper" },
      { at: 3.1, role: "shooter", count: 2, entry: "top-edges", fireDelay: 0.8 },
      { at: 6.4, role: "skirmisher", count: 2, entry: "side-right", band: "middle" },
    ],
  }),
  "finale-spear": Object.freeze({
    id: "finale-spear",
    duration: 12,
    safeCorridor: "edge-choice",
    tags: ["formation", "finale", "mixed"],
    formation: true,
    suppressPressure: true,
    pressureResumeAt: 4.5,
    entryCap: 1,
    events: [
      {
        at: 0, role: "light", count: 7, entry: "top-center",
        formation: "spearhead", flightSpeed: 88, fireDelay: 0.8,
        roles: ["shooter", "light", "light", "skirmisher", "skirmisher", "light", "light"],
      },
    ],
  }),
  "torpedo-lock": Object.freeze({
    id: "torpedo-lock",
    duration: 9,
    safeCorridor: "side-step",
    tags: ["precision", "torpedo", "teaching"],
    elite: true,
    suppressPressure: true,
    entryCap: 2,
    enemyCap: 4,
    events: [
      { at: 0, role: "torpedo", count: 1, entry: "top-center", fireDelay: 1.0 },
      { at: 3.8, role: "skirmisher", count: 2, entry: "side-left", band: "upper" },
    ],
  }),
  "support-screen": Object.freeze({
    id: "support-screen",
    duration: 9,
    safeCorridor: "opposite-support",
    tags: ["control", "support", "priority"],
    elite: true,
    suppressPressure: true,
    entryCap: 2,
    enemyCap: 4,
    events: [
      { at: 0, role: "support", count: 1, entry: "top-right" },
      { at: 0.6, role: "heavy", count: 1, entry: "top-left", fireDelay: 1.1 },
      { at: 2.8, role: "shooter", count: 1, entry: "top-right", fireDelay: 0.9 },
    ],
  }),
});

export const SECTOR_ENCOUNTER_PROFILES = Object.freeze([
  Object.freeze({
    id: "frontier-training",
    identity: "readable formations backed by a restrained pursuit stream",
    enemyCap: 8,
    projectileCap: 12,
    openingDelay: 1.2,
    openingWave: "single-file",
    pressureDelay: 10,
    pressureInterval: [1.30, 1.44],
    pursuitChance: 0.55,
    pursuitCap: 3,
    pressureRoles: ["light", "light", "skirmisher", "shooter"],
    recovery: [4.2, 5],
    earlyDeck: ["single-file"],
    midDeck: ["single-file", "open-v"],
    lateDeck: ["open-v", "anchor-corridor", "open-v"],
  }),
  Object.freeze({
    id: "nairan-precision",
    identity: "fast side attacks, active hunters, and committed precision shots",
    enemyCap: 10,
    projectileCap: 16,
    openingDelay: 3.6,
    openingWave: "side-sweep",
    pressureDelay: 3,
    pressureInterval: [0.90, 1.04],
    pursuitChance: 0.5,
    pursuitCap: 4,
    pressureRoles: ["light", "skirmisher", "skirmisher", "shooter"],
    recovery: [3.4, 4.3],
    earlyDeck: ["side-sweep", "split-v"],
    midDeck: ["split-v", "precision-cross", "open-v", "torpedo-lock"],
    lateDeck: ["precision-cross", "split-v", "torpedo-lock"],
  }),
  Object.freeze({
    id: "nautolan-control",
    identity: "slow anchors and persistent hunters that control space while preserving corridors",
    enemyCap: 9,
    projectileCap: 16,
    openingDelay: 4.2,
    openingWave: "anchor-corridor",
    pressureDelay: 2.5,
    pressureInterval: [0.95, 1.08],
    pursuitChance: 0.3,
    pursuitCap: 3,
    pressureRoles: ["skirmisher", "shooter", "shooter"],
    recovery: [4.1, 5],
    earlyDeck: ["anchor-corridor", "open-v"],
    midDeck: ["anchor-corridor", "escort-box", "support-screen"],
    lateDeck: ["escort-box", "hammer-wing", "support-screen"],
  }),
  Object.freeze({
    id: "void-combination",
    identity: "relentless pursuit combining speed, precision, and space control",
    enemyCap: 10,
    projectileCap: 17,
    openingDelay: 4,
    openingWave: "finale-relay",
    pressureDelay: 2,
    pressureInterval: [0.85, 0.98],
    pursuitChance: 0.25,
    pursuitCap: 4,
    pressureRoles: ["light", "skirmisher", "shooter", "shooter"],
    recovery: [3.5, 4.5],
    earlyDeck: ["side-sweep", "finale-spear", "finale-relay"],
    midDeck: ["precision-cross", "finale-spear", "support-screen", "finale-relay"],
    lateDeck: ["finale-spear", "precision-cross", "hammer-wing", "support-screen"],
  }),
]);

export const FLEET_ROLE_POOLS = Object.freeze({
  klaed: Object.freeze({
    light: ["scout"],
    skirmisher: ["fighter", "scout"],
    shooter: ["bomber", "frigate"],
    heavy: ["frigate", "battlecruiser"],
  }),
  nairan: Object.freeze({
    light: ["nairanScout"],
    skirmisher: ["nairanFighter", "nairanScout"],
    shooter: ["nairanBomber", "nairanFrigate"],
    heavy: ["nairanFrigate", "nairanBattlecruiser"],
    torpedo: ["nairanTorpedoShip"],
  }),
  nautolan: Object.freeze({
    light: ["nautolanScout"],
    skirmisher: ["nautolanFighter", "nautolanScout"],
    shooter: ["nautolanBomber", "nautolanFrigate"],
    heavy: ["nautolanFrigate", "nautolanBattlecruiser"],
    support: ["nautolanSupport"],
  }),
  void: Object.freeze({
    light: ["nairanScout", "nautolanScout"],
    skirmisher: ["nairanFighter", "nautolanFighter"],
    shooter: ["nairanFrigate", "nautolanFrigate"],
    heavy: ["nairanBattlecruiser", "nautolanBattlecruiser"],
    torpedo: ["nairanTorpedoShip"],
    support: ["nautolanSupport"],
  }),
});

export function encounterProfileFor(sectorIndex) {
  return SECTOR_ENCOUNTER_PROFILES[sectorIndex] || SECTOR_ENCOUNTER_PROFILES[0];
}

export function createEncounterDirector(sectorIndex) {
  const profile = encounterProfileFor(sectorIndex);
  return {
    sectorIndex,
    profileId: profile.id,
    phase: "recovery",
    timer: profile.openingDelay,
    phaseDuration: profile.openingDelay,
    waveId: null,
    eventIndex: 0,
    waveElapsed: 0,
    lastWaveId: null,
    waveCount: 0,
    enemyCap: profile.enemyCap,
    projectileCap: profile.projectileCap,
    pendingEvents: [],
    pressureTimer: profile.pressureDelay,
    pressureCount: 0,
    formationCount: 0,
  };
}

export function pressureIntervalFor(profile, roll = Math.random()) {
  const [minimum, maximum] = profile.pressureInterval;
  return minimum + roll * (maximum - minimum);
}

export function pickPressureRole(profile, progress, roll = Math.random()) {
  const roles = profile.pressureRoles;
  // Keep the opening readable. The latter half gradually shifts one slot
  // toward the more demanding end of the authored role list.
  const adjusted = progress < 0.45 ? roll : Math.min(0.999, roll + 0.12);
  return roles[Math.min(roles.length - 1, Math.floor(adjusted * roles.length))];
}

export function deckForProgress(profile, progress, sectorElapsed = 0) {
  // Preserve the calm Sector-I teaching period: no dense formation card before
  // the player has had 25 active seconds to learn movement and auto-fire.
  if (profile.id === "frontier-training" && sectorElapsed < 25) return profile.earlyDeck;
  if (progress < 0.38) return profile.earlyDeck;
  if (progress < 0.74) return profile.midDeck;
  return profile.lateDeck;
}

export function pickWaveCard(profile, progress, sectorElapsed, lastWaveId, roll = Math.random()) {
  if (!lastWaveId && profile.openingWave) return WAVE_CARDS[profile.openingWave];
  const deck = deckForProgress(profile, progress, sectorElapsed);
  const choices = deck.length > 1 ? deck.filter(id => id !== lastWaveId) : deck;
  const pool = choices.length ? choices : deck;
  const index = Math.min(pool.length - 1, Math.floor(roll * pool.length));
  return WAVE_CARDS[pool[index]];
}

export function pickRoleEnemy(fleetId, role, progress, roll = Math.random()) {
  const pool = FLEET_ROLE_POOLS[fleetId]?.[role] || FLEET_ROLE_POOLS.klaed.light;
  // Early waves favor the first, gentler member of each role pool. The second
  // member becomes more common as the sector matures.
  if (pool.length === 1 || progress < 0.35 || roll < 0.58) return pool[0];
  return pool[Math.min(pool.length - 1, 1 + Math.floor(roll * (pool.length - 1)))];
}
