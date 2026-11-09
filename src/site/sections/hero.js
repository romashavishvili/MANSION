// Section 02 - Hero. The camera starts EXACTLY where the opening ended (the hero frame), so the
// hand-off from intro to website has no cut; the DOM layer (type, cue) is built in index.html.
export default {
  id: 'hero',
  label: 'Opening',
  scrollVh: 1.6,            // section height in viewport heights (written to --len; see Site.js)

  cam({ introHero }) {
    return [{ u: 0, pos: introHero.pos, look: introHero.look, fov: introHero.fov, shift: [0, 0] }];
  },

  /** Hidden starting states, applied while the opening is still playing. */
  prepare({ gsap, el }) {
    gsap.set(el.querySelectorAll('.hero__line .ln > span'), { yPercent: 118 });
    gsap.set(el.querySelectorAll('.hero__cue'), { autoAlpha: 0, y: 14 });
  },

  /** Scroll-linked behaviour: the wordmark lifts away, the foreground type fades. */
  init({ gsap, el }) {
    gsap.timeline({ scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } })
      .to('#title-wrap', { yPercent: -16, autoAlpha: 0, ease: 'none', duration: 0.6 }, 0)
      .to(el.querySelector('.hero__pin'), { autoAlpha: 0, ease: 'none', duration: 0.42 }, 0)
      .to({}, { duration: 1 }, 0);
  },

  /** Runs once when the opening hands over to the site. */
  enter({ gsap, el }) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(el.querySelectorAll('.hero__line .ln > span'), { yPercent: 0, duration: 1.7, stagger: 0.13 }, 0.25)
      .to(el.querySelectorAll('.hero__cue'), { autoAlpha: 1, y: 0, duration: 1.4 }, 0.9)
      .fromTo(el.querySelectorAll('.hero__cue i'), { scaleY: 0 }, { scaleY: 1, duration: 1.8 }, 1.0);
    return tl;
  },
};
