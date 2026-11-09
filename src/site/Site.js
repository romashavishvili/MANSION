import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { heroPose } from '../sequence/cameraScript.js';
import { profileFor } from '../camera/aspect.js';
import { buildRail, railTimeAt } from './rail.js';
import { SECTIONS } from './sections/index.js';
import { Nav } from './nav.js';
import { magnetic, easeInOutCubic } from './motion.js';
import { Sound } from '../audio/sound.js';
import { LabController } from '../lab/labController.js';
import { Chapters } from './chapters.js';
import { initCursor } from './cursor.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * MANSION website layer. It owns scrolling (Lenis), the DOM choreography (GSAP + ScrollTrigger), the
 * navigation, and the hand-off from the cinematic opening. It never touches the 3D systems directly:
 * it only gives the CameraRig a rail to follow, driven by scroll. Everything 3D (cars, lights, beams,
 * mirror, post) keeps running exactly as in the opening.
 *
 *   opening finishes ──► Site.handoff() ──► scroll unlocks, rig enters 'rail' mode on the hero frame
 *   scroll ──► Lenis ──► Site.update() ──► railTimeAt() ──► rig.applyRail()  (+ ScrollTrigger for DOM)
 */
export class Site {
  constructor({ rig, hud, opening, introScript, layout, cars = {}, stage = null, reducedMotion = false }) {
    this.stage = stage; this.exhibit = null;
    this.lab = new LabController({ stage, cars, site: this });
    this.rig = rig; this.hud = hud; this.opening = opening; this.layout = layout; this.cars = cars;
    this.sound = new Sound();                   // optional audio; silent and not even created until the visitor opts in
    this.reduced = reducedMotion;
    this.html = document.documentElement;
    this.root = document.getElementById('site');
    this.live = false;
    this.introHero = heroPose(introScript);
    this.profile = profileFor(window.innerWidth, window.innerHeight);
    this.rail = this._buildRail();
    this.tops = [0]; this.maxScroll = 1;

    this.sections = SECTIONS
      .map((def) => ({ def, el: document.getElementById(def.id) }))
      .filter((s) => { if (!s.el) console.warn(`[MANSION] section "${s.def.id}" has no element in index.html`); return !!s.el; });

    // smooth scroll. Touch keeps native momentum (syncTouch off) - more reliable on iOS and Android.
    this.lenis = new Lenis({
      duration: 1.15, smoothWheel: !this.reduced, syncTouch: false, wheelMultiplier: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    this.lenis.stop();
    this.lenis.on('scroll', ScrollTrigger.update);

    // sections: scroll lengths first (layout), then hidden start states, then scroll-linked behaviour
    for (const { def, el } of this.sections) el.style.setProperty('--len', String(def.scrollVh));
    for (const { def, el } of this.sections) def.prepare?.({ gsap, el, site: this });
    for (const { def, el } of this.sections) def.init?.({ gsap, ScrollTrigger, el, site: this });

    this.nav = new Nav({ gsap, site: this, sections: this.sections, hud });
    this.chapters = new Chapters({ gsap, ScrollTrigger, site: this, sections: this.sections });

    // in-page anchors (hero cue, wordmark, menu) scroll along the rail
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || a.closest('#menu-list')) return;
      const id = a.getAttribute('href').slice(1);
      if (this.sections.some((s) => s.def.id === id)) { e.preventDefault(); this.goTo(id); }
    });

    ScrollTrigger.addEventListener('refresh', () => this._measure());
    this._measure();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => this._onResize(), 120); });
  }

  _buildRail() {
    return buildRail({ layout: this.layout, sections: SECTIONS, profile: this.profile, introHero: this.introHero });
  }

  _onResize() {
    const p = profileFor(window.innerWidth, window.innerHeight);
    if (p !== this.profile) {                       // portrait <-> landscape: different framing, rebuild the rail
      this.profile = p; this.rail = this._buildRail();
      if (this.rig.mode === 'rail') this.rig.rail = this.rail;
    }
  }

  _measure() {
    const y = window.scrollY;
    this.tops = this.sections.map(({ el }) => el.getBoundingClientRect().top + y);
    this.tops[0] = 0;
    this.maxScroll = Math.max(1, this.html.scrollHeight - window.innerHeight);
  }

  /** Called every frame from the render loop (one rAF drives 3D, Lenis and the rail). */
  update(dt, nowMs, time) {
    this.lenis.raf(nowMs);
    if (!this.live || this.exhibit?.active) return;
    const rt = railTimeAt(this.lenis.scroll, this.tops, this.maxScroll);
    this.rig.applyRail(rt, time, dt);
    // model-backed motion (lamp ignition, wheel roll...): each section sees its own 0..1 progress
    this.sections.forEach(({ def }, i) => def.tick?.({ u: Math.min(1, Math.max(0, rt - i)), rt, cars: this.cars, dt, time, site: this }));
    this.sound.setProgress(rt / this.sections.length);
  }

  /** Smooth scroll to a section (menu, hero cue, wordmark). The camera glides along the rail with it. */
  goTo(id) {
    const s = this.sections.find((x) => x.def.id === id);
    if (!s || !this.live) return;
    if (this.exhibit?.active) this.exhibit.leaveNow();
    const y = s === this.sections[0] ? 0 : s.el.getBoundingClientRect().top + window.scrollY;
    this.lenis.scrollTo(y, { duration: 1.9, easing: easeInOutCubic, immediate: this.reduced, force: true });
  }

  /** Back from a vehicle room: the camera returns to the rail at the current scroll position. */
  resumeFromExhibit() {
    this.rig.enterRail(this.rail);
    this.lenis.start();
    const rt = railTimeAt(this.lenis.scroll, this.tops, this.maxScroll);
    this.rig.applyRail(rt, 0, 1);
  }

  /** Called by a service's call to action: preselect it in the form and scroll there. */
  enquire(service) { this.setEnquiryService?.(service); this.goTo('enquire'); }

  /** The opening is over: unlock the page and let the camera follow scroll, starting on the hero frame. */
  handoff() {
    if (this.live) return;
    this.live = true;
    this.html.classList.remove('is-locked');
    this.root.classList.add('is-live');
    this.hud.setPhase('site');
    this.rig.enterRail(this.rail);
    window.scrollTo(0, 0);
    this.lenis.scrollTo(0, { immediate: true, force: true });
    this.lenis.start();
    ScrollTrigger.refresh();
    this._measure();

    const tls = [];
    this.nav.enter(); this.chapters.enter();
    if (!this.cursor) this.cursor = initCursor(gsap);
    for (const { def, el } of this.sections) { const tl = def.enter?.({ gsap, el, site: this }); if (tl) tls.push(tl); }
    if (this.reduced) tls.forEach((t) => t.progress(1));
    magnetic(gsap, [document.getElementById('menu-btn'), ...document.querySelectorAll('.hero__cue-label')]);
  }

  /** Replay the opening from the menu: relock, reset, and run the intro again. */
  replay() {
    if (!this.live) return;
    if (this.exhibit?.active) this.exhibit.leaveNow();
    this.live = false;
    this.nav.reset(); this.chapters.reset();
    this.lenis.stop();
    this.lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    this.html.classList.add('is-locked');
    this.root.classList.remove('is-live');
    gsap.set('#title-wrap', { clearProps: 'all' });
    for (const { def, el } of this.sections) def.prepare?.({ gsap, el, site: this });
    this.rig.leaveOrbit();
    this.opening.start();
  }
}
