# GameMonetize upload notes

## Files

- Game ZIP: `release/gamemonetize/galalaxy-gamemonetize.zip`
- 512 x 384 JPG: `release/gamemonetize/media/galalaxy-512x384.jpg`
- 512 x 512 JPG: `release/gamemonetize/media/galalaxy-512x512.jpg`
- 512 x 340 JPG: `release/gamemonetize/media/galalaxy-512x340.jpg`

The ZIP is portal-specific. Its root contains `index.html`, `src/`, and `assets/`.
The ordinary `main`, Kongregate, and Y8 builds do not load the GameMonetize SDK.

## Portal fields

- Name: `Galalaxy`
- Categories: `Arcade`, `Shooting`
- Tags: `Space`, `Shooter`, `Survival`, `Roguelite`, `Boss`, `Pixel Art`, `Mobile`
- Width: `420`
- Height: `760`
- Optimized for Mobile Devices: `Yes`

## Description

Galalaxy is a fast-paced space survival shooter built for short, replayable runs. Guide an auto-firing starfighter through four hostile sectors, dodge precision fire and enemy formations, collect XP, and shape your build with weapon, engine, shield, rocket, zapper, beam, and pulse upgrades. Each sector introduces a distinct enemy fleet and ends in a boss encounter with readable multi-phase attack patterns. Survive the Kla'ed assault, cross the Nairan Expanse and Nautolan Depths, then challenge the Void Sovereign in the Void Core. The game supports touch, mouse, and keyboard controls, portrait mobile play, pause, sound controls, persistent best score, and a complete victory state.

## Instructions

Touch or mouse: drag to steer. Keyboard: use W, A, S, and D to move. Weapons fire automatically. Collect XP and choose an upgrade whenever you level up. Tap the pause icon or press P to pause. Use the speaker icon to toggle audio. Defeat each sector boss and survive all four sectors to win.

## SDK verification

1. Upload the GameMonetize ZIP and save the game entry.
2. Open **Verify Game** so the uploaded build runs inside GameMonetize's iframe.
3. Press **Play** and watch the advertisement through to completion.
4. Confirm the game begins after the ad, with no game music or sound underneath the ad.
5. Return to the portal and request activation only after verification succeeds.

Ads are requested only from the Play/Replay action. There are no timer-based ads and no ad on page load.
