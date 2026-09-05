import { CONFIG } from "./config.js";

export class SaveSystem {
  static best() {
    try {
      return Number(localStorage.getItem(CONFIG.saveKey) || 0);
    } catch {
      return 0;
    }
  }

  static setBest(score) {
    if (score <= SaveSystem.best()) return;
    try {
      localStorage.setItem(CONFIG.saveKey, String(Math.floor(score)));
    } catch {
      // Private browsing and storage quotas must never prevent a run from ending.
    }
  }

  static settings() {
    return SaveSystem.readJson(CONFIG.settingsKey, { audioMuted: false });
  }

  static setAudioMuted(audioMuted) {
    SaveSystem.writeJson(CONFIG.settingsKey, { ...SaveSystem.settings(), audioMuted: Boolean(audioMuted) });
  }

  static readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      if (!value) return fallback;
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  static writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local run insights are optional; gameplay remains fully offline.
    }
  }
}
