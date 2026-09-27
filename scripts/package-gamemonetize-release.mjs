import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSETS } from "../src/assets.js";
import { GAMEMONETIZE_GAME_ID } from "../src/gamemonetize.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repoRoot, "release", "gamemonetize");
const stagingRoot = join(releaseRoot, "build");
const archivePath = join(releaseRoot, "galalaxy-gamemonetize.zip");
const sourceMediaRoot = join(repoRoot, "docs", "gamemonetize", "media");
const outputMediaRoot = join(releaseRoot, "media");
const runtimeAssets = new Set([
  ...Object.values(ASSETS),
  "assets/music/track1.ogg",
]);

async function copyFile(relativePath) {
  const sourcePath = resolve(repoRoot, relativePath);
  const destinationPath = resolve(stagingRoot, relativePath);
  if (!sourcePath.startsWith(repoRoot) || !destinationPath.startsWith(stagingRoot)) {
    throw new Error(`Unsafe package path: ${relativePath}`);
  }
  await stat(sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath);
}

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });

const sourceIndex = await readFile(join(repoRoot, "index.html"), "utf8");
const platformBootstrap = [
  "  <!-- GameMonetize-only bootstrap. The bridge loads the official SDK with this game's ID. -->",
  "  <script>window.__GALALAXY_PLATFORM__ = \"gamemonetize\";</script>",
  `  <meta name="gamemonetize-game-id" content="${GAMEMONETIZE_GAME_ID}" />`,
].join("\n");
if (!sourceIndex.includes("</head>")) throw new Error("index.html has no closing head tag");
await writeFile(
  join(stagingRoot, "index.html"),
  sourceIndex.replace("</head>", `${platformBootstrap}\n</head>`),
  "utf8",
);

await cp(join(repoRoot, "src"), join(stagingRoot, "src"), { recursive: true });
for (const assetPath of runtimeAssets) await copyFile(assetPath);

// GameMonetize requires index.html and the game folders at the ZIP root.
execFileSync("tar.exe", ["-a", "-c", "-f", archivePath, "-C", stagingRoot, "index.html", "src", "assets"], { stdio: "inherit" });

const archiveSize = (await stat(archivePath)).size;
await rm(outputMediaRoot, { recursive: true, force: true });
await cp(sourceMediaRoot, outputMediaRoot, { recursive: true });
console.log(`Created ${relative(repoRoot, archivePath)} with ${runtimeAssets.size} runtime assets (${(archiveSize / 1024 / 1024).toFixed(2)} MiB).`);
console.log(`Copied GameMonetize artwork to ${relative(repoRoot, outputMediaRoot)}.`);
