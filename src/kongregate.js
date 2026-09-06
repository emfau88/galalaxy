import { CONFIG } from "./config.js";
import { SaveSystem } from "./saveSystem.js";

const API_URL = "https://cdn1.kongregate.com/javascripts/kongregate_api.js";

export const KONGREGATE_STATS = Object.freeze({
  HighScore: "Max",
  SectorReached: "Max",
  MaxLevel: "Max",
  KeystoneInstalled: "Max",
  GameComplete: "Max",
});

export function isKongregateHost(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "kongregate.com" ||
      host.endsWith(".kongregate.com") ||
      host === "konggames.com" ||
      host.endsWith(".konggames.com")
    );
  } catch {
    return false;
  }
}

export function isKongregateEnvironment() {
  if (isKongregateHost(window.location.href) || isKongregateHost(document.referrer)) return true;
  try {
    return [...(window.location.ancestorOrigins || [])].some(isKongregateHost);
  } catch {
    return false;
  }
}

export function kongregateStatsForRun(run) {
  return {
    HighScore: Math.max(0, Math.floor(run?.score || 0)),
    SectorReached: Math.max(1, Math.floor(run?.sectorReached || 1)),
    MaxLevel: Math.max(1, Math.floor(run?.level || 1)),
    KeystoneInstalled: run?.keystone ? 1 : 0,
    GameComplete: run?.outcome === "victory" ? 1 : 0,
  };
}

export class KongregateBridge {
  constructor() {
    this.api = null;
    this.ready = false;
    this.saved = SaveSystem.readJson(CONFIG.kongregateStatsKey, {});
    if (isKongregateEnvironment()) this._load();
  }

  _load() {
    const existing = document.querySelector(`script[src="${API_URL}"]`);
    if (existing) {
      if (window.kongregateAPI) this._connect();
      else existing.addEventListener("load", () => this._connect(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.addEventListener("load", () => this._connect(), { once: true });
    script.addEventListener("error", () => console.warn("Kongregate API could not be loaded."), { once: true });
    document.head.append(script);
  }

  _connect() {
    if (!window.kongregateAPI?.loadAPI) return;
    window.kongregateAPI.loadAPI(() => {
      this.api = window.kongregateAPI.getAPI();
      this.ready = Boolean(this.api?.stats?.submit);
      if (this.ready) this._submitAll();
    });
  }

  recordRun(run) {
    for (const [name, value] of Object.entries(kongregateStatsForRun(run))) {
      this.saved[name] = Math.max(Number(this.saved[name]) || 0, value);
    }
    SaveSystem.writeJson(CONFIG.kongregateStatsKey, this.saved);
    if (this.ready) this._submitAll();
  }

  _submitAll() {
    for (const name of Object.keys(KONGREGATE_STATS)) {
      const value = Math.max(0, Math.floor(Number(this.saved[name]) || 0));
      this.api.stats.submit(name, value);
    }
  }
}
