import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSETS } from "../src/assets.js";
import { Y8_SDK_URL } from "../src/y8.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repoRoot, "release", "y8");
const stagingRoot = join(releaseRoot, "build");
const archivePath = join(releaseRoot, "galalaxy-y8.zip");
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
const y8Bootstrap = [
  "  <!-- Y8-only bootstrap: this marker also enables SDK testing on localhost. -->",
  "  <script>window.__GALALAXY_PLATFORM__ = \"y8\";</script>",
  `  <script src="${Y8_SDK_URL}" async></script>`,
].join("\n");
if (!sourceIndex.includes("</head>")) throw new Error("index.html has no closing head tag");
await writeFile(
  join(stagingRoot, "index.html"),
  sourceIndex.replace("</head>", `${y8Bootstrap}\n</head>`),
  "utf8",
);

await cp(join(repoRoot, "src"), join(stagingRoot, "src"), { recursive: true });
for (const assetPath of runtimeAssets) await copyFile(assetPath);

// Y8 expects a single ZIP whose root contains index.html, not another folder.
execFileSync("tar.exe", ["-a", "-c", "-f", archivePath, "-C", stagingRoot, "index.html", "src", "assets"], { stdio: "inherit" });

const archiveSize = (await stat(archivePath)).size;
console.log(`Created ${relative(repoRoot, archivePath)} with ${runtimeAssets.size} runtime assets (${(archiveSize / 1024 / 1024).toFixed(2)} MiB).`);
