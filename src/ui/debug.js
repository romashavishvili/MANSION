import { T } from '../sequence/schedule.js';
import { CAR_ORDER } from '../config.js';

/**
 * Developer panel (press H, or open with ?debug). Because the look of the scene must be judged on a
 * real GPU, everything that is likely to need taste adjustments is exposed live here.
 */
export class DebugPanel {
  constructor({ el, renderer, stage, cars, opening, rig, tierName }) {
    this.el = el; this.renderer = renderer; this.stage = stage; this.cars = cars; this.opening = opening; this.rig = rig;
    this.tierName = tierName;
    this.frames = 0; this.acc = 0; this.fps = 0; this.shown = false;
    this._build();
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) this.toggle();
    });
    if (new URLSearchParams(location.search).has('debug')) this.toggle(true);
  }

  toggle(force) { this.shown = force ?? !this.shown; this.el.hidden = !this.shown; }

  _slider(label, min, max, step, value, onInput) {
    const l = document.createElement('label');
    const n = document.createElement('span'); n.textContent = label;
    const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = value;
    const v = document.createElement('span'); v.textContent = (+value).toFixed(2);
    r.addEventListener('input', () => { const x = parseFloat(r.value); v.textContent = x.toFixed(2); onInput(x); });
    l.append(n, r, v); this.el.appendChild(l);
    return { r, v };
  }

  _button(text, fn) {
    const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', fn); return b;
  }

  _build() {
    const { el, opening, stage, renderer, cars } = this;
    this.info = document.createElement('pre'); el.appendChild(this.info);

    const s = this._slider('timeline (s)', 0, T.end, 0.05, 0, (x) => { opening.pause(); opening.scrub(x); });
    this.timeSlider = s;
    const row = document.createElement('div'); row.className = 'row';
    this.playBtn = this._button('pause', () => {
      if (opening.playing) { opening.pause(); this.playBtn.textContent = 'play'; } else { opening.resume(); this.playBtn.textContent = 'pause'; }
    });
    row.append(
      this.playBtn,
      this._button('restart', () => { opening.start(); this.playBtn.textContent = 'pause'; }),
      this._button('jump: BMW', () => { opening.pause(); opening.scrub(T.bmw.full + 1); }),
      this._button('BMW lamp', () => { opening.pause(); opening.scrub(10.6); }),
      this._button('Ferrari', () => { opening.pause(); opening.scrub(T.ferrari.full + 1); }),
      this._button('Maybach', () => { opening.pause(); opening.scrub(T.maybach.full + 1); }),
      this._button('finale', () => { opening.pause(); opening.scrub(T.end - 0.2); }),
    );
    el.appendChild(row);

    this._slider('exposure', 0.3, 2.5, 0.01, renderer.toneMappingExposure, (x) => { renderer.toneMappingExposure = x; });
    if (stage.post.bloom) this._slider('bloom', 0, 2, 0.01, stage.post.bloom.strength, (x) => { stage.post.bloom.strength = x; });
    this._slider('light gain', 0.1, 4, 0.01, 1, (x) => { stage.lightScale = x; for (const id of CAR_ORDER) cars[id].setGains(x, cars[id].envGain); });
    this._slider('beam gain', 0, 3, 0.01, 1, (x) => { for (const id of CAR_ORDER) cars[id].setBeamGain(x); });
    this._slider('lamp glow', 0, 3, 0.01, 1, (x) => { for (const id of CAR_ORDER) cars[id].lampGlow = x; });
    this._slider('env gain', 0, 3, 0.01, 1, (x) => { for (const id of CAR_ORDER) cars[id].setGains(cars[id].lightGain, x); });
    this._slider('fog', 0, 0.07, 0.001, stage.fog.density, (x) => { stage.fog.density = x; });
    this._slider('grain', 0, 0.12, 0.002, stage.post.grade.uniforms.uGrain.value, (x) => { stage.post.grade.uniforms.uGrain.value = x; });
    if (stage.floor.reflector) this._slider('mirror blur', 0.2, 4, 0.05, 1, (x) => { stage.floor.reflector.material.uniforms.uBlur.value = x; });
  }

  frame(dt) {
    this.frames++; this.acc += dt;
    if (!this.shown) { if (this.acc > 0.5) { this.acc = 0; this.frames = 0; } return; }
    const o = this.opening;
    if (o.playing && !o.finished) { this.timeSlider.r.value = o.t; this.timeSlider.v.textContent = o.t.toFixed(2); }
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0;
      const i = this.renderer.info;
      this.info.textContent =
        `fps ${this.fps.toFixed(0)}  tier ${this.tierName}  t ${o.t.toFixed(1)}s` +
        `\ncalls ${i.render.calls}  tris ${(i.render.triangles / 1e6).toFixed(2)}M` +
        `\ngeom ${i.memory.geometries}  tex ${i.memory.textures}` +
        `\nmode ${this.rig.mode}${o.waitingFor ? '  WAITING: ' + o.waitingFor : ''}` +
        `\n(H hides · ?quality=low|medium|high)`;
    }
  }
}
