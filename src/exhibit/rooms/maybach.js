import { RoomBase } from './base.js';
import { PaintController, FINISHES } from '../paint.js';

const PAINTS = [
  { name: 'Obsidian',   hex: 0x050507 },
  { name: 'Champagne',  hex: 0xb9a37c },
  { name: 'Silver',     hex: 0x9a9ea5 },
  { name: 'Verdigris',  hex: 0x16382f },
  { name: 'Midnight',   hex: 0x111a38 },
];
const EVENINGS = {
  dusk:      { name: 'Dusk',      gain: 0.85, env: 0.9,  lamps: 1.0, accent: 0xffb870 },
  champagne: { name: 'Champagne', gain: 1.1,  env: 1.25, lamps: 0.5, accent: 0xffd9a6 },
  moon:      { name: 'Moonlight', gain: 0.7,  env: 0.55, lamps: 0.0, accent: 0x8da2ff },
};
const COPY = {
  arrival: 'The car arrives the way it is meant to be seen: slowly, and entirely.',
  face:    'The grille and bonnet edge: chrome, gloss black and paint meeting at tolerances that show every fingerprint.',
  line:    'One long, unbroken reflection from front wing to rear door. Preparation is judged here.',
  rear:    'Lamps, chrome and a deep panel. Quiet surfaces need the most patience.',
  study:   'From above, the car reads as architecture. This is the view that tells the truth about a finish.',
};

/** Room III - EXCLUSIVITY. Quiet, slow, architectural: stations rather than controls, evening light, curated paints. */
export class MaybachRoom extends RoomBase {
  mount() {
    const st = this.cfg.stations;
    this.mountEl(`
      <button class="rm-leave" type="button" data-leave data-cursor="Leave"><span>Leave room</span></button>
      <div class="may-word" aria-hidden="true">Maybach</div>
      <header class="rm-head"><p class="rm-kicker"><span>III</span><b></b>Exclusivity</p></header>
      <aside class="may-side">
        <ol class="may-stations" aria-label="Stations">${st.map((s, i) => `<li><button type="button" data-i="${i}"><span class="n">${['I', 'II', 'III', 'IV', 'V'][i]}</span><span class="t">${s.name}</span></button></li>`).join('')}</ol>
        <p class="may-copy" aria-live="polite"></p>
        <div class="may-ctl">
          <h3>Paint</h3>
          <div class="may-paints" role="radiogroup" aria-label="Paint">${PAINTS.map((p) => `<button type="button" role="radio" aria-checked="false" data-hex="${p.hex}"><i style="--c:#${p.hex.toString(16).padStart(6, '0')}"></i><span>${p.name}</span></button>`).join('')}</div>
          <h3>Finish</h3>
          <div class="may-fin" role="radiogroup" aria-label="Finish">${['gloss', 'satin'].map((k) => `<button type="button" role="radio" aria-checked="false" data-k="${k}">${FINISHES[k].label}</button>`).join('')}</div>
          <h3>Evening</h3>
          <div class="may-fin" role="radiogroup" aria-label="Evening light">${Object.entries(EVENINGS).map(([k, e]) => `<button type="button" role="radio" aria-checked="false" data-k="${k}">${e.name}</button>`).join('')}</div>
        </div>
        <p class="may-note">An interior view is not offered: the supplied model has no separable cabin.</p>
      </aside>`, 'room--maybach');

    const ex = this.exhibit;
    this.paint = new PaintController(this.car);
    this.paint.setFinish('gloss'); this.paint.setColor(PAINTS[0].hex);
    this.radio('.may-paints button', (b) => this.paint.setColor(+b.dataset.hex), this.$('.may-paints button'));
    const groups = this.$$('.may-ctl .may-fin');
    this.radio(groups[0].querySelectorAll('button'), (b) => this.paint.setFinish(b.dataset.k));
    const setEv = (b) => { const e = EVENINGS[b.dataset.k]; ex.setScene({ gain: e.gain, env: e.env, lamps: e.lamps, accent: e.accent }); };
    this.radio(groups[1].querySelectorAll('button'), setEv); setEv(groups[1].querySelector('button'));

    this.copy = this.$('.may-copy'); this.stationBtns = this.$$('.may-stations button');
    this.stationBtns.forEach((b) => this.on(b, 'click', () => { this.drift = false; this.station(+b.dataset.i); }));
    this.stationBtns[0].setAttribute('data-autofocus', '');
    this.drift = !this.reduced; ex.rig.controls.autoRotateSpeed = 0.35; ex.rig.controls.autoRotate = false;
    this.station(0, true);
    this.gsap.from(this.el.querySelectorAll('.rm-head, .may-side > *, .may-word'), { autoAlpha: 0, y: 12, duration: 1.4, stagger: 0.12, ease: 'power2.out', delay: 0.3 });
  }

  station(i, first = false) {
    const s = this.cfg.stations[i]; this.i = i;
    this.exhibit.go(s, { dur: first ? 0 : 4.6, ease: 'sine.inOut', onDone: () => { if (this.drift) this.later(() => { this.exhibit.rig.controls.autoRotate = this.drift && !this.reduced; }, 1200); } });
    this.exhibit.rig.controls.autoRotate = false;
    this.stationBtns.forEach((b, k) => b.classList.toggle('on', k === i));
    this.gsap.fromTo(this.copy, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power2.out' });
    this.copy.textContent = COPY[s.id];
  }

  onUserOrbit(down) { if (down) { this.exhibit.rig.controls.autoRotate = false; this.drift = false; } }
  update(dt) { this.paint.update(dt, 1.4); }   // slow, deliberate material transitions
}
