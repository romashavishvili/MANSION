import { RoomBase } from './base.js';
import { PaintController, FINISHES } from '../paint.js';
import { ANCHORS } from '../../config.js';

const PAINTS = [
  { id: 'black',  name: 'Black sapphire', hex: 0x0b0c10 },
  { id: 'white',  name: 'Alpine white',   hex: 0xe9e9e4 },
  { id: 'grey',   name: 'Brooklyn grey',  hex: 0x6b6f75 },
  { id: 'red',    name: 'Imola red',      hex: 0xb10d14 },
  { id: 'blue',   name: 'Portimao blue',  hex: 0x1b3f9a },
  { id: 'green',  name: 'British racing', hex: 0x0e4a2f },
  { id: 'orange', name: 'Sunset copper',  hex: 0xc2561a },
  { id: 'silver', name: 'Frozen silver',  hex: 0xb9bcc2 },
];
const LIGHTS = {
  studio: { gain: 0.8, env: 1.45, lamps: 0.0, accent: 0xdfe6ff },
  track:  { gain: 1.7, env: 0.8,  lamps: 1.0, accent: 0xff1f2a },
  night:  { gain: 0.9, env: 0.3,  lamps: 1.0, accent: 0x6f86ff },
};
// What each point is, in detailing terms. Dimensions come from the model; nothing else is claimed about the real car.
const SPOTS = {
  lamp:   { view: 'lamp',   title: 'Headlamp', text: 'Polycarbonate lenses haze and micro-scratch from road debris and UV. Restoring and sealing them returns the optical clarity the lamp was designed around.' },
  wheel:  { view: 'wheel',  title: 'Wheel',    text: 'Barrel, spokes and brake dust collect the harshest contamination on the car. Safe chemical decontamination, then a sealant, makes the wheel easier to keep clean.' },
  grille: { view: 'grille', title: 'Grille',   text: 'Fine mesh and recesses hold insects and road film that a wash misses. Detail work here is slow, hand-done and easy to see once it is finished.' },
};

