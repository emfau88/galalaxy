# Design Backlog

## Player hull tiers — parked concept

The initial four-hull concept board is kept at
`docs/concepts/player-hull-tier-concepts-2026-09-03.png`.

It is a direction-setting concept only, not a production asset. Before
implementation, the selected direction needs a dedicated 48×48 pixel-art
production pass with four damage states per hull tier.

### Integration rules

- Keep the current 48×48 center registration and nose-up orientation.
- Hull sprites contain only the chassis: no weapons, shield, engine flames,
  projectiles, or baked-in effects.
- Keep the existing runtime layer order: engine effect, engine module, hull,
  passive plating, Auto Cannon, Rockets, Zapper, Big Space Gun, active weapon
  frame, shield, and invulnerability effect.
- Create four tiers (MK I Scout, MK II Combat, MK III Warship, MK IV Flagship)
  and four hull-damage states per tier.
- Do not create every weapon combination as a separate sprite; modules remain
  independent overlays.

## Next UX track — HUD and upgrade cards

Prioritize mobile readability in combat, then make each upgrade choice reveal
the actual installed module and the exact gameplay consequence. Reuse authored
module, shield, engine, projectile, and pickup assets where they communicate a
real system; do not use unrelated pickup art as a substitute for a missing
upgrade visual.
