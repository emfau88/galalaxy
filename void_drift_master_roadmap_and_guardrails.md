# Void Drift: Galaxy Survivor — Master Roadmap, Production Rules & AI-Agent Guardrails

> Purpose:
> This document is the canonical production roadmap and operational contract
> for continuing development of Void Drift: Galaxy Survivor.
>
> This is NOT a generic feature wishlist.
> It is a production-focused implementation roadmap optimized for:
>
> - solo development
> - AI-assisted implementation
> - mobile-first HTML5 architecture
> - scope control
> - combat quality
> - replayability
> - maintainable code
>
> Every future implementation task should align with this document.

---

# 0. PROJECT IDENTITY

## Core Identity

Void Drift is:

- a mobile-first arcade space survivor
- short-session replayable combat
- visually satisfying sector runs
- build-driven run evolution
- focused on combat feel and readability
- optimized for portrait mobile play

Void Drift is NOT:

- an MMO
- a giant RPG
- a sandbox galaxy simulator
- a content-infinite live service
- a stat-grind simulator
- a loot-inventory management game

---

# 1. PRODUCTION PHILOSOPHY

## PRIORITY ORDER

Always prioritize:

1. Combat Feel
2. Readability
3. Mobile UX
4. Replayability
5. Build Identity
6. Performance
7. Content Quantity

Never reverse this order.

---

## MOST IMPORTANT RULE

Do NOT add systems just because they sound cool.

Every new feature must answer:

- Does this improve replayability?
- Does this improve combat feel?
- Does this improve build identity?
- Does this improve mobile play?
- Does this improve run variety?

If the answer is NO:
Do not build it.

---

# 2. TECHNICAL RULES

## PROJECT STRUCTURE

Current structure:

```text
index.html
src/
  main.js
  config.js
  assets.js
  utils.js
  game.js

  entities/
    player.js
    enemy.js
    projectile.js
    pickup.js
    particle.js

  systems/
    upgrades.js
    fx.js
    abilities.js

  data/
    fleets.js
    projectiles.js
```

---

## ARCHITECTURE RULES

### DO

- keep systems modular
- keep files responsibility-focused
- isolate gameplay systems
- isolate rendering helpers
- isolate data tables
- keep entities lightweight
- use ES modules consistently

---

### DO NOT

- create God classes
- re-bloat game.js
- create circular imports
- mix rendering and gameplay logic unnecessarily
- put all helper functions into game.js
- create giant utility dumping grounds

---

## GAME.JS RULE

`game.js` should remain:

- orchestration
- game loop
- world coordination
- state transitions
- high-level systems interaction

NOT:

- giant rendering kitchen sink
- giant FX dumping ground
- giant gameplay blob

---

## WHEN TO SPLIT A SYSTEM

Split into a new file when:

- file exceeds ~250–400 LOC for one concern
- logic becomes reusable
- logic becomes independent
- system has clear ownership

Examples:

GOOD:

```text
systems/fx.js
systems/abilities.js
systems/collisions.js
rendering/projectileRenderer.js
```

BAD:

```text
systems/everything.js
helpers/globalUtils.js
megaRenderer.js
```

---

# 3. AI AGENT WORKFLOW RULES

## EVERY IMPLEMENTATION TASK MUST:

1. Define exact scope
2. Define forbidden scope
3. Define affected files
4. Define architecture constraints
5. Define acceptance criteria
6. Define testing checklist
7. Define performance constraints

---

## NEVER ALLOW AI AGENTS TO:

- silently refactor unrelated systems
- rename systems unnecessarily
- reorganize the entire architecture
- replace working gameplay foundations
- add huge dependency chains
- introduce frameworks
- rebuild rendering from scratch

---

## MANDATORY AUDIT POINTS

Before major implementation phases:

### REQUIRED AUDITS

| Area | Audit Required? |
|---|---|
| Input System | YES |
| Collision System | YES |
| Rendering Pipeline | YES |
| Upgrade System | YES |
| Build Identity System | YES |
| Boss System | YES |
| Save System | YES |
| Performance-critical FX | YES |

