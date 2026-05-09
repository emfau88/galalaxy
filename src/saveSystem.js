import { CONFIG } from "./config.js";

export class SaveSystem {
  static best() {
    return Number(localStorage.getItem(CONFIG.saveKey) || 0);
  }

  static setBest(score) {
    if (score > SaveSystem.best()) localStorage.setItem(CONFIG.saveKey, String(Math.floor(score)));
  }
}
