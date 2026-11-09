import { smoothstep } from '../../sequence/curves.js';

// Section 04 - Craftsmanship. Three extreme close-ups on the Ferrari, each tied to something that really
// moves in the model data: the headlamp LED module igniting (the existing lamp system), a raking flank
// pass over the bodywork, and a slow roll of the rear wheel (real wheel geometry, see cars/wheels.js).
// The final frame (creeping in on the wheel) is the first key of the Surface lab, which follows. The path runs front -> rear along the car's left side so the camera never doubles back.
// Coordinates are car-local metres, measured from the GLB (tools/audit_models.py + ferrari.meta.json).
//   headlamp centre (0.769, 0.584, 1.483), front face z = 1.667 | rear-left wheel (0.787, 0.333, -1.418), r = 0.33
export default {
  id: 'craft',
  label: 'Craftsmanship',
  scrollVh: 3.2,
  minClear: 0.4,            // macro shots deliberately work close to the paint (m); everything else keeps >= 1.0

  cam({ W, profile }) {
    const sh = profile === 'mobile' ? [0, -0.2] : [0.19, 0];
    return [
      // i. the lamp - arrive wide-ish, push in while the LED module ignites
      { u: 0.0,  pos: W('ferrari', [1.5, 0.66, 3.2]),   look: W('ferrari', [0.72, 0.58, 1.55]), fov: 28, shift: sh },
      { u: 0.24, pos: W('ferrari', [1.15, 0.62, 2.8]),  look: W('ferrari', [0.72, 0.58, 1.55]), fov: 25, shift: sh },
      // ii. the line - a long, low rake along the shoulder, looking ahead of the move
      { u: 0.4,  pos: W('ferrari', [1.9, 0.74, 2.2]),   look: W('ferrari', [0.95, 0.66, -0.8]), fov: 26, shift: sh },
      { u: 0.62, pos: W('ferrari', [1.85, 0.72, -0.9]), look: W('ferrari', [0.95, 0.64, -2.6]), fov: 26, shift: sh },
      // iii. the wheel - settle beside the rear-left wheel, then creep in while it turns
      { u: 0.74, pos: W('ferrari', [1.9, 0.45, -0.1]),  look: W('ferrari', [0.79, 0.33, -1.42]), fov: 30, shift: sh },
    ];
  },

  prepare({ gsap, el }) {
    gsap.set(el.querySelectorAll('.beat'), { autoAlpha: 0, y: 18 });
    gsap.set(el.querySelectorAll('.craft__ticks i'), { scaleX: 0 });
    gsap.set(el.querySelector('.craft__kicker'), { opacity: 0 });
  },

  /** One scrubbed timeline: each beat owns a third of the section; its caption and tick follow the camera. */
  init({ gsap, el }) {
    const beats = el.querySelectorAll('.beat');
    const ticks = el.querySelectorAll('.craft__ticks i');
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    });
    tl.to(el.querySelector('.craft__kicker'), { opacity: 1, duration: 0.06 }, 0);
    beats.forEach((b, i) => {
      const a = i / 3, z = (i + 1) / 3;
      tl.to(b, { autoAlpha: 1, y: 0, duration: 0.07 }, a + 0.015);
      if (i < beats.length - 1) tl.to(b, { autoAlpha: 0, y: -14, duration: 0.06, ease: 'power2.in' }, z - 0.07);
      tl.to(ticks[i], { scaleX: 1, ease: 'none', duration: 1 / 3 }, a);
    });
    tl.to({}, { duration: 1 }, 0);
  },

  /**
   * Real, model-backed motion, driven by scroll position u (0..1) within this section. Anything outside the
   * section's own window is left to the opening's per-frame state, so there are no pops at the boundaries.
   */
  tick({ u, cars }) {
    const f = cars.ferrari;
    if (!f?.ready) return;
    // i. headlamps: dip to a dark lens and ignite again - the actual LED-module emission and beam
    if (u > 0 && u < 0.34) {
      const dip = smoothstep(0, 0.1, u) * (1 - smoothstep(0.14, 0.3, u));
      const lvl = 1 - 0.88 * dip;
      f.setLamps(lvl, lvl);
    }
    // iii. wheels roll slowly (0.55 m/s) through the wheel beat, then settle
    f.wheels?.setSpeed(0.55 * smoothstep(0.66, 0.76, u));
  },
};
