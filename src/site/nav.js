import { ScrollTrigger } from 'gsap/ScrollTrigger';

const $ = (id) => document.getElementById(id);

/**
 * Header + full-screen index. The menu lists whatever is registered in sections/index.js, so a section
 * only appears in navigation once it exists - there are no dead links, now or in later stages.
 */
export class Nav {
  constructor({ gsap, site, sections, hud }) {
    this.gsap = gsap; this.site = site; this.hud = hud; this.sections = sections;
    this.el = $('nav'); this.mark = $('nav-mark'); this.btn = $('menu-btn'); this.menu = $('menu'); this.list = $('menu-list');
    this.label = this.btn.querySelector('.nav__menu-label');
    this.main = $('main');
    this.isOpen = false;

    gsap.set(this.el, { autoAlpha: 0, y: -14 });

    // build the index from the registry
    sections.forEach(({ def }, i) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${def.id}`; a.dataset.section = def.id;
      a.innerHTML = `<span class="menu__i">${String(i).padStart(2, '0')}</span><span class="menu__mask"><span class="menu__t">${def.label}</span></span>`;
      li.appendChild(a); this.list.appendChild(li);
    });

    // open / close timeline
    this.tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut' } })
      .to(this.menu, { autoAlpha: 1, duration: 0.01 }, 0)
      .fromTo(this.menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95 }, 0)
      .fromTo(this.list.querySelectorAll('.menu__t'), { yPercent: 112 }, { yPercent: 0, duration: 1.15, stagger: 0.08, ease: 'expo.out' }, 0.38)
      .fromTo(this.list.querySelectorAll('.menu__i'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.08, ease: 'power2.out' }, 0.55)
      .fromTo(this.menu.querySelectorAll('.menu__foot > *'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.7);
    this.tl.eventCallback('onReverseComplete', () => { this.menu.inert = true; });

    this.menu.inert = true;
    this.btn.addEventListener('click', () => this.toggle());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) { this.close(); this.btn.focus(); } });
    this.list.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-section]');
      if (!a) return;
      e.preventDefault();
      this.close(() => this.site.goTo(a.dataset.section));
    });
    $('menu-replay').addEventListener('click', () => { this.close(); this.site.replay(); });
    $('menu-credits').addEventListener('click', () => { this.close(); this.hud.toggleCredits(true); });

    // wordmark appears once the big wordmark of the hero has left; the index marks the current section
    ScrollTrigger.create({
      trigger: sections[0].el, start: '46% top',
      onEnter: () => this.mark.classList.add('on'), onLeaveBack: () => this.mark.classList.remove('on'),
    });
    sections.forEach(({ def, el }) => ScrollTrigger.create({
      trigger: el, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) this._current(def.id); },
    }));
    this.mark.addEventListener('click', (e) => { e.preventDefault(); this.site.goTo(sections[0].def.id); });
  }

  _current(id) {
    for (const a of this.list.querySelectorAll('a')) {
      if (a.dataset.section === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    }
  }

  enter() { this.gsap.to(this.el, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'expo.out', delay: 0.2 }); }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.menu.inert = false; this.main.inert = true;
    this.btn.setAttribute('aria-expanded', 'true'); this.label.textContent = 'Close';
    document.documentElement.classList.add('menu-open');
    this.site.lenis.stop();
    this.tl.timeScale(1).play();
    this.list.querySelector('a')?.focus({ preventScroll: true });
  }

  close(after) {
    if (!this.isOpen) { after?.(); return; }
    this.isOpen = false;
    this.main.inert = false;
    this.btn.setAttribute('aria-expanded', 'false'); this.label.textContent = 'Menu';
    document.documentElement.classList.remove('menu-open');
    this.tl.timeScale(1.5).reverse();
    this.site.lenis.start();
    if (after) this.gsap.delayedCall(0.35, after);
  }

  reset() { this.isOpen = false; this.main.inert = false; this.tl.progress(0).pause(); this.menu.inert = true; this.label.textContent = 'Menu'; this.btn.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('menu-open'); this.gsap.set(this.el, { autoAlpha: 0, y: -14 }); this.mark.classList.remove('on'); }
}
