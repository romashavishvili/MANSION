// Section 03 - Brand philosophy. Editorial statement on the left, the Ferrari on the right. The camera
// pushes in from the hero frame, glides along the flank and arcs across the nose as the lines resolve.
// (Draft copy lives in index.html and needs client approval.)
export default {
  id: 'philosophy',
  label: 'Philosophy',
  scrollVh: 3.4,

  cam({ W, profile }) {
    // type owns the left of a landscape screen; on portrait the car moves to the upper half instead
    const sh = profile === 'mobile' ? [0, -0.2] : [0.19, 0];
    return [
      { u: 0.0,  pos: W('ferrari', [3.6, 0.9, 8.2]),  look: W('ferrari', [0.0, 0.5, 0.8]),  fov: 32, shift: sh },
      { u: 0.34, pos: W('ferrari', [3.1, 0.62, 3.4]), look: W('ferrari', [0.0, 0.55, 0.5]), fov: 30, shift: sh },
      { u: 0.68, pos: W('ferrari', [1.9, 0.42, 4.7]), look: W('ferrari', [-0.3, 0.52, 1.5]), fov: 28, shift: sh },
      { u: 0.97, pos: W('ferrari', [-3.3, 0.8, 6.2]), look: W('ferrari', [0.0, 0.5, 0.4]),  fov: 31, shift: sh },
    ];
  },

  prepare({ gsap, el }) {
    gsap.set(el.querySelectorAll('.pl'), { opacity: 0.12, y: 18 });
    gsap.set(el.querySelectorAll('.tenet'), { opacity: 0, y: 14 });
    gsap.set(el.querySelectorAll('.tenet__rule'), { scaleX: 0 });
    gsap.set(el.querySelector('.philo__kicker'), { opacity: 0 });
  },

  /** One scrubbed timeline of unit length: lines resolve, then the three tenets arrive one by one. */
  init({ gsap, el }) {
    const lines = el.querySelectorAll('.pl');
    const tenets = el.querySelectorAll('.tenet');
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
    });
    tl.to(el.querySelector('.philo__kicker'), { opacity: 1, duration: 0.06 }, 0.0);
    lines.forEach((ln, i) => tl.to(ln, { opacity: 1, y: 0, duration: 0.1 }, 0.04 + i * 0.1));
    tl.to(el.querySelector('.truth'), { '--u': 1, duration: 0.1, ease: 'power1.inOut' }, 0.4);
    tl.to(lines, { opacity: 0.3, duration: 0.1, stagger: 0 }, 0.55);
    tenets.forEach((t, i) => {
      const at = 0.58 + i * 0.12;
      tl.to(t, { opacity: 1, y: 0, duration: 0.1 }, at);
      tl.to(t.querySelector('.tenet__rule'), { scaleX: 1, duration: 0.1, ease: 'power3.inOut' }, at);
    });
    tl.to(el.querySelector('.philo__meter i'), { scaleY: 1, ease: 'none', duration: 1 }, 0);
    tl.to({}, { duration: 1 }, 0);
  },
};
