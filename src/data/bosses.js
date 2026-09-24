export const BOSS_PROFILES = Object.freeze({
  dreadnought: Object.freeze({
    id: "klaed-command",
    name: "KLA'ED IRON DREAD",
    intro: "TORPEDO AND WAVE PLATFORM DETECTED",
    maxHp: 1560,
    maxShield: 250,
    bossXp: 12,
    movement: "broad-sweep",
    aura: "#ff4f55",
    phaseThresholds: [],
  }),
  nairanDreadnought: Object.freeze({
    id: "nairan-lancer",
    name: "NAIRAN LANCER",
    intro: "PRECISION LOCK ARRAY CHARGING",
    maxHp: 1800,
    maxShield: 290,
    bossXp: 14,
    movement: "lateral-lancer",
    aura: "#c66cff",
    phaseThresholds: [0.6, 0.3],
  }),
  nautolanDreadnought: Object.freeze({
    id: "nautolan-warden",
    name: "ABYSSAL WARDEN",
    intro: "CONTROL MATRIX AND SUPPORT LINK DETECTED",
    maxHp: 2160,
    maxShield: 350,
    bossXp: 16,
    movement: "anchored-control",
    aura: "#39d6aa",
    phaseThresholds: [0.6, 0.3],
  }),
  voidSovereign: Object.freeze({
    id: "void-sovereign",
    name: "VOID SOVEREIGN",
    intro: "THREE-PHASE CORE SIGNATURE DETECTED",
    maxHp: 3120,
    maxShield: 520,
    bossXp: 22,
    movement: "void-orbit",
    aura: "#d34768",
    phaseThresholds: [0.6, 0.3],
  }),
});

export function bossProfileFor(type) {
  return BOSS_PROFILES[type] || null;
}