---

## MINI-AUDIT TEMPLATE

Before implementation:

```text
1. Current architecture analysis
2. Dependency risks
3. Files affected
4. Performance risks
5. Mobile readability risks
6. Scope creep risks
7. Acceptance criteria
```

---

# 4. PERFORMANCE RULES

## MOBILE FIRST

Target device:

- Android Chrome
- mid-tier mobile devices
- portrait orientation
- touch-first

---

## PERFORMANCE PRIORITIES

### PRIORITY 1
Stable frame pacing.

### PRIORITY 2
Combat readability.

### PRIORITY 3
Controlled FX density.

---

## PARTICLE RULES

### DO

- use caps
- use short lifetimes
- use small particle counts
- use high-quality sparse effects

### DO NOT

- create particle spam
- use giant shadowBlur everywhere
- use fullscreen alpha effects constantly
- create permanent overdraw storms

---

## PERFORMANCE DANGER ZONES

### HIGH RISK

- giant alpha overlays
- massive radial gradients
- excessive shadowBlur
- thousands of particles
- giant animated spritesheets
- fullscreen postprocessing

---

# 5. MILESTONE ROADMAP

---

# MILESTONE 1 — COMBAT FOUNDATION FINALIZATION

## STATUS
IN PROGRESS — Combat Feel Pass complete. Mobile Controls complete. FX pass complete. Performance validation pending.

---

## IMPLEMENTED (2026-05-10)

### Signature Abilities added
- Beam Cannon (7s cooldown, piercing column, 24px width, 48 dmg base)
- Pulse Wave (9s cooldown, 155px radius, knockback 200px/s, 18 dmg base)
- Rocket Barrage (3-shot spread per trigger when unlocked)
- Ability cooldown pips in HUD (glow when ready)
- src/systems/abilities.js created

### Combat Feel Pass (Milestone 1 Bulk 1)
- Beam width 18→24px, damage 55→48, first trigger 4s (not instant)
- Pulse damage 22→18 (space control tool, not burst), knockback 200px/s, first trigger 5s
- Boss attack pattern: alternating 3-shot burst (1.1s) / 5-shot spread (1.6s) rhythm
- Boss centre projectile slowed 310→260 for readable dodge window
- Boss projectile render sizes increased: klaed 38×20, nairan 32×28, nautolan 24×24
- Zapper dual-pass render: glow 5px + white core 1.8px — clearly distinct from other FX
- Sector tint: 0.07 flat → 0.09 + 0.018/sector (Void Core reaches 0.144)

### FX Pass
- Projectile trails per fleet (canvas, lighter blend)
- Impact sparks on hit (4 directional sparks + ring)
- Death burst per fleet (expanding ring + debris)
- Sector atmosphere dust per sector (color-coded)
- Boss entrance pulse (3 staggered rings)
- Player engine reacts to speed and fire timer

### Mobile Controls
- Touch offset: ship leads finger by 110px upward (CONTROL_CONFIG.touchOffsetY)
- pointerType detection: touch vs mouse, separate offset paths
- shipX/shipY in Input — clamped target coords, decoupled from raw worldX/Y
- Bottom spawn reduced: top 45%, sides 22.5% each, bottom 10%

### Modular Architecture
- src/entities/: player, enemy, projectile, pickup, particle
- src/systems/: upgrades, fx, abilities
- src/data/: fleets, projectiles
- assets.js: all 6 Foozle packs registered, 15 projectile PNGs, correct paths
- src/systems/abilities.js added (commit ee4f71a)

---

## TASKS

### Combat Feel
- [x] Finalize Beam Cannon balancing
- [x] Finalize Pulse Wave balancing
- [x] Finalize Rocket Barrage balancing
- [x] Improve Zapper chain readability
- [x] Improve projectile contrast
- [ ] Improve enemy hit feedback (player damage flash exists, screenshake on heavy hits pending)
- [x] Improve boss attack readability
- [ ] Improve enemy spawn readability

