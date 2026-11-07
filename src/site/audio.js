// Optional ambience, synthesised with Web Audio (no audio files exist in the project, so none are faked).
// Never starts by itself: it is created on the first click of the sound button (a user gesture).
export class Ambience {
  constructor(btn) {
    this.btn = btn; this.ctx = null; this.on = false;
    this.supported = !!(window.AudioContext || window.webkitAudioContext);
    if (!this.supported) { btn.hidden = true; return; }
    btn.addEventListener('click', () => this.toggle());
  }
  _build() {
    const A = window.AudioContext || window.webkitAudioContext;
    this.ctx = new A();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0; this.master.connect(c.destination);
    // low room tone: two detuned sines, one slow-breathing lowpassed noise bed
    for (const [f, g] of [[55, 0.5], [82.6, 0.22]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gn = c.createGain(); gn.gain.value = g; o.connect(gn).connect(this.master); o.start(); }
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    n.connect(lp).connect(this.master); n.start();
  }
  async toggle() {
    if (!this.ctx) this._build();
    this.on = !this.on;
    if (this.on) await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(this.on ? 0.16 : 0, t, 0.6);
    if (!this.on) setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 2500);
    this.btn.setAttribute('aria-pressed', String(this.on));
    this.btn.querySelector('.sound__label').textContent = this.on ? 'Sound on' : 'Sound off';
  }
}
