// SUPERSEDED (MANSION Stage 1): scrolling is now owned by src/site/Site.js (Lenis + GSAP ScrollTrigger + the
// camera rail in src/site/rail.js). This stub is no longer instantiated; kept only for reference.
// Stage-2 hook: scroll-driven storytelling.
//
// Chapters register a [start, end] range of normalised scroll progress and an update(localProgress)
// callback. In Stage 1 no chapters are registered and the director is disabled, but the architecture is
// in place: CameraRig can be given a "scroll" provider, and every visual in the opening is already a
// pure function of a single scalar (the master clock), so replacing the clock with scroll progress is a
// one-line change.
//
// Smoothing uses critically-damped easing so it can later be swapped for Lenis without touching chapters.

export class ScrollDirector {
  constructor() {
    this.enabled = false;
    this.target = 0;         // raw 0..1
    this.progress = 0;       // smoothed 0..1
    this.chapters = [];
    this._onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.target = max > 0 ? window.scrollY / max : 0;
    };
  }

  /** @param {{id:string,range:[number,number],update:(p:number)=>void,enter?:()=>void,exit?:()=>void}} chapter */
  addChapter(chapter) { this.chapters.push(chapter); return this; }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll();
  }

  disable() {
    this.enabled = false;
    window.removeEventListener('scroll', this._onScroll);
  }

  update(dt) {
    if (!this.enabled) return;
    this.progress += (this.target - this.progress) * (1 - Math.exp(-dt * 6));
    for (const c of this.chapters) {
      const [a, b] = c.range;
      const inside = this.progress >= a && this.progress <= b;
      if (inside && !c._active) { c._active = true; c.enter?.(); }
      if (!inside && c._active) { c._active = false; c.exit?.(); }
      if (inside) c.update((this.progress - a) / (b - a));
    }
  }
}
