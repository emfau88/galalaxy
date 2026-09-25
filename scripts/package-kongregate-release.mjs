import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSETS } from "../src/assets.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repoRoot, "release", "kongregate");
const stagingRoot = join(releaseRoot, "build");
const archivePath = join(releaseRoot, "galalaxy-kongregate.zip");
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
await copyFile("index.html");
await cp(join(repoRoot, "src"), join(stagingRoot, "src"), { recursive: true });
for (const assetPath of runtimeAssets) await copyFile(assetPath);

// Name each top-level entry explicitly. Kongregate checks for an entry named
// exactly "index.html" and does not reliably resolve a leading "./" in ZIPs.
execFileSync("tar.exe", ["-a", "-c", "-f", archivePath, "-C", stagingRoot, "index.html", "src", "assets"], { stdio: "inherit" });

const archiveSize = (await stat(archivePath)).size;
console.log(`Created ${relative(repoRoot, archivePath)} with ${runtimeAssets.size} runtime assets (${(archiveSize / 1024 / 1024).toFixed(2)} MiB).`);
