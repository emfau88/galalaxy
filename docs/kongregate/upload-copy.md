# Galalaxy: Kongregate upload copy

## Title

Galalaxy

## Description

> **Build a warship. Survive the fleet. Conquer the void.**
>
> Galalaxy is a fast, one-stick space-survival roguelite. Steer through hostile
> sectors, let your weapons fire automatically, and choose upgrades that turn a
> fragile scout into a screen-clearing warship. Combine shields, pulse blasts,
> rockets, zappers and heavy cannons; hunt for build-defining Keystones; then
> face each sector's flagship on the way to the Void Core.
>
> Every run is a new build, a new fleet to read, and another chance to push
> deeper into the galaxy.

## Target audience

Players who enjoy action roguelites, arcade shooters, bullet-heavy survival
games and short repeatable runs. It is designed for players who like making
meaningful build choices without needing twin-stick aiming.

## Controls

**Desktop:** Click and drag with the mouse on the playfield to steer. Press
**P** or click the on-screen pause button to pause. Weapons fire automatically.

**Mobile:** Drag anywhere on the playfield to steer. Tap the on-screen active
pause button. Weapons fire automatically.

## Upload package

Run `node scripts/package-kongregate-release.mjs` from the repository root.
It writes `release/kongregate/galalaxy-kongregate.zip`, with `index.html`
directly at the ZIP root and only the runtime source and assets required by the
game. The `release/` directory is generated and intentionally ignored by Git.
