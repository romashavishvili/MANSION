// Section 04 - Surface lab. The five services as five different presentations (see lab/labController.js). The camera
// leaves the Ferrari's rear wheel (where Craftsmanship ends) and settles on a front three-quarter, the car on the right,
// the lab on the left. The section is pinned, so its controls are always in reach; scrolling only drifts the camera.
export default {
  id: 'lab',
  label: 'Surface lab',
  scrollVh: 3.6,
  minClear: 0.4,

  cam({ W, profile }) {
    const sh = profile === 'mobile' ? [0, -0.2] : [0.19, 0];
    const sl = profile === 'mobile' ? [0, -0.24] : [0.31, 0];
    return [
      { u: 0.0,  pos: W('ferrari', [1.65, 0.4, -0.2]), look: W('ferrari', [0.79, 0.33, -1.42]), fov: 30, shift: sh },   // = the last frame of Craftsmanship
      { u: 0.4,  pos: W('ferrari', [5.6, 1.1, 4.8]),   look: W('ferrari', [0.2, 0.5, 0.0]),     fov: 30, shift: sl },
      { u: 0.85, pos: W('ferrari', [5.2, 1.1, 5.2]), look: W('ferrari', [0.2, 0.5, 0.0]), fov: 30, shift: sl },
    ];
  },

  prepare({ gsap, el }) {
    gsap.set(el.querySelectorAll('.lab__kicker, .lab__h, .lab__ui'), { autoAlpha: 0, y: 16 });
  },

  init({ gsap, ScrollTrigger, el, site }) {
    site.lab.bind(el.querySelector('.lab__ui'));
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.4 } });
    tl.to(el.querySelectorAll('.lab__kicker, .lab__h'), { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.02 }, 0.0)
      .to(el.querySelector('.lab__ui'), { autoAlpha: 1, y: 0, duration: 0.1 }, 0.06)
      .to(el.querySelector('.lab__pin'), { autoAlpha: 0, duration: 0.07, ease: 'power2.in' }, 0.93)
      .to({}, { duration: 1 }, 0);
  },

  tick(ctx) { ctx.site?.lab.tick(ctx); },
};
