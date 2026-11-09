// Section 05 - The rooms. Three vehicle experiences, each its own room. The camera visits each car in turn (BMW,
// Ferrari, Maybach) as the list follows; every entry is also a button, so the rooms are reachable from anywhere in
// this section. Clicking one hands the camera to the room (src/exhibit/).
const LEN = 7.0;
export default {
  id: 'rooms',
  label: 'The rooms',
  scrollVh: LEN,

  cam({ W, profile }) {
    const sh = profile === 'mobile' ? [0, -0.22] : [0.2, 0];
    return [
      { u: 0.0,  pos: W('ferrari', [5.2, 1.1, 5.2]),     look: W('ferrari', [0.2, 0.5, 0.0]),  fov: 30, shift: profile === 'mobile' ? [0, -0.24] : [0.31, 0] },    // = the end of the Surface lab
      { u: 0.15, pos: [-1.2, 1.3, 8.2],                 look: [-3.4, 0.6, 1.6],        fov: 33, shift: sh },     // swing wide of the Ferrari's nose
      { u: 0.31, pos: W('bmw', [-3.6, 1.1, 6.0]),       look: W('bmw', [0, 0.6, 0.3]),        fov: 33, shift: sh },     // the BMW's outer side, away from the line-up
      { u: 0.58, pos: W('ferrari', [3.2, 0.95, 5.2]),   look: W('ferrari', [0, 0.5, 0.2]),    fov: 32, shift: sh },
      { u: 0.88, pos: W('maybach', [3.6, 1.2, 6.4]),    look: W('maybach', [0, 0.65, 0.3]),   fov: 33, shift: sh },
    ];
  },

  prepare({ gsap, el }) {
    gsap.set(el.querySelectorAll('.rooms__kicker, .ri'), { autoAlpha: 0, y: 18 });
  },

  init({ gsap, ScrollTrigger, el, site }) {
    const items = [...el.querySelectorAll('.ri')];
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.4 } });
    tl.to(el.querySelector('.rooms__kicker'), { autoAlpha: 1, y: 0, duration: 0.05 }, 0.02)
      .to(items, { autoAlpha: 1, y: 0, duration: 0.07, stagger: 0.04 }, 0.04)
      .to(el.querySelector('.rooms__pin'), { autoAlpha: 0, duration: 0.07, ease: 'power2.in' }, 0.93)
      .to({}, { duration: 1 }, 0);
    // the list follows the camera: whichever car it is framing is lit, the others recede
    ScrollTrigger.create({
      trigger: el, start: 'top top', end: 'bottom bottom',
      onUpdate: (s) => { const u = s.progress * (LEN - 1) / LEN, i = u < 0.445 ? 0 : u < 0.73 ? 1 : 2; items.forEach((it, k) => it.classList.toggle('is-active', k === i)); },
    });
    items.forEach((it) => it.querySelector('button').addEventListener('click', () => site.exhibit?.enter(it.dataset.car)));
  },
};