---

### Mobile Controls
- [x] Finalize touch offset system
- [x] Finalize drag smoothing
- [x] Improve lower-screen readability
- [x] Improve enemy fairness near thumb area
- [ ] Validate portrait combat visibility (needs real device test)

---

### FX Stabilization
- [ ] Reduce visual clutter (trails + atmosphere may be too dense — needs playtesting)
- [x] Verify projectile trails readability
- [x] Verify death FX readability
- [x] Verify atmosphere FX readability
- [ ] Validate boss presentation clarity (boss entrance improved, death moment still weak)

---

### Performance Validation
- [ ] Mobile FPS stress test
- [x] Particle cap validation (CONFIG.particleCap = 220, all emitters respect cap)
- [ ] Projectile spam validation
- [ ] shadowBlur audit
- [ ] Overdraw audit

---

## AUDIT REQUIRED BEFORE COMPLETION

### Audit Areas
- Input responsiveness
- Collision fairness
- Mobile readability
- FX saturation
- Spawn fairness
- Boss readability

---

# MILESTONE 1.5 — SPAWN VARIETY & COMBAT RHYTHM

## STATUS
IMPLEMENTED 2026-05-10

---

## IMPLEMENTED

### Engine Boost Fix
- Movement lerp now derived from `this.speed / 360` — Engine Boost upgrade visibly affects ship responsiveness
- Evolution move multiplier applied per tier (+0/+5/+8/+10%)
- Evolution fire rate multiplier applied per tier (+0/+6/+10/+14%)

### Sector Tuning
- Sector durations: I=65s, II=90s, III=105s, IV=115s (was all 90s)
- `spawnMult` and `enemySpeedMult` per sector (Sector I: 0.9/0.9, others 1.0/1.0)
- Formation suppressed in Sector I for first 15 seconds

### Zapper Combat Feel
- Base zap damage 12→20 (reliably one-shots scouts at level 1)
- Chain fires at zapper ≥ 2 (was ≥ 3)
- Chain search radius 140→200px
- First-shot priming on all upgrade picks (fireTimer set to 0.05s)

### Boss Reward Overlay
- `"bossReward"` game state: 3.2s pause after non-final boss kill
- Full overlay: tier name, branch label, move/fire bonuses staggered at 0.6s
- Tap-to-dismiss after 0.8s
- Ship drawn with branch pulse ring behind it
- `evolutionFlash` suppressed during overlay

### Enemy Flyby System
- `flyby: { vx, vy, sineAmp, sineFreq }` added to `Enemy` constructor
- Flyby enemies use fixed-velocity movement, do not chase player
- Face travel direction in draw (not player direction)
- Despawn margin 220px (vs 160px for chasers)

### Formation System
- `spawnFormation()` in game.js: 5 named shapes (horizontal line, diagonal line, V, diamond, arrow/wedge)
- Formations enter from top (50%) or side (50%) — side entry is unambiguously non-chasing
- All enemies in a formation share identical flyby vector (`sineAmp: 0`) — stay as tight block
- Formation chance per sector: 25/30/34/36%
- Formation suppressed during bossWarning

### Solo Flyby Tuning
- `pickSoloEnemy()` added to fleets.js: scout/fighter weight ×0.4 for solo spawns — heavier units dominate solo chaser roles
- 50% of solo scout/fighter spawns get diagonal flyby (angle 15–35°, horizontal-dominant)
- `_makeDiagonalFlyby()`: enters from left/right edge, vx dominant over vy

---

## TASKS
- [x] Engine Boost fix
- [x] Sector duration tuning
- [x] Zapper first-shot satisfaction
- [x] Boss reward overlay
- [x] Flyby enemy movement
- [x] Formation spawning (5 shapes, side + top entry)
- [x] Solo flyby for scouts/fighters
- [x] Solo spawn bias toward heavier units
- [ ] Validate formation readability on real device
- [ ] Validate flyby angles feel correct at all screen sizes

