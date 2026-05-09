import { CONFIG } from "./config.js";

export class AssetLoader {
  constructor(manifest) {
    this.manifest = manifest;
    this.images = {};
    this.errors = [];
    this.loaded = 0;
    this.total = Object.keys(manifest).length;
    this.done = false;
  }

  load() {
    return new Promise(resolve => {
      const entries = Object.entries(this.manifest);
      if (!entries.length) {
        this.done = true;
        resolve();
        return;
      }

      let settled = 0;
      const finishOne = () => {
        settled++;
        this.loaded = settled;
        if (settled >= entries.length) {
          this.done = true;
          resolve();
        }
      };

      for (const [key, path] of entries) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          this.images[key] = img;
          finishOne();
        };
        img.onerror = () => {
          this.errors.push(`${key}: ${path}`);
          finishOne();
        };
        setTimeout(() => {
          if (!this.images[key] && !this.errors.some(e => e.startsWith(key + ":"))) {
            this.errors.push(`${key}: timeout`);
            finishOne();
          }
        }, CONFIG.assetTimeoutMs);
        img.src = path;
      }
    });
  }

  get(key) {
    return this.images[key] || null;
  }

  progress() {
    return this.total ? this.loaded / this.total : 1;
  }
}
