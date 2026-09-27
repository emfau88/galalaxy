export const GAMEMONETIZE_GAME_ID = "aigvlrz2fcu4j3648qlmni6v8xwacflx";
export const GAMEMONETIZE_SDK_URL = "https://api.gamemonetize.com/sdk.js";
export const GAMEMONETIZE_EVENT = "galalaxy:gamemonetize";

export function isGameMonetizeHost(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return [
      "gamemonetize.com",
      "gamemonetize.co",
      "gamemonetize.games",
    ].some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function isGameMonetizeEnvironment(windowRef = typeof window === "undefined" ? null : window) {
  if (!windowRef) return false;
  if (windowRef.__GALALAXY_PLATFORM__ === "gamemonetize") return true;
  if (isGameMonetizeHost(windowRef.location?.href) || isGameMonetizeHost(windowRef.document?.referrer)) return true;
  try {
    return [...(windowRef.location?.ancestorOrigins || [])].some(isGameMonetizeHost);
  } catch {
    return false;
  }
}

export class GameMonetizeBridge {
  constructor(game, options = {}) {
    this.game = game;
    this.windowRef = options.windowRef ?? (typeof window === "undefined" ? null : window);
    this.documentRef = options.documentRef ?? this.windowRef?.document ?? null;
    this.enabled = options.enabled ?? isGameMonetizeEnvironment(this.windowRef);
    this.sdk = options.sdk ?? this.windowRef?.sdk ?? null;
    this.ready = options.ready ?? Boolean(this.windowRef?.__GALALAXY_GAMEMONETIZE_READY__);
    this.inFlight = false;
    this.pendingFinish = null;
    this._eventHandler = event => this._handleEvent(event?.detail || event);

    if (this.enabled && options.autoLoad !== false) this._load();
  }

  _load() {
    if (!this.windowRef || !this.documentRef) return;
    this.windowRef.addEventListener(GAMEMONETIZE_EVENT, this._eventHandler);

    const previousOnEvent = this.windowRef.SDK_OPTIONS?.onEvent;
    this.windowRef.SDK_OPTIONS = {
      ...(this.windowRef.SDK_OPTIONS || {}),
      gameId: GAMEMONETIZE_GAME_ID,
      onEvent: event => {
        this.windowRef.__GALALAXY_GAMEMONETIZE_READY__ ||= event?.name === "SDK_READY";
        previousOnEvent?.(event);
        this.windowRef.dispatchEvent(new CustomEvent(GAMEMONETIZE_EVENT, { detail: event }));
      },
    };

    const existing = this.documentRef.querySelector(`#gamemonetize-sdk, script[src="${GAMEMONETIZE_SDK_URL}"]`);
    if (existing) return;

    const script = this.documentRef.createElement("script");
    script.id = "gamemonetize-sdk";
    script.src = GAMEMONETIZE_SDK_URL;
    script.async = true;
    script.addEventListener("error", () => {
      console.warn("GameMonetize SDK could not be loaded; continuing without ads.");
      this._finish("load-error");
    }, { once: true });
    this.documentRef.head.append(script);
  }

  _handleEvent(event) {
    switch (event?.name) {
      case "SDK_READY":
        this.sdk = this.windowRef?.sdk ?? this.sdk;
        this.ready = true;
        break;
      case "SDK_GAME_PAUSE":
        this.game?.beginPlatformAd?.();
        break;
      case "SDK_GAME_START":
        this._finish("completed");
        break;
      case "SDK_ERROR":
        console.warn("GameMonetize ad error; continuing the game.", event);
        this._finish("error");
        break;
    }
  }

  _finish(status) {
    this.game?.endPlatformAd?.();
    if (!this.inFlight) return { requested: false, status };

    const finish = this.pendingFinish;
    this.pendingFinish = null;
    this.inFlight = false;
    return finish?.(status) ?? { requested: true, status };
  }

  showInterstitial(placement, continueGame = () => {}) {
    let continued = false;
    const continueOnce = () => {
      if (continued) return;
      continued = true;
      continueGame();
    };
    const sdk = this.windowRef?.sdk ?? this.sdk;

    if (!this.enabled || !this.ready || typeof sdk?.showBanner !== "function" || this.inFlight) {
      continueOnce();
      return Promise.resolve({ requested: false, status: this.inFlight ? "busy" : "not-ready" });
    }

    this.sdk = sdk;
    this.inFlight = true;
    this.lastPlacement = placement;
    const completion = new Promise(resolve => {
      this.pendingFinish = status => {
        const result = { requested: true, status };
        continueOnce();
        resolve(result);
        return result;
      };
    });

    try {
      const request = sdk.showBanner();
      Promise.resolve(request).catch(error => {
        console.warn("GameMonetize ad request failed; continuing the game.", error);
        this._finish("error");
      });
    } catch (error) {
      console.warn("GameMonetize ad request failed; continuing the game.", error);
      this._finish("error");
    }

    return completion;
  }
}