---

# MILESTONE 2 — BUILD IDENTITY SYSTEM

## STATUS
IN PROGRESS — Build Drift System (Bulk 1) implemented 2026-05-10.

---

## IMPLEMENTED (2026-05-10)

### Build Drift System — Bulk 1
- Upgrade pool restructured: `family` (zapper/rocket/pulse/core), `maxLevel`, `minLevel`, `weight` per entry
- `_pickCount` tracked per run, resets in `startRun()`
- `roll()` rewritten: weighted sample without replacement, dominant affinity gets 2.2× weight, rival families 0.7×
- Signature upgrades (beam, barrage, pulse) gated behind `minLevel: 2` — don't appear in first 2 picks
- Maxed upgrades removed from pool automatically
- Barrage requires rocket ≥ 1 in pool filter
- Upgrade cards: family-tinted bg/border/shadow, family tag label (top-right), level dots in family color
- `src/systems/upgrades.js` fully rewritten (~200 LOC)

---

## GOAL
Runs should feel fundamentally different.

NOT:

```text
same build with bigger numbers
```

BUT:

```text
this run became an electrical warship
```

---

## CORE DESIGN RULE

Builds must:

- alter gameplay rhythm
- alter combat space control
- alter visuals
- alter decision making
- alter player fantasy

---

## BUILD FAMILIES

### ZAPPER FAMILY

Fantasy:
Electrical hunter ship.

Tasks:
- [ ] Chain count upgrade
- [ ] Arc fork upgrade
- [ ] EMP pulse upgrade
- [ ] Shock burst upgrade
- [ ] Overcharge proc upgrade
- [ ] Electrical build visuals

---

### ROCKET FAMILY

Fantasy:
Heavy artillery ship.

Tasks:
- [ ] Cluster rockets
- [ ] Delayed detonation
- [ ] Burn trails
- [ ] Heavy payload
- [ ] Armor break
- [ ] Rocket build visuals

---

### PULSE FAMILY

Fantasy:
Core-energy control ship.

Tasks:
- [ ] Expanded pulse radius
- [ ] Projectile cleanse
- [ ] Gravity pull
- [ ] Repulsion wave
- [ ] Shield pulse
- [ ] Pulse build visuals

---

## KEYSTONE UPGRADES

## PURPOSE
Run-defining decisions.

Examples:

### Overcharged Core
Massive zap power.
Disables rockets.

### Heavy Siege Payload
Huge rockets.
Slower fire rate.

### Pulse Reactor
Periodic nova.
Reduced mobility.

---

## BUILD DRIFT SYSTEM

## PURPOSE
The game should recognize current build direction.

Tasks:
- [x] Upgrade family weighting
- [x] Build affinity tracking
- [x] Upgrade rarity tiers (minLevel gates signature upgrades)
- [x] Upgrade synergy weighting (affinity 2.2× bonus)
- [x] Duplicate upgrade handling (maxed upgrades removed from pool)

---

## AUDIT REQUIRED BEFORE IMPLEMENTATION

### Audit Areas
- Upgrade balance
- Upgrade readability
- Upgrade pacing
- UI readability
- Build diversity
- Power creep risk

---

# MILESTONE 3 — SHIP EVOLUTION

## STATUS
IN PROGRESS — Bulk 1 implemented 2026-05-10.

---

## IMPLEMENTED (2026-05-10)