/** Room I - PRECISION. A technical inspection bench: configurator, measured readouts, projected hotspots. */
export class BmwRoom extends RoomBase {
  mount() {
    const m = this.car.meta, [w, h, l] = m.size;
    this.mountEl(`
      <button class="rm-leave" type="button" data-leave data-cursor="Leave"><span>Leave room</span></button>
      <header class="rm-head"><p class="rm-kicker"><span>I</span><b></b>Precision</p><h2 class="rm-title">BMW <em>M5</em></h2>
        <p class="rm-sub">Paint, light and detail inspection, live on the real 3D model.</p></header>
      <aside class="rm-panel tech" aria-label="BMW M5 controls">
        <section><h3>Paint <output id="bmw-pn">${PAINTS[0].name}</output></h3>
          <div class="sw" role="radiogroup" aria-label="Paint colour">${PAINTS.map((p) => `<button type="button" role="radio" aria-checked="false" aria-label="${p.name}" data-hex="${p.hex}" data-name="${p.name}" style="--c:#${p.hex.toString(16).padStart(6, '0')}"></button>`).join('')}</div></section>
        <section><h3>Finish</h3>
          <div class="seg" role="radiogroup" aria-label="Paint finish">${Object.entries(FINISHES).map(([k, f]) => `<button type="button" role="radio" aria-checked="false" data-k="${k}">${f.label}</button>`).join('')}</div></section>
        <section><h3>Light</h3>
          <div class="seg" role="radiogroup" aria-label="Lighting">${Object.keys(LIGHTS).map((k) => `<button type="button" role="radio" aria-checked="false" data-k="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
          <label class="tog"><input id="bmw-lamps" type="checkbox"><span>Headlamps</span></label></section>
        <section><h3>Inspect</h3>
          <div class="views">${Object.entries(this.cfg.views).map(([k, v]) => `<button type="button" data-view="${k}">${v.label}</button>`).join('')}</div>
          <label class="tog"><input id="bmw-orbit" type="checkbox"><span>Orbit 360&deg;</span></label></section>
        <section class="meas"><h3>Measured <i>from the 3D model</i></h3>
          <dl><div><dt>Length</dt><dd>${l.toFixed(2)} m</dd></div><div><dt>Width</dt><dd>${w.toFixed(2)} m</dd></div><div><dt>Height</dt><dd>${h.toFixed(2)} m</dd></div><div><dt>Wheel &#8960;</dt><dd>${(ANCHORS.bmw.wheelR * 2).toFixed(2)} m</dd></div></dl>
          <p class="live" aria-hidden="true">AZ <b id="bmw-az">000</b>&deg; &nbsp; EL <b id="bmw-el">00</b>&deg;</p></section>
      </aside>
      <div class="spots" aria-label="Detail hotspots">${Object.entries(SPOTS).map(([k, s]) => `<button class="spot" type="button" data-spot="${k}" data-cursor="Inspect"><i></i><span>${s.title}</span></button>`).join('')}</div>
      <aside class="rm-card" hidden aria-live="polite"><h3></h3><p></p></aside>`, 'room--bmw');

    this.paint = new PaintController(this.car);
    const ex = this.exhibit;
    this.radio('.sw button', (b) => { this.paint.setColor(+b.dataset.hex); this.$('#bmw-pn').textContent = b.dataset.name; }, this.$('.sw button'));
    this.paint.setFinish('gloss'); this.paint.setColor(PAINTS[0].hex);
    const finishBtns = this.$$('section:nth-of-type(2) .seg button');
    const lightBtns = this.$$('section:nth-of-type(3) .seg button');
    finishBtns.forEach((b) => this.on(b, 'click', () => { this._set(finishBtns, b); this.paint.setFinish(b.dataset.k); }));
    lightBtns.forEach((b) => this.on(b, 'click', () => { this._set(lightBtns, b); this._light(b.dataset.k); }));
    this._set(finishBtns, finishBtns[0]); this._set(lightBtns, lightBtns[0]);
    this.lampBox = this.$('#bmw-lamps');
    this._light('studio');
    this.on(this.lampBox, 'change', () => ex.setScene({ lamps: this.lampBox.checked ? 1 : 0 }));
    this.on(this.$('#bmw-orbit'), 'change', (e) => { ex.rig.controls.autoRotate = e.target.checked && !this.reduced; ex.rig.controls.autoRotateSpeed = 1.1; });
    this.$$('[data-view]').forEach((b) => this.on(b, 'click', () => { this._card(null); ex.go(this.cfg.views[b.dataset.view], { dur: 2.2 }); }));
    this.$$('.spot').forEach((b) => this.on(b, 'click', () => { const s = SPOTS[b.dataset.spot]; this._card(s); ex.go(this.cfg.views[s.view], { dur: 2.4 }); }));
    this.spots = this.$$('.spot'); this._p = {};
    this.anchors = { lamp: ANCHORS.bmw.lamp, wheel: ANCHORS.bmw.wheel, grille: ANCHORS.bmw.grille };
    this.az = this.$('#bmw-az'); this.el_ = this.$('#bmw-el');
    this.gsap.from(this.el.querySelectorAll('.rm-head > *, .tech section'), { autoAlpha: 0, y: 14, duration: 0.9, stagger: 0.05, ease: 'power3.out', delay: 0.15 });
  }

  _set(btns, on) { btns.forEach((x) => { const s = x === on; x.classList.toggle('on', s); x.setAttribute('aria-checked', String(s)); x.tabIndex = s ? 0 : -1; }); }

  _light(k) { const L = LIGHTS[k]; this.exhibit.setScene({ gain: L.gain, env: L.env, accent: L.accent, lamps: this.lampBox.checked ? 1 : L.lamps }); if (k !== 'studio') { this.lampBox.checked = L.lamps > 0; } else this.lampBox.checked = false; }

  _card(s) { const c = this.$('.rm-card'); if (!s) { c.hidden = true; return; } c.hidden = false; c.querySelector('h3').textContent = s.title; c.querySelector('p').textContent = s.text; this.gsap.fromTo(c, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }); }

  update(dt) {
    this.paint.update(dt);
    const ex = this.exhibit;
    for (const b of this.spots) {
      const p = ex.project(this.anchors[b.dataset.spot], this._p);
      b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      b.style.opacity = p.on ? '' : '0';
    }
    const cp = ex._local(ex.rig.camera.position);
    this.az.textContent = String(Math.round(((Math.atan2(cp[0], cp[2]) * 180 / Math.PI) + 360) % 360)).padStart(3, '0');
    this.el_.textContent = String(Math.round(Math.atan2(cp[1], Math.hypot(cp[0], cp[2])) * 180 / Math.PI)).padStart(2, '0');
  }
}
