# Kongregate publishing package

## Media

- `galalaxy-icon-1000x800.png`: upload-ready 5:4 icon.
- `galalaxy-icon-1024.png`: square editable/master icon generated with ImageGen.
- `01-survive-the-fleet.jpg`: boss combat.
- `02-build-your-warship.jpg`: visible build progression.
- `03-unleash-everything.jpg`: late-run combat with the full arsenal active.

The three 1200×675 marketing images use the real game renderer. Recreate their
source scenes with `node scripts/capture-kongregate-scenes.mjs`, then rebuild
the finished layouts with `python scripts/create-kongregate-media.py`.

## Statistics to create in the Developer Portal

Names are case-sensitive and must match the game exactly. Create all five as
`Max` statistics. Only `HighScore` should be shown as a public leaderboard at
launch.

| Name | Type | Suggested description |
|---|---|---|
| `HighScore` | Max | Highest score reached in one run |
| `SectorReached` | Max | Highest sector reached, 1–4 |
| `MaxLevel` | Max | Highest ship level reached in one run |
| `KeystoneInstalled` | Max | Installed a run-defining Keystone, 0–1 |
| `GameComplete` | Max | Defeated the Void Core, 0–1 |

The client bridge loads only on Kongregate or inside a Kongregate frame. It
stores each player's best values locally, submits them when a run ends, and
resubmits them when the Kongregate API reconnects. No API key is embedded.
Statistics can only be tested in Kongregate Preview; use `?debug_level=4` there
to inspect submissions.

These stats support sensible future badge conditions if Kongregate selects the
game for badges:

- Reach Sector II, III and IV from `SectorReached`.
- Install a Keystone from `KeystoneInstalled`.
- Complete a run from `GameComplete`.
- Score and level milestones from `HighScore` and `MaxLevel`.

Badges are platform achievements, not developer-created paid items. Kongregate
decides whether a game qualifies and uses the submitted statistics to award them.

## Monetization recommendation

Launch without in-game purchases and use the available Kongregate advertising /
revenue-share program first. Measure completed runs, repeat play and ratings
before adding a store. Selling power would damage the run balance and make the
leaderboard less credible.

If there is enough retention, the first Kreds product should be one permanent
cosmetic supporter pack: ship colorways, engine trails and a cosmetic profile or
HUD theme. It should not contain damage, health, revives, guaranteed Keystones,
extra upgrade choices or score multipliers. Those systems and cosmetic assets do
not exist yet, so a purchase button is intentionally not included in this build.

Before any Kreds implementation, request Kongregate's permission for a
payment-enabled game. Create a perpetual item manually in the Developer Portal
with blank/unlimited initial uses, disclose in-app purchases in the description,
then add inventory restoration and purchase verification. Test purchases in
Preview with the developer account before submission.
