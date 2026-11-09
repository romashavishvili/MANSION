import { localToWorld } from '../math/pose.js';
import { LAYOUT } from '../config.js';

const MODES = ['correct', 'ppf', 'ceramic', 'detail', 'protect'];
const ZONES = { edge: 1, front: 2, full: 3 };

/**
 * Surface Lab: five services, five different presentations. Only two of them touch the 3D model, and both are
 * labelled as illustrations in the interface: paint correction (simulated marring on one side of a plane across the
 * real Ferrari body) and film coverage areas. The ceramic tab moves a real light across the paint so reflections can be
 * read. Detailing and protection are explained, not simulated.
 * It acts on the car only while the section is on screen, and hands everything back to zero outside it.
 */
export class LabController {
  constructor({ stage, cars, site }) {
    this.stage = stage; this.cars = cars; this.site = site;
    this.mode = 'correct';
    this.split = 0.0;          // 0 = all "before", 1 = all "after"
    this.zone = 'edge';
    this.light = 0.5;
    this.amt = { defect: 0, zone: 0, sweep: 0 };
    this.el = null;
  }

  bind(el) {
    this.el = el;
    const tabs = [...el.querySelectorAll('[role=tab]')];
    const panels = [...el.querySelectorAll('[role=tabpanel]')];
    const pick = (i, focus) => {
      this.mode = MODES[i];
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.hidden = k !== i; });
      if (focus) tabs[i].focus();
      el.dataset.mode = this.mode;
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => pick(i)));
    el.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
      const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { pick((i + d + tabs.length) % tabs.length, true); e.preventDefault(); }
    });
    pick(0);

    const range = (id, fn) => { const r = el.querySelector(id); const f = () => { fn(+r.value); r.style.setProperty('--v', r.value); }; r.addEventListener('input', f); f(); };
    range('#lab-split', (v) => { this.split = v; });
    range('#lab-light', (v) => { this.light = v; });
    el.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
      this.zone = b.dataset.zone;
      el.querySelectorAll('[data-zone]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    }));
    // stepper (premium detailing)
    const steps = [...el.querySelectorAll('.step')]; let si = 0;
    const showStep = (n) => { si = (n + steps.length) % steps.length; steps.forEach((s, k) => { s.hidden = k !== si; }); el.querySelector('.stepper__n').textContent = `${si + 1} / ${steps.length}`; };
    el.querySelector('[data-step=next]')?.addEventListener('click', () => showStep(si + 1));
    el.querySelector('[data-step=prev]')?.addEventListener('click', () => showStep(si - 1));
    showStep(0);
    // layer stack (surface protection): hover / focus / click a layer to read it
    const layers = [...el.querySelectorAll('.layer')], out = el.querySelector('.layer-out');
    const showLayer = (l) => { layers.forEach((x) => x.classList.toggle('on', x === l)); out.innerHTML = `<b>${l.dataset.t}</b> ${l.dataset.d}`; };
    layers.forEach((l) => { ['mouseenter', 'focus', 'click'].forEach((ev) => l.addEventListener(ev, () => showLayer(l))); });
    showLayer(layers[0]);
    el.querySelectorAll('[data-enquire]').forEach((b) => b.addEventListener('click', () => this.site.enquire(b.dataset.enquire)));
  }

  /** Per frame. `u` is the section's scroll progress; the lab only acts on the car while 0 < u < 1. */
  tick({ u, dt }) {
    const car = this.cars.ferrari, lab = car?.lab;
    if (!lab) return;
    const live = u > 0.02 && u < 0.985 && !this.site.exhibit?.active;
    const k = 1 - Math.exp(-dt * 5);
    const want = { defect: live && this.mode === 'correct' ? 1 : 0, zone: live && this.mode === 'ppf' ? 1 : 0, sweep: live && this.mode === 'ceramic' ? 1 : 0 };
    for (const key of Object.keys(want)) this.amt[key] += (want[key] - this.amt[key]) * k;
    lab.uLabDefect.value = this.amt.defect > 0.004 ? this.amt.defect : 0;
    // untreated region = nose-ward of the split plane; split 0 -> whole car "before", 1 -> whole car "after"
    lab.uLabSplit.value = -2.35 + 4.7 * this.split;
    lab.uLabZone.value = ZONES[this.zone];
    lab.uLabZoneAmt.value = this.amt.zone;
    if (this.amt.sweep > 0.01) {
      // one overhead light rakes along the car's left flank: judge a panel by how the reflection travels
      const z = 3.0 - 6.0 * this.light;
      const p = localToWorld(LAYOUT.ferrari, [3.4, 2.6, z]), t = localToWorld(LAYOUT.ferrari, [0.5, 0.45, z * 0.55]);
      const sw = this.stage.sweep;
      sw.position.set(p[0], p[1], p[2]); sw.target.position.set(t[0], t[1], t[2]);
      sw.intensity = 1150 * this.amt.sweep; sw.angle = 0.42;
    }
  }
}
