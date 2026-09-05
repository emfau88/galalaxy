import { existsSync, statSync, readFileSync } from "node:fs";
import { ASSETS } from "../src/assets.js";

const missing = Object.entries(ASSETS).filter(([, path]) => !existsSync(path));
if (missing.length) {
  for (const [key, path] of missing) console.error(`Missing ${key}: ${path}`);
  process.exitCode = 1;
} else {
  const runtimeBytes = Object.values(ASSETS)
    .reduce((sum, path) => sum + statSync(path).size, 0);
  console.log(`Asset manifest OK: ${Object.keys(ASSETS).length} files, ${(runtimeBytes / 1024 / 1024).toFixed(2)} MiB compressed`);
  const decoded = path => {
    const png = readFileSync(path);
    return png.readUInt32BE(16) * png.readUInt32BE(20) * 4;
  };
  const uiPaths = Object.entries(ASSETS).filter(([key]) => key.startsWith("ui")).map(([, path]) => path);
  const before = uiPaths.reduce((sum, path) => sum + decoded(path.replace("/runtime/", "/")), 0);
  const after = uiPaths.reduce((sum, path) => sum + decoded(path), 0);
  console.log(`UI decoded RGBA: ${(before / 1048576).toFixed(2)} -> ${(after / 1048576).toFixed(2)} MiB (${(100 * (1 - after / before)).toFixed(1)}% lower)`);
}
