# Phase 1 — Technical Foundation Plan

## Goal

Prepare Galalaxy for reliable mobile releases without changing the current
gameplay, balance, visual identity, controls, or music-start behavior.

Phase 1 is intentionally split into small, independently testable changes.
Every work package should be committed separately and must leave the game in a
playable state.

## Current baseline

- 154 registered image assets; all referenced paths currently exist.
- Approximately 5.46 MB of registered PNG data.
- Approximately 83.6 MB estimated decoded image memory.
- Approximately 42 MB of decoded image memory belongs to seven UI images.
- `assets/` contains 511 files and approximately 24.47 MB, including source and
  preview files that are not required by the game.
- `track1.ogg` is approximately 5.66 MB and begins loading on page load.
- `game.js` contains approximately 2,441 lines.
- No automated smoke-test suite exists.
- The Nairan and Nautolan combat QA routes currently construct invalid enemy
  type names because of casing.

## Product decisions for this phase

- Music may continue loading and starting as early as browser autoplay rules
  allow. Moving music loading behind `START RUN` is explicitly out of scope.
- No weapon, enemy, upgrade, sector, boss, damage, timing, or XP values change.
- No visual redesign is included. UI assets may be resized or recompressed only
  when the rendered result remains visually equivalent.
- No framework, bundler, or runtime dependency is introduced unless a later
  task explicitly approves it.
- No new content or game mode is added in Phase 1.

## Risk strategy

The owner has chosen to execute the architectural split and staged loading
first. Both changes therefore use the existing query-driven QA scenes and a
manual normal-run check as their regression gate; the automated smoke suite
remains the next protection layer to add.

Each package follows the same gate:

1. Record the baseline.
2. Make one narrowly scoped change.
3. Run syntax and smoke checks.
4. Compare the relevant QA screenshots.
5. Test one normal playable run segment.
6. Commit only if no regression is visible.

Do not combine asset conversion, gameplay refactoring, and balance changes in a
single commit.

## Implementation status — 2026-09-04

- Completed the behavior-neutral `game.js` split into sector, combat, world,
  HUD, and menu modules. `game.js` now remains the central state/loop
  coordinator.
- Completed staged image loading with boot, shared, Kla'ed, Nairan, Nautolan,
  and victory groups. Finished fleet groups are released after boss rewards.
- Music is requested immediately; the first real user gesture remains the
  browser-policy fallback if autoplay is blocked.
- Corrected the Nairan and Nautolan QA enemy-name casing exposed during the
  regression run.
- Verified all 154 manifest entries are assigned exactly once and resolve to
  existing files. All QA routes and a normal playable start render without
  console warnings or errors.
- Added a dynamically loaded `?test=full-run` check covering every sector
  transition, staged fleet release, victory, replay, and return-to-hangar. It
  exposed and verified the fix for a missing `Player` import in the extracted
  sector module.

## Work package 1 — Repair and standardize QA routes

**Risk: very low**

### Scope

- Correct the Nairan and Nautolan enemy type construction in the existing
  combat QA routes.
- Verify all current query-driven scenes:
  - title/loading
  - upgrade cards
  - player upgrade visuals
  - Kla'ed combat
  - Nairan combat
  - Nautolan combat
  - HUD layout
  - victory screen
- Make failures visible instead of silently leaving a partially initialized
  scene.

### Acceptance criteria

- Every QA URL opens without a console error.
- Every fleet scene contains its expected enemies and boss.
- Normal gameplay is unchanged.

## Work package 2 — Add automated smoke checks

**Risk: low**

### Scope

- Add a lightweight browser smoke-test harness for the existing QA routes.
- Check that every route reaches its expected game state.
- Fail on uncaught exceptions, missing registered assets, or invalid enemy
  definitions.
- Add a static validation that all asset-manifest paths exist.
- Add a data-integrity check for fleet enemy names, projectile visual keys, and
  upgrade IDs.

### Required checks

- JavaScript syntax check for every source module.
- Title can start a run.
- A normal run spawns enemies and player projectiles.
- Upgrade selection resumes the correct state.
- Boss reward can advance to the next sector.
- Victory and game-over buttons work.

### Acceptance criteria

- One documented command runs the full smoke suite.
- The suite is deterministic where practical and exits non-zero on failure.
- No test-only state leaks into a normal run.

## Work package 3 — Produce a release-only asset inventory

**Risk: very low**

### Scope

- Classify every asset as runtime, source, preview, documentation, or unused.
- Identify manifest entries that are loaded but never referenced.
- Define a release allowlist rather than deleting source material immediately.
- Keep Foozle license/readme files in the repository and release attribution
  archive.
- Document the provenance/license of `track1.ogg`; if this cannot be proven,
  mark the track as a release blocker without otherwise changing music behavior.

### Acceptance criteria

- A generated or maintained inventory names every shipped runtime asset.
- ZIP files, `.aseprite` sources, and GIF previews are excluded from the release
  artifact while remaining available in the development repository.
