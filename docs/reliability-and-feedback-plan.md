# Reliability and feedback – 2026-09-05

Authorized scope: repair sector cleanup, queued level-up decisions, paused combat
timing and upgrade descriptions/wrapping; add local run reports and keystone
observations, four small synthesized sound cues, touch pause and pointer lifecycle
handling; optimize existing UI images and provide a runtime release inventory.

Excluded: fleet compositions, enemy movement/attacks, new enemies, balance changes,
new upgrade entries, permanent progression, external telemetry, deployment.

Architecture: keep the existing ES modules and Canvas renderer. New feedback,
audio and text/layout helpers own their concerns. No runtime dependencies. Existing
asset originals remain available; runtime derivatives are reproducible. The user's
current scope supersedes the older Phase-1 exclusions for sound and gameplay fixes.

Acceptance: no old fleet objects at asset release; every earned level grants one
choice, including final rewards; pause/upgrade selection consumes no combat timer;
descriptions preserve words and match effects; completed runs retain build/cause/
sector and keystone timings locally, excluding QA; pointer capture and ID handling
prevent secondary touches from steering; cues share the saved audio mute control; UI image
decoded size drops at least 50% without clipping or lost crop registration.

Validation: one dependency-free Node command for regression tests, syntax and
manifest checks; populated browser full-run test; screenshots of upgrade, summary,
pause and title UI; normal start/upgrade/resume. Real Android frame pacing and
physical multitouch require device testing and cannot be claimed from emulation.
Effects retain existing caps; sound voices and saved run history are bounded.

Implemented and verified: the four original defects, run review, local keystone
measurement, four functional audio cues, pause/focus handling and UI derivatives.
Runtime UI decoded RGBA fell from 41.99 to 13.31 MiB (68.3%).

Follow-up HUD defect: the boss rail previously left the header transform before
drawing, so it stayed in the playfield when the header moved into the letterbox.
It now shares the header transform, with 6 design pixels of clearance between
the panel bottom and the complete boss frame. Pause coordinates follow resize.
Actual Canvas transforms are checked across six display/safe-area combinations.

End screens now reserve distinct areas for the result frame (y=24–324), ship
review (y=350–516) and buttons (from y=554). Defeat uses red alert rails. Aegis
installation previews preserve the existing shield and add ready-state brackets;
the temporary invulnerability bubble remains a combat effect. Mechanics tests
verify the blocked triggering hit, 1.8s protection and 18s cooldown.

Evidence: `docs/qa/reliability-2026-09-05/report.json` and adjacent screenshots.
All automated checks pass. Physical phone testing and representative normal-run
keystone samples remain follow-up validation; neither is claimed by emulation.
