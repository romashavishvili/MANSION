/**
 * Optional cinematic sound. Procedural (WebAudio, no files): a low, slowly breathing drone whose brightness
 * follows scroll progress, plus soft cues on section changes. Design rules:
 *   - OFF by default; nothing is created until the visitor presses the toggle (browser autoplay policy).
 *   - Fades in/out, suspends when the tab is hidden, never starts by itself.
 * There is deliberately no engine sound: no engine audio exists, and a synthesised one would be fake.
 * The AudioContext class is injectable so the logic is unit-tested without a browser.
 */
export class Sound {
  constructor({ AudioCtx } = {}) {
    this.AudioCtx = AudioCtx ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.supported = !!this.AudioCtx;
    this.on = false;
    this.ctx = null;
    this.n = null;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend?.(); else if (this.on) this.ctx.resume?.();
      });
    }
  }

  _build() {
    const ctx = (this.ctx = new this.AudioCtx());
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7; lp.connect(master);
    for (const [f, g] of [[55, 0.22], [55.45, 0.2], [82.4, 0.09]]) {          // a detuned fifth-ish drone
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); o.start();
    }
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.03; noise.connect(ng); ng.connect(lp); noise.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.n = { master, lp };
  }

  async enable() {
    if (!this.supported || this.on) return this.on;
    if (!this.ctx) this._build();
    await this.ctx.resume?.();
    const t = this.ctx.currentTime, g = this.n.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.5, t + 2.5);
    this.on = true;
    return true;
  }

  disable() {
    if (!this.on) return false;
    this.on = false;
    const t = this.ctx.currentTime, g = this.n.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => { if (!this.on) this.ctx.suspend?.(); }, 900);
    return false;
  }

  async toggle() { return this.on ? this.disable() : this.enable(); }

  /** 0..1 along the page: the drone slowly opens up as the story unfolds. */
  setProgress(p) {
    if (!this.on || !this.ctx) return;
    this.n.lp.frequency.setTargetAtTime(180 + 720 * Math.min(1, Math.max(0, p)), this.ctx.currentTime, 0.8);
  }

  /** A soft, low tone. kind: 'section' | 'beat' */
  cue(kind = 'section') {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = kind === 'beat' ? 392 : 196;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.3);
    o.connect(g); g.connect(this.n.master); o.start(t); o.stop(t + 1.4);
  }
}
