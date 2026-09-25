# Galalaxy – Y8 upload notes

## Build

Run `node scripts/package-y8-release.mjs` from the repository root. It writes
`release/y8/galalaxy-y8.zip` with `index.html` directly at the ZIP root.

The generated Y8 index adds the official asynchronous Y8 SDK script and a
platform marker. The normal source index and the Kongregate package do not load
the Y8 SDK. The packaged build can be served locally from
`release/y8/build/` to exercise the Y8 integration on localhost.

## Credentials

- App ID: `6ab6e4c5e6dd4122f42af26d`
- Game ID: `284519`

These identifiers are public client configuration, not secrets.

## Advertisement placements

- `sector-complete`: after an intermediate boss reward, before the next sector
- `new-run`: after the player presses Play Again on a defeat or victory screen

No ad is requested before the first run or during combat. Y8 owns preroll
delivery. The integration uses Y8 frequency capping and immediately continues
when an ad is unavailable, capped, or fails. Music and sound effects are muted
only while an ad is actually visible and then restored to the player's prior
setting.

Rewarded ads and banners are intentionally not part of the first release.