### Ship Evolution — Bulk 1
- `shipTier()`: returns 1–4 based on `currentSectorIndex` (sector 1=T1, sector 2=T2, etc.)
- `shipBranch()`: returns "assault"|"energy"|"siege" from build affinity (zapper+beam → energy, rocket+barrage → siege, default → assault)
- T2+: primary engine cone tinted by branch color (assault=silver, energy=cyan-blue, siege=orange)
- T2+: shield ring tinted by branch color
- T3+: flanking side engine nozzles (canvas drawn, behind ship body)
- T3+: side cannon stubs (small rectangles, branch-colored, drawn behind ship body)
- T4: pulsing energy core orb at ship center (drawn over ship body)
- Sector transition screen: evolution badge showing tier name + branch frame label (appears at T2+)
- Branch accent colors defined in `BRANCH_COLORS` at top of player.js
- All purely canvas-drawn — no new image assets required

---

## GOAL
The ship should visibly evolve during a run.

The player should FEEL progression.

---

## DESIGN RULE

Ship evolution should:

- visually escalate
- emotionally escalate
- reinforce builds
- reinforce sectors
- remain readable

---

## SHIP TIERS

### Tier 1
Starter ship.

Tasks:
- [x] Finalize base silhouette
- [x] Finalize base engine visuals
- [x] Finalize readability

---

### Tier 2
Expanded combat ship.

Tasks:
- [x] Improved engine layer (branch-tinted engine cone)
- [x] Branch-colored shield ring
- [ ] Slight silhouette growth (visual size bump)
- [ ] More aggressive posture

---

### Tier 3
Advanced warship.

Tasks:
- [x] Side cannons (stub rectangles, branch-colored)
- [x] Improved shield visuals (thicker, stronger glow)
- [x] Side engine nozzles
- [ ] Larger visual identity (size/silhouette pass)

---

### Tier 4
Final evolved flagship.

Tasks:
- [x] Heavy energy core visuals (pulsing orb)
- [x] Extended side cannon stubs (longer at T4)
- [ ] Strong evolved silhouette (size pass)
- [ ] Final-sector presentation feel

---

## EVOLUTION BRANCHES

### Assault Frame
Weapon-focused.

### Energy Frame
Zapper/Pulse-focused.

### Siege Frame
Rocket-focused.

---

## EVOLUTION EVENTS

### PURPOSE
Sector completion should feel meaningful.

Tasks:
- [x] Evolution transition screen (tier badge + branch label in sector transition)
- [x] Evolution VFX (screen-punch flash on boss kill, branch-colored, tier name overlay)
- [ ] Evolution pacing balancing
- [ ] Evolution readability

---

## AUDIT REQUIRED BEFORE IMPLEMENTATION

### Audit Areas
- Ship readability
- Visual clutter risk
- Evolution pacing
- Weapon readability
- Mobile silhouette clarity

---

# MILESTONE 4 — ELITE ENEMIES

## STATUS
PLANNED

---

## GOAL
Combat should require priorities.

The player should react differently to different threats.

---

## DESIGN RULE

Elites must:

- alter battlefield decisions
- alter movement patterns
- create threat hierarchy
- remain readable

---

## TASKS

### Kla'ed Elites
- [ ] Berserk elite
- [ ] Plasma sniper
- [ ] Heavy charger

---

### Nairan Elites
- [ ] Beam sniper
- [ ] EMP carrier
- [ ] Fast hunter

---

### Nautolan Elites
- [ ] Gravity ship
- [ ] Heavy pulse tank
- [ ] Bombardment cruiser

---

## ELITE SYSTEM TASKS
- [ ] Elite spawn rules
- [ ] Elite visual telegraphing
- [ ] Elite reward logic
- [ ] Elite rarity balancing

---

## AUDIT REQUIRED BEFORE IMPLEMENTATION

### Audit Areas
- Threat readability
- Spawn fairness
- Mobile readability
- Projectile density
- Difficulty spikes

---

# MILESTONE 5 — BOSS REWORK

## STATUS
PLANNED

---

## GOAL
Bosses should become memorable encounters.

NOT:

```text
large enemy with more HP
```

---

## DESIGN RULE

Bosses must:

- alter combat rhythm
- create memorable moments
- create movement challenges
- create presentation moments

---

## TASKS

### Kla'ed Boss
- [ ] Spread phase
- [ ] Charge phase
- [ ] Rage phase

