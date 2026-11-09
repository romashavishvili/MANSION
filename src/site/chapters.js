/** Bottom-centre chapter index: a hairline of ticks, one per section; the current one is named. Same registry as the menu. */
export class Chapters {
  constructor({ gsap, ScrollTrigger, site, sections }) {
    this.gsap = gsap; this.site = site;
    const el = this.el = document.createElement('nav');
    el.id = 'chapters'; el.setAttribute('aria-label', 'Chapters');
    el.innerHTML = `<ol>${sections.map(({ def }) => `<li><button type="button" data-s="${def.id}" aria-label="${def.label}"><i></i></button></li>`).join('')}</ol><p aria-hidden="true"></p>`;
    document.body.appendChild(el);
    this.name = el.querySelector('p');
    this.btns = [...el.querySelectorAll('button')];
    this.btns.forEach((b, i) => {
      b.addEventListener('click', () => site.goTo(b.dataset.s));
      b.addEventListener('mouseenter', () => { this.name.textContent = sections[i].def.label; });
      b.addEventListener('mouseleave', () => { this.name.textContent = this.cur ?? ''; });
    });
    sections.forEach(({ def, el: sEl }, i) => ScrollTrigger.create({
      trigger: sEl, start: 'top 55%', end: 'bottom 55%',
      onToggle: (s) => { if (s.isActive) { this.cur = def.label; this.name.textContent = def.label; this.btns.forEach((b, k) => b.classList.toggle('on', k === i)); } },
    }));
    gsap.set(el, { autoAlpha: 0 });
  }
  enter() { this.gsap.to(this.el, { autoAlpha: 1, duration: 1.2, delay: 1.2 }); }
  reset() { this.gsap.set(this.el, { autoAlpha: 0 }); }
}
