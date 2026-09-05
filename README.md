# Galalaxy

A mobile-first arcade space-survivor built with vanilla JavaScript and HTML5 Canvas. Guide an auto-firing ship through increasingly dangerous fleet sectors, collect energy and shape each run with visible weapon, engine and defensive upgrades.

## [▶ Play Galalaxy](https://emfau88.github.io/galalaxy/)

## Screenshots

<p align="center">
  <img src="docs/screenshots/start-screen.png" alt="Galalaxy start screen" width="220" />
  <img src="docs/screenshots/upgrade-cards.png" alt="Upgrade choice with current and next ship configuration" width="220" />
  <img src="docs/screenshots/hud-boss.png" alt="Boss fight with the mobile HUD" width="220" />
  <img src="docs/screenshots/ship-evolution.png" alt="Ship module progression preview" width="220" />
</p>

## Features

- Four escalating sectors with Kla'ed, Nairan and Nautolan fleets
- Boss encounters and a complete victory state
- Build-defining upgrades including multi-cannons, rockets, zapper, beam and pulse abilities
- Persistent upgrade modules and MK-I to MK-IV ship evolution
- Animated, fleet-specific enemy weapons and projectiles
- Portrait-oriented touch and mouse controls, auto-fire, music and a saved best score

## Controls

- **Touch or mouse:** drag to steer
- **Upgrade screens:** tap or click a card
- **Pause:** tap the pause button in the HUD or press `P`; switching away pauses combat until you resume
- **Sound:** the speaker button toggles music and the four gameplay cues; the choice is saved
- Weapons fire automatically

## Run locally

No build step or dependencies are required. Serve the repository through a local HTTP server:

```bash
python -m http.server 8765
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

## QA

Open [the accelerated full-run check](http://127.0.0.1:8765/?test=full-run)
while the local server is running. It verifies staged asset loading, all four
sector transitions, the shared Nautolan fleet group, victory, replay and
return-to-hangar. A successful run changes the page title to
`Galalaxy QA PASS`; failures are reported in the browser console.

Dependency-free regression and asset checks:

```bash
node scripts/reliability-check.mjs
node scripts/verify-assets.mjs
```

`node scripts/browser-reliability-check.mjs` runs the browser regression suite
with Playwright and Edge installed (Playwright must be resolvable, e.g. through
`NODE_PATH`). It saves screenshots and a JSON report under `docs/qa/` and tests
six viewport/safe-area combinations, touch input, audio triggers and run endings.
Physical multitouch and real phone browser switching still need device testing.

Completed runs keep the latest 24 build summaries and keystone observations in
local browser storage. No data is sent anywhere. To inspect reachability in the
developer console, run:

```js
const { RunStats } = await import('./src/runStats.js');
const stats = new RunStats();
console.table(stats.keystoneSummary());
console.table(stats.history);
```

Times count active combat seconds. Measurements include eligibility, offers,
selection time and combat time remaining after selection. QA runs are excluded;
use normal completed runs to gather meaningful rates. UI source images remain
editable; `python scripts/optimize-ui-assets.py` regenerates runtime derivatives
with Pillow.

## Technology

HTML5 Canvas, CSS and native JavaScript modules.