---

### Nairan Boss
- [ ] Beam sweep phase
- [ ] Drone support phase
- [ ] Precision barrage phase

---

### Nautolan Boss
- [ ] Pulse nova phase
- [ ] Gravity attack phase
- [ ] Bombardment phase

---

## BOSS PRESENTATION
- [ ] Better entrances
- [ ] Better warnings
- [ ] Better death moments
- [ ] Better arena tension
- [ ] Better pacing

---

## AUDIT REQUIRED BEFORE IMPLEMENTATION

### Audit Areas
- Boss readability
- Difficulty fairness
- Arena readability
- Projectile density
- Mobile visibility

---

# MILESTONE 6 — ATMOSPHERE & PRESENTATION

## STATUS
PLANNED

---

## GOAL
Push the game from:

```text
good prototype
```

to:

```text
small premium-feeling arcade game
```

---

## CAMERA FEEL

Tasks:
- [ ] Impact freeze
- [ ] Directional shake
- [ ] Boss impact shake
- [ ] Pulse distortion

---

## VISUAL POLISH

Tasks:
- [ ] Better star layers
- [ ] Better parallax
- [ ] Better atmosphere layering
- [ ] Better sector transitions
- [ ] Better arena composition

---

## UI POLISH

Tasks:
- [ ] Title screen polish
- [ ] Victory screen polish
- [ ] Upgrade card polish
- [ ] HUD hierarchy pass
- [ ] Sector presentation polish

---

## AUDIO (LATER)

IMPORTANT:
Keep minimalistic.

Tasks:
- [ ] Hit sounds
- [ ] Explosion sounds
- [ ] Pickup sounds
- [ ] Beam sounds
- [ ] Boss warning sounds

---

# MILESTONE 7 — RETENTION & REPLAYABILITY

## STATUS
PLANNED

---

## GOAL
Create:

```text
one more run
```

psychology.

---

## EVENT SYSTEM

Tasks:
- [ ] Sector anomalies
- [ ] Risk/reward events
- [ ] Rare elite encounters
- [ ] Temporary corruption events

---

## RUN VARIATION

Tasks:
- [ ] Alternate sector routes
- [ ] Randomized modifiers
- [ ] Rare encounters
- [ ] Build-specific events

---

## MINIMAL META PROGRESSION

IMPORTANT:
NO stat inflation.

GOOD:
- cosmetics
- alternate ship visuals
- alternate trails
- alternate starting archetypes

BAD:
- permanent +damage
- permanent +HP
- endless grinding

---

# 6. SCOPE TRAPS

## NEVER PRIORITIZE

- [ ] Multiplayer
- [ ] Inventory systems
- [ ] Crafting systems
- [ ] Massive story campaign
- [ ] Open world systems
- [ ] MMO progression
- [ ] Infinite procedural galaxy
- [ ] Hundreds of weapons
- [ ] Permanent stat inflation

---

# 7. RELEASE STRATEGY

## TARGET

Do NOT chase:

```text
biggest game possible
```

Chase:

```text
small focused high-quality arcade game
```

---

## RELEASE TARGET QUALITY BAR

### Gameplay
- [ ] Runs feel different
- [ ] Builds feel memorable
- [ ] Bosses feel memorable
- [ ] Combat feels satisfying

---

### Technical
- [ ] Stable mobile FPS
- [ ] Stable GitHub Pages deployment
- [ ] No major asset failures
- [ ] No major mobile control issues

---

### Presentation
- [ ] Polished title screen
- [ ] Polished transitions
- [ ] Strong readability
- [ ] Strong combat feedback

---

# 8. FINAL DEVELOPMENT RULE

## MOST IMPORTANT LESSON

More features do NOT automatically improve the game.

The highest leverage areas are:

1. Combat Feel
2. Build Identity
3. Ship Evolution
4. Boss Presentation
5. Run Variety
6. Mobile Readability

Everything else is secondary.

