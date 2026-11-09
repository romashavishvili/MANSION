/** Shared plumbing for a room: listeners that are always removed, a root element, a leave button. */
export class RoomBase {
  constructor({ exhibit, car, root, gsap, cfg, reduced }) {
    Object.assign(this, { exhibit, car, root, gsap, cfg, reduced });
    this.ac = new AbortController();
    this.sig = this.ac.signal;
    this.el = document.createElement('div');
    this.timers = [];
  }
  on(target, type, fn, opts) { target.addEventListener(type, fn, { ...opts, signal: this.sig }); }
  $(sel) { return this.el.querySelector(sel); }
  $$(sel) { return [...this.el.querySelectorAll(sel)]; }
  later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); return id; }
  mountEl(html, cls) {
    this.el.className = `room ${cls}`;
    this.el.innerHTML = html;
    this.root.appendChild(this.el);
    this.on(this.$('[data-leave]'), 'click', () => this.exhibit.leave());
  }
  /** radiogroup behaviour: one active button, aria-checked kept in sync. */
  radio(sel, onPick, initial) {
    const btns = typeof sel === 'string' ? this.$$(sel) : [...sel];
    const set = (b) => { btns.forEach((x) => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.classList.toggle('on', on); x.tabIndex = on ? 0 : -1; }); };
    btns.forEach((b) => this.on(b, 'click', () => { set(b); onPick(b); }));
    this.on(btns[0]?.parentElement, 'keydown', (e) => {
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
      const i = btns.findIndex((x) => x.classList.contains('on')), d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const n = btns[(i + d + btns.length) % btns.length]; n.focus(); n.click(); e.preventDefault();
    });
    set(initial ?? btns[0]); return set;
  }
  unmount() {
    this.timers.forEach(clearTimeout); this.ac.abort(); this.el.remove();
    this.gsap.killTweensOf(this.el.querySelectorAll('*'));
  }
}
