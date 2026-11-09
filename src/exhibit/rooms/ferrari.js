import * as THREE from 'three';
import { RoomBase } from './base.js';
import { ROOM_SHOTS } from '../shots.js';
import { localToWorld } from '../../math/pose.js';
import { LAYOUT } from '../../config.js';
import { ramp, smoothstep } from '../../sequence/curves.js';

// What the camera is looking at, said in detailing terms (no claims about the real car beyond what the model shows).
const COPY = {
  nose:     'The leading edge. Every stone, insect and mile of road film arrives here first, which is why it is the surface we inspect first.',
  lamp:     'Lenses haze and micro-scratch long before they fail. Light the lamp and the difference between restored and tired is immediate.',
  flank:    'Paint is read as reflection. A true panel carries one unbroken line of light; swirls and haze break it into noise.',
  shoulder: 'Where the surface turns, light turns with it. The highlight along the shoulder is the quickest honest test of a finish.',
  wheel:    'Barrel, face and caliper. Watch the wheel turn: it is the real wheel geometry from the model, rolling about its measured axle.',
  tail:     'Diffuser and rear deck: low, textured and always dirty. Detail work here is slow because it has to be thorough.',
  crown:    'From above, the whole car resolves into one form. This is how the finished work is judged: all of it, at once.',
};
const DWELL = 3.2, TRAVEL = 5.4;

