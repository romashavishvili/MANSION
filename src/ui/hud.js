import { CARS, BRAND } from '../config.js';

const $ = (id) => document.getElementById(id);

/** All DOM for Stage 1: loader, captions, title, controls, credits. Pure presentation + callbacks. */
export class HUD {
  constructor() {
    this.el = {
      loader: $('loader'), pct: $('loader-pct'), bar: $('loader-bar'), label: $('loader-label'),
      caption: $('caption'), capNum: $('cap-num'), capName: $('cap-name'), capTag: $('cap-tag'),
      title: $('title'), subtitle: $('subtitle'),
      bg: $('bgload'), bgBar: $('bgload-bar'), bgLabel: $('bgload-label'),
      skip: $('btn-skip'), replay: $('btn-replay'), creditsBtn: $('btn-credits'),
      credits: $('credits'), creditsClose: $('credits-close'), hint: $('hint'),
      fallback: $('fallback'), debug: $('debug'),
    };
    this._title = null; this._sub = null; this._cap = undefined;
    this.onSkip = null; this.onReplay = null;
    this._buildTitle();
    this.el.subtitle.textContent = BRAND.descriptor;

    this.el.skip.addEventListener('click', () => this.onSkip?.());
    this.el.replay.addEventListener('click', () => this.onReplay?.());
    this.el.creditsBtn.addEventListener('click', () => this.toggleCredits(true));
    this.el.creditsClose.addEventListener('click', () => this.toggleCredits(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggleCredits(false); });
  }

  _buildTitle() {
    const words = BRAND.name.split(' ');
    let i = 0;
    const frag = document.createDocumentFragment();
    words.forEach((w, wi) => {
      const ws = document.createElement('span'); ws.className = 'w';
      for (const ch of w) {
        const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; s.setAttribute('aria-hidden', 'true');
        s.style.setProperty('--i', String(i++)); ws.appendChild(s);
      }
      frag.appendChild(ws);
      if (wi < words.length - 1) { const sp = document.createElement('span'); sp.className = 'sp'; frag.appendChild(sp); i++; }
    });
    this.el.title.appendChild(frag);
  }

  // ---- loader -------------------------------------------------------------------------------------
  setLoader(p, label) {
    const v = Math.max(0, Math.min(1, p));
    this.el.pct.textContent = String(Math.round(v * 100)).padStart(3, '0');
    this.el.bar.style.transform = `scaleX(${v})`;
    if (label) this.el.label.textContent = label;
  }
  hideLoader() { this.el.loader.classList.add('done'); }
  showFallback() { this.el.fallback.hidden = false; this.el.loader.classList.add('done'); }

  /** Small unobtrusive indicator while Ferrari / Maybach stream in during the opening. */
  setBackgroundLoad(label, p) {
    if (label == null) { this.el.bg.hidden = true; return; }
    this.el.bg.hidden = false;
    this.el.bgLabel.textContent = label;
    this.el.bgBar.style.transform = `scaleX(${Math.max(0.02, Math.min(1, p))})`;
  }

  // ---- intro typography ------------------------------------------------------------------------
  setTitle(on) { if (on !== this._title) { this._title = on; this.el.title.classList.toggle('on', on); } }
  setSubtitle(on) { if (on !== this._sub) { this._sub = on; this.el.subtitle.classList.toggle('on', on); } }
  setCaption(id) {
    if (id === this._cap) return;
    this._cap = id;
    if (!id) { this.el.caption.classList.remove('on'); return; }
    const c = CARS[id].caption ?? CARS[id];
    this.el.capNum.textContent = c.number;
    this.el.capName.textContent = c.name;
    this.el.capTag.textContent = c.tagline;
    this.el.caption.classList.add('on');
  }

  // ---- phases ---------------------------------------------------------------------------------
  setPhase(phase) {
    const intro = phase === 'intro', site = phase === 'site';
    this.el.skip.hidden = !intro;
    this.el.replay.hidden = intro || site;
    this.el.hint.hidden = intro || site;
    this.el.creditsBtn.hidden = site;                 // in the site, Replay and Credits live in the menu
    $('ui').hidden = site;
  }

  toggleCredits(open) {
    this.el.credits.hidden = !open;
    if (open) this.el.creditsClose.focus(); else this.el.creditsBtn.focus({ preventScroll: true });
  }
}
