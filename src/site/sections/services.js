// Section 04 - Services. Three chapters, one per car, each with its own camera moves (establishing shot,
// close detail, quarter view). The text swaps with the chapter; the finish swatches preview paint on the
// chapter's own 3D model. Content comes from business.config.js (SERVICES, FINISHES).
import { SERVICES, FINISHES } from '../../business.config.js';

const CH = [0, 0.32, 0.67, 1.0];          // chapter boundaries in section progress
const JUMP = [0.19, 0.45, 0.87];          // where a tab click lands (inside the chapter)

export default {
  id: 'services',
  label: 'Services',
  scrollVh: 12,

  cam({ W, profile }) {
    const sh = profile === 'mobile' ? [0, -0.2] : [0.19, 0];
    const k = (u, car, p, l, fov) => ({ u, pos: W(car, p), look: W(car, l), fov, shift: sh });
    return [
      // starts exactly where Philosophy ends (the Ferrari, front left), then crosses to the BMW
      k(0.00, 'ferrari', [-3.3, 0.8, 6.2], [0, 0.5, 0.4], 31),
      // Paint correction: BMW, kept on its right flank (the side away from the other cars)
      k(0.15, 'bmw', [-3.4, 0.9, 6.0], [0, 0.7, 0.8], 32),
      k(0.22, 'bmw', [-4.6, 0.75, 0.4], [0, 0.7, 0.2], 28),                // side profile
      k(0.26, 'bmw', [-3.3, 0.55, 2.7], [0, 0.78, 1.4], 25),                // low, close on the front quarter
      // Ceramic & protection: Ferrari, front, low flank, rear, then behind the car toward the Maybach
      k(0.39, 'ferrari', [-3.9, 0.8, 5.4], [0, 0.55, 0.4], 30),
      k(0.44, 'ferrari', [-2.9, 0.5, 1.8], [0, 0.6, -0.2], 25),
      k(0.52, 'ferrari', [-3.7, 0.9, -4.4], [0, 0.6, -0.4], 30),
      k(0.62, 'ferrari', [3.9, 0.9, -4.6], [2.6, 0.65, -0.3], 30),
      // Interior & care: Maybach, behind it first, then its outer flank
      k(0.73, 'maybach', [-3.4, 0.9, -5.2], [-1.4, 0.8, -0.6], 31),
      k(0.84, 'maybach', [4.2, 0.9, -5.0], [0, 0.8, -0.6], 31),
      k(0.91, 'maybach', [3.0, 1.15, 0.6], [0, 0.95, 0.0], 26),
      k(0.97, 'maybach', [4.4, 0.8, 5.2], [0, 0.8, 0.6], 30),
    ];
  },

  prepare({ el }) {
    el.querySelectorAll('.svc__panel').forEach((p, i) => { p.classList.toggle('is-on', i === 0); p.inert = i !== 0; });
  },

  init({ ScrollTrigger, el, site }) {
    const stage = el.querySelector('.svc__stage'), tabs = el.querySelector('.svc__tabs'), sw = el.querySelector('.svc__finishes');
    stage.innerHTML = SERVICES.map((s) => `
      <article class="svc__panel" id="svc-${s.id}" aria-labelledby="svc-h-${s.id}">
        <p class="svc__kicker">${s.kicker}</p>
        <h2 id="svc-h-${s.id}" class="svc__title">${s.name}</h2>
        <p class="svc__lead">${s.lead}</p>
        <ul class="svc__steps">${s.steps.map((t) => `<li>${t}</li>`).join('')}</ul>
        <p class="svc__note">${s.note}</p>
        <a class="svc__book" href="#booking" data-book="${s.id}">Request this service</a>
      </article>`).join('');
    tabs.innerHTML = SERVICES.map((s, i) => `<button type="button" data-i="${i}">${s.name}</button>`).join('');
    sw.innerHTML = `<legend>Preview a finish on this car</legend>` +
      `<button type="button" role="radio" aria-checked="true" data-f="orig">Original</button>` +
      FINISHES.map((f) => `<button type="button" role="radio" aria-checked="false" data-f="${f.id}" title="${f.name}" style="--sw:#${f.hex.toString(16).padStart(6, '0')}"><span class="sr-only">${f.name}</span></button>`).join('');

    const chosen = {};                        // car id -> finish id
    let idx = -1;
    const paintUI = () => { const id = chosen[SERVICES[idx].car] || 'orig'; sw.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.f === id))); };
    const setChapter = (i) => {
      if (i === idx) return; idx = i;
      el.querySelectorAll('.svc__panel').forEach((p, j) => { p.classList.toggle('is-on', j === i); p.inert = j !== i; });
      tabs.querySelectorAll('button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      paintUI();
    };
    setChapter(0);

    ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (s) => setChapter(s.progress < CH[1] ? 0 : s.progress < CH[2] ? 1 : 2) });

    const goChapter = (i) => {
      const r = el.getBoundingClientRect(), y = r.top + window.scrollY + JUMP[i] * (el.offsetHeight - window.innerHeight);
      site.lenis.scrollTo(y, { duration: 1.6, immediate: site.reduced, force: true });
    };
    tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) goChapter(+b.dataset.i); });

    sw.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]'); if (!b) return;
      const car = site.cars?.[SERVICES[idx].car]; if (!car?.paintMats?.length) return;     // model not loaded yet: do nothing rather than pretend
      const f = FINISHES.find((x) => x.id === b.dataset.f);
      car.setPaint(f ? f.hex : null); chosen[SERVICES[idx].car] = b.dataset.f; paintUI();
    });
  },
};
