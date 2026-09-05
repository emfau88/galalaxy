const CUES = {
  hit:     { frequency: 120, type: "triangle", duration: 0.07, volume: 0.045, cooldown: 0.08 },
  kill:    { frequency: 330, type: "square",   duration: 0.055, volume: 0.028, cooldown: 0.045 },
  upgrade: { frequency: 520, type: "sine",     duration: 0.16, volume: 0.055, cooldown: 0.14, harmony: 660 },
  boss:    { frequency: 86,  type: "sawtooth", duration: 0.28, volume: 0.055, cooldown: 0.5, sweep: 56 },
};

export class SoundSystem {
  constructor(muted = false) {
    this.muted = muted;
    this.context = null;
    this.lastPlayed = new Map();
  }

  unlock() {
    if (this.muted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  play(name) {
    const cue = CUES[name];
    if (!cue || this.muted) return;
    this.unlock();
    const context = this.context;
    if (!context || context.state !== "running") return;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < cue.cooldown) return;
    this.lastPlayed.set(name, now);
    this._tone(now, cue.frequency, cue);
    if (cue.harmony) this._tone(now + 0.035, cue.harmony, { ...cue, volume: cue.volume * 0.55 });
  }

  _tone(start, frequency, cue) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = cue.type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (cue.sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, cue.sweep), start + cue.duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(cue.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + cue.duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + cue.duration + 0.02);
  }
}