/** Room II - SCULPTURE. A cinematic exhibition: letterboxed, choreographed, one sculptural light you can swing round. */
export class FerrariRoom extends RoomBase {
  mount() {
    const ch = this.cfg.chapters;
    this.mountEl(`
      <div class="bars" aria-hidden="true"><i></i><i></i></div>
      <button class="rm-leave" type="button" data-leave data-cursor="Leave"><span>Leave room</span></button>
      <header class="rm-head rm-head--fer"><p class="rm-kicker"><span>II</span><b></b>Sculpture</p></header>
      <div class="fer-cap" aria-live="polite"><p class="fer-n"></p><h2 class="fer-t"></h2><p class="fer-p"></p></div>
      <button class="fer-begin" type="button" data-autofocus data-cursor="Begin"><span>Begin the exhibition</span><i></i></button>
      <div class="fer-dial" role="group" aria-label="Key light">
        <svg viewBox="-60 -60 120 120" width="120" height="120" aria-hidden="true"><circle r="46" class="ring"/><path id="dial-car" class="car" d="M-8 -20 L8 -20 L10 18 L-10 18 Z"/><line class="beam" id="dial-beam" x1="0" y1="0" x2="0" y2="-46"/><circle class="knob" id="dial-knob" r="6" cx="0" cy="-46" tabindex="-1"/></svg>
        <div><p>Key light</p><label class="rng"><span>Height</span><input id="fer-h" type="range" min="1.2" max="5" step="0.05" value="3.4" aria-label="Key light height"></label>
        <p class="hint">Drag the light round the car, or use the arrow keys.</p></div>
      </div>
      <nav class="fer-chapters" aria-label="Chapters">${ch.map((c, i) => `<button type="button" data-i="${i}" aria-label="${c.name}"><i></i><span>${c.name}</span></button>`).join('')}</nav>
      <div class="fer-ctl"><button id="fer-play" type="button" aria-pressed="false">Pause</button><button id="fer-roll" type="button" aria-pressed="false">Roll wheels</button></div>`, 'room--ferrari');

    const ex = this.exhibit;
    this.az = 2.35; this.light = new THREE.Vector3();
    this.idx = -1; this.mode = 'idle';   // idle | play | free
    this.keyOn = 0;                       // eased intensity of the sweep light
    this.lampsT = 1; this.rollT = 0; this.roll = false;
    ex.setScene({ gain: 0.8, env: 1.1, lamps: 0.22, accent: 0xc4121a });
    this.bars = this.$$('.bars i');
    this.gsap.fromTo(this.bars, { scaleY: 0 }, { scaleY: 1, duration: this.reduced ? 0 : 1.4, ease: 'expo.inOut' });
    this.cap = { n: this.$('.fer-n'), t: this.$('.fer-t'), p: this.$('.fer-p') };

    this.on(this.$('.fer-begin'), 'click', () => { this.$('.fer-begin').hidden = true; this.play(0); });
    this.$$('.fer-chapters button').forEach((b) => this.on(b, 'click', () => { this.pause(); this.chapter(+b.dataset.i, TRAVEL * 0.8); this.$('.fer-begin').hidden = true; }));
    this.playBtn = this.$('#fer-play');
    this.on(this.playBtn, 'click', () => { if (this.mode === 'play') this.pause(); else this.play(Math.max(0, this.idx)); });
    this.rollBtn = this.$('#fer-roll');
    this.on(this.rollBtn, 'click', () => { this.roll = !this.roll; this.rollBtn.setAttribute('aria-pressed', String(this.roll)); });
    if (!this.car.wheels) this.rollBtn.hidden = true;

    // the dial: pointer drag + keys
    const dial = this.$('.fer-dial svg');
    const setAz = (e) => { const r = dial.getBoundingClientRect(); this.az = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))); this.manualLight = true; };
    let drag = false;
    this.on(dial, 'pointerdown', (e) => { drag = true; dial.setPointerCapture(e.pointerId); setAz(e); });
    this.on(dial, 'pointermove', (e) => { if (drag) setAz(e); });
    this.on(dial, 'pointerup', () => { drag = false; });
    dial.parentElement.tabIndex = 0;
    this.on(dial.parentElement, 'keydown', (e) => { if (e.key === 'ArrowLeft') { this.az -= 0.12; this.manualLight = true; } if (e.key === 'ArrowRight') { this.az += 0.12; this.manualLight = true; } });
    this.height = this.$('#fer-h');
    this.knob = this.$('#dial-knob'); this.beam = this.$('#dial-beam'); this.dcar = this.$('#dial-car');
    this.manualLight = false;
    this.gsap.from(this.el.querySelectorAll('.fer-dial, .fer-chapters, .fer-ctl, .fer-begin'), { autoAlpha: 0, y: 16, duration: 1, stagger: 0.08, ease: 'power3.out', delay: 0.5 });
  }

  chapter(i, travel = TRAVEL) {
    const c = this.cfg.chapters[i]; if (!c) return;
    this.idx = i; this.chapterT = 0;
    this.exhibit.go(c, { dur: travel, ease: 'power2.inOut' });
    this.$$('.fer-chapters button').forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('done', k < i); });
    const t = this.cap.t;
    this.gsap.timeline()
      .to([this.cap.n, t, this.cap.p], { autoAlpha: 0, y: -10, duration: 0.3, stagger: 0.03, ease: 'power2.in' })
      .add(() => { this.cap.n.textContent = `${String(i + 1).padStart(2, '0')} / ${String(this.cfg.chapters.length).padStart(2, '0')}`; t.textContent = c.name; this.cap.p.textContent = COPY[c.id]; })
      .fromTo([this.cap.n, t, this.cap.p], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out' });
    // the lamp chapter replays the ignition; otherwise lamps stay lit
    if (c.id === 'lamp') { this.lampClock = 0; }
    if (c.id === 'wheel') { this.roll = true; this.rollBtn.setAttribute('aria-pressed', 'true'); }
    // an unattended exhibition moves the light with the camera: the key light rakes from the side the camera is on
    if (!this.manualLight) this.az = Math.atan2(c.pos[0], c.pos[2]) + 0.9;
  }

  play(from = 0) {
    this.mode = 'play'; this.playBtn.textContent = 'Pause'; this.playBtn.setAttribute('aria-pressed', 'false');
    this.queue?.kill();
    const n = this.cfg.chapters.length;
    const tl = this.queue = this.gsap.timeline();
    for (let i = from; i < n; i++) tl.call(() => this.chapter(i), null, (i - from) * (TRAVEL + DWELL));
    tl.call(() => { this.mode = 'free'; this.playBtn.textContent = 'Replay'; }, null, (n - from) * (TRAVEL + DWELL) - 0.5);
  }
  pause() { this.queue?.kill(); if (this.mode === 'play') { this.mode = 'free'; this.playBtn.textContent = 'Resume'; } }
  onUserOrbit(down) { if (down) this.pause(); }

  update(dt, clock) {
    // key light: one spot, raked round the car; its elevation and azimuth are the dial
    const R = 4.6, h = +this.height.value;
    if (this.mode === 'idle') this.az += dt * 0.12;
    const lp = localToWorld(LAYOUT.ferrari, [Math.sin(this.az) * R, h, Math.cos(this.az) * R]);
    const tg = localToWorld(LAYOUT.ferrari, [0, 0.35, 0]);
    const sw = this.exhibit.stage.sweep;
    sw.position.set(lp[0], lp[1], lp[2]); sw.target.position.set(tg[0], tg[1], tg[2]);
    this.keyOn += (1 - this.keyOn) * (1 - Math.exp(-dt * 1.5));
    sw.intensity = 430 * this.keyOn; sw.angle = 0.5;
    // dial graphics
    const x = Math.sin(this.az) * 46, y = -Math.cos(this.az) * 46;
    this.knob.setAttribute('cx', x.toFixed(1)); this.knob.setAttribute('cy', y.toFixed(1));
    this.beam.setAttribute('x2', x.toFixed(1)); this.beam.setAttribute('y2', y.toFixed(1));
    // ignition in the lamp chapter (the real LED-module emission and beams)
    let lamps = 0.22;   // low by default: the exhibition is about paint, and a lit lamp fogs the lens when the camera is near it
    if (this.lampClock != null) {
      this.lampClock += dt;
      lamps = ramp([[0, 1], [0.5, 0.04], [1.5, 0.04], [1.58, 1], [1.7, 0.1], [1.86, 1], [2.1, 0.8], [2.6, 1]], this.lampClock);
      if (this.lampClock > 3) this.lampClock = null;
    }
    this.exhibit.setScene({ lamps });
    // wheels: the real wheel groups, rolling about their measured axles
    this.car.wheels?.setSpeed(this.roll ? 0.9 : 0);
  }

  unmount() { this.queue?.kill(); this.exhibit.stage.sweep.intensity = 0; super.unmount(); }
}
