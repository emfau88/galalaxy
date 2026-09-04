import { CONFIG } from "./config.js";

export class AssetLoader {
  constructor(manifest = {}) {
    this.manifest = manifest;
    this.images = {};
    this.errors = [];
    this.loaded = 0;
    this.total = 0;
    this.done = false;
    this.pending = new Map();
    this.settled = new Set();
  }

  load(manifest = this.manifest) {
    const entries = Object.entries(manifest);
    Object.assign(this.manifest, manifest);

    const jobs = entries.map(([key, path]) => {
      if (this.settled.has(key)) return Promise.resolve();
      if (this.pending.has(key)) return this.pending.get(key);

      this.total++;
      this.done = false;
      const job = new Promise(resolve => {
        const img = new Image();
        img.decoding = "async";
        let finished = false;

        const finish = error => {
          if (finished) return;
          finished = true;
          clearTimeout(timeoutId);
          if (error) this.errors.push(`${key}: ${error}`);
          this.settled.add(key);
          this.pending.delete(key);
          this.loaded = this.settled.size;
          this.done = this.pending.size === 0;
          resolve();
        };

        img.onload = () => {
          this.images[key] = img;
          finish();
        };
        img.onerror = () => finish(path);
        const timeoutId = setTimeout(() => finish("timeout"), CONFIG.assetTimeoutMs);
        img.src = path;
      });
      this.pending.set(key, job);
      return job;
    });

    if (!jobs.length) this.done = this.pending.size === 0;
    return Promise.all(jobs);
  }

  get(key) {
    return this.images[key] || null;
  }

  progress() {
    return this.total ? this.loaded / this.total : 1;
  }

  isSettled(manifest) {
    return Object.keys(manifest).every(key => this.settled.has(key));
  }

  unload(manifest) {
    for (const key of Object.keys(manifest)) {
      if (this.pending.has(key) || !this.settled.has(key)) continue;
      delete this.images[key];
      this.settled.delete(key);
      this.errors = this.errors.filter(error => !error.startsWith(`${key}:`));
      this.total = Math.max(0, this.total - 1);
    }
    this.loaded = this.settled.size;
    this.done = this.pending.size === 0;
  }
}