- No runtime URL changes in this package.

## Work package 4 — Optimize UI images without visual changes

**Risk: low to medium**

### Scope

- Resize the seven registered UI PNGs closer to their maximum rendered size,
  while retaining enough resolution for the supported device-pixel ratio.
- Preserve alpha, crop regions, nine-slice behavior, and the current visual
  appearance.
- Remove or archive the unused `upgrade-card-frame-v1.png` from the release
  allowlist.
- Update source rectangles only when required by the resized files.

### Method

- Convert one UI family at a time: title, start button, upgrade cards, boss bar,
  victory frame.
- Capture before/after images at the same viewport.
- Use pixel-difference output as a warning signal, followed by visual review.

### Acceptance criteria

- No clipping, blur, seams, or shifted ornamentation at 1x, 1.5x, and 2x DPR.
- UI decoded-memory estimate is reduced by at least 50%.
- Title, upgrade, boss, and victory screenshots remain visually equivalent.

## Work package 5 — Introduce staged image loading

**Risk: medium**

### Scope

- Split the image manifest into logical groups:
  - boot/title/common UI
  - player and shared pickups/projectiles
  - Kla'ed sector
  - Nairan sector
  - Nautolan sector
  - victory UI
- Load only the assets required for the title and first playable sector before
  allowing a run to begin.
- Preload the next sector during the current sector, with existing canvas
  fallbacks retained for failure cases.
- Keep current music creation, loading, looping, volume, and start behavior.

### Safety rules

- Asset keys do not change.
- Drawing code continues to tolerate missing images.
- A failed optional sector preload cannot freeze the main loop.
- The next boss may not start until its required asset group has settled.

### Acceptance criteria

- The title becomes interactive without waiting for later-sector artwork.
- Sector transitions do not show missing sprites on a normal connection.
- Failed asset requests produce a visible fallback and a test failure, not a
  permanent loading state.
- Peak decoded image memory is materially lower than the current baseline.

## Work package 6 — Mobile performance validation

**Risk: low; read-only until a hotspot is proven**

### Scope

- Create deterministic normal and stress QA scenes.
- Measure frame time, entity counts, particle counts, projectile counts, and
  long-frame frequency.
- Test at minimum:
  - 360 x 640
  - 390 x 844
  - 420 x 760 design viewport
  - a tall modern Android viewport
- Validate touch offset, lower-screen visibility, pause-on-background, and
  orientation changes on a real mid-tier Android device.

### Optimization rule

Do not introduce spatial partitioning, object pools, or broad FX reductions
without measurements showing that they solve a real bottleneck.

### Target thresholds

- Stable 55–60 FPS in normal combat on the target Android device.
- No sustained frame time above 20 ms.
- No entity-cap overflow or unbounded collection growth.
- No hidden ship movement when UI controls or upgrade cards are tapped.

## Work package 7 — Split `game.js` behavior-neutrally

**Risk: medium; highest-risk package in Phase 1**

### Preconditions

- Smoke tests from package 2 pass.
- Screenshot baselines exist.
- Asset-loading changes have already stabilized.

### Extraction order

1. Pure rendering helpers and icons.
2. Title, loading, pause, game-over, and victory renderers.
3. HUD and boss-reward rendering.
4. Spawn and formation orchestration.
5. Collision and cleanup orchestration.

### Architecture target

```text
src/
  game.js
  rendering/
    hudRenderer.js
    menuRenderer.js
    worldRenderer.js
  systems/
    collisionSystem.js
    sectorSystem.js
    spawnSystem.js
```

The final filenames may be adjusted if existing responsibilities suggest a
cleaner boundary. Avoid a single replacement `megaRenderer.js`.

### Safety rules

- Move code before redesigning it.
- Preserve public method names until all callers are migrated.
- No gameplay constants move and change value in the same commit.
- Extract one responsibility per commit.
- Run the entire smoke suite and screenshot comparison after every extraction.

### Acceptance criteria

- `game.js` primarily coordinates state, the loop, and high-level systems.
- No circular imports.
- No observable change to timing, RNG call order, controls, rendering, or
  balance.
- Normal and stress tests meet or exceed the pre-refactor baseline.

## Phase 1 completion gate

Phase 1 is complete only when all of the following are true:

- All QA routes and automated smoke checks pass.
- All runtime assets are accounted for and legally documented.
- Release artifacts exclude development-only asset sources and previews.
- UI memory usage is at least 50% lower.
- Later-sector images are not required before the title becomes interactive.
- Music still behaves as it did before Phase 1.
- Real-device mobile performance meets the agreed target.
- The architectural split introduces no visual or gameplay regression.

## Explicitly deferred

- Balance adjustments.
- New upgrades, enemies, bosses, sectors, or player ships.
- Expedition mode.
- New music or sound effects.
- Accessibility redesign, PWA packaging, analytics, and monetization.

These belong to later phases after the technical foundation is measurable and
stable.
