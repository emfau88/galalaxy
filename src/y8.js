export const Y8_APP_ID = "6ab6e4c5e6dd4122f42af26d";
export const Y8_GAME_ID = "284519";
export const Y8_SDK_URL = "https://cdn.y8.com/minimal-sdk/2-0/y8.min.js";

export function isY8Host(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "y8.com" || host.endsWith(".y8.com");
  } catch {
    return false;
  }
}

export function isY8Environment(windowRef = typeof window === "undefined" ? null : window) {
  if (!windowRef) return false;
  if (windowRef.__GALALAXY_PLATFORM__ === "y8") return true;
  if (isY8Host(windowRef.location?.href) || isY8Host(windowRef.document?.referrer)) return true;
  try {
    return [...(windowRef.location?.ancestorOrigins || [])].some(isY8Host);
  } catch {
    return false;
  }
}

export class Y8Bridge {
  constructor(game, options = {}) {
    this.game = game;
    this.windowRef = options.windowRef ?? (typeof window === "undefined" ? null : window);
    this.documentRef = options.documentRef ?? this.windowRef?.document ?? null;
    this.enabled = options.enabled ?? isY8Environment(this.windowRef);
    this.sdk = options.sdk ?? null;
    this.ready = Boolean(this.sdk);
    this.inFlight = false;
    this._readyHandler = () => this._connect();

    if (this.enabled && options.autoLoad !== false) this._load();
  }

  _load() {
    if (!this.windowRef || !this.documentRef) return;
    this.windowRef.addEventListener("y8sdk.ready", this._readyHandler, { once: true });

    const existing = this.documentRef.querySelector(`script[src="${Y8_SDK_URL}"]`);
    if (!existing) {
      const script = this.documentRef.createElement("script");
      script.src = Y8_SDK_URL;
      script.async = true;
      script.addEventListener("error", () => {
        console.warn("Y8 SDK could not be loaded; continuing without ads.");
      }, { once: true });
      this.documentRef.head.append(script);
    }

    // The SDK is async and may have fired its ready event before the game
    // module attached the listener. Asking it to emit again closes that race.
    this.windowRef.y8?.emitReadyEvent?.();
  }

  _connect() {
    if (this.ready) return;
    const sdk = this.windowRef?.y8?.sdk?.();
    if (!sdk) return;

    try {
      sdk.init({
        appId: Y8_APP_ID,
        autoLogin: true,
      }, {
        gameId: Y8_GAME_ID,
        preloadAdBreaks: "on",
        sound: "on",
        onReady: () => {},
      });
      sdk.onAuth?.((_user, error) => {
        if (error) console.warn("Y8 sign-in unavailable; continuing as guest.", error);
      });
      this.sdk = sdk;
      this.ready = true;
    } catch (error) {
      console.warn("Y8 SDK initialization failed; continuing without ads.", error);
    }
  }

  showInterstitial(name, continueGame = () => {}) {
    let continued = false;
    const continueOnce = () => {
      if (continued) return;
      continued = true;
      continueGame();
    };

    if (!this.enabled || !this.ready || !this.sdk?.showAd || this.inFlight) {
      continueOnce();
      return Promise.resolve({ requested: false, status: this.inFlight ? "busy" : "notReady" });
    }

    this.inFlight = true;
    let finished = false;
    let adStarted = false;
    let result = null;
    let resolveResult;
    const completion = new Promise(resolve => { resolveResult = resolve; });

    const restoreAudio = () => {
      if (!adStarted) return;
      adStarted = false;
      this.game?.endPlatformAd?.();
    };
    const finish = status => {
      if (finished) return result;
      finished = true;
      restoreAudio();
      this.inFlight = false;
      result = { requested: true, status };
      continueOnce();
      resolveResult(result);
      return result;
    };

    try {
      const request = this.sdk.showAd({
        type: "next",
        name,
        beforeAd: () => {
          adStarted = true;
          this.game?.beginPlatformAd?.();
        },
        afterAd: restoreAudio,
        adBreakDone: info => finish(info?.breakStatus || "other"),
      });
      // Y8 guarantees adBreakDone for viewed, skipped, capped, and unavailable
      // breaks. Do not continue merely because showAd's request promise
      // resolves: that can happen before the visible break has finished.
      Promise.resolve(request).catch(error => {
        console.warn("Y8 ad break failed; continuing the game.", error);
        finish("error");
      });
    } catch (error) {
      console.warn("Y8 ad request failed; continuing the game.", error);
      finish("error");
    }
    return completion;
  }
}
