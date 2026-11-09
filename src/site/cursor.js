/** A restrained custom cursor for fine pointers: a ring that follows with inertia and names the action it is over. */
export function initCursor(gsap) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const el = document.createElement('div');
  el.id = 'cursor'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><span></span>';
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor');
  const label = el.querySelector('span');
  const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' }), y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
  let shown = false;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!shown) { shown = true; el.classList.add('on'); gsap.set(el, { x: e.clientX, y: e.clientY }); }
    x(e.clientX); y(e.clientY);
    const t = e.target.closest?.('[data-cursor], a, button, [role=tab], input[type=range]');
    el.classList.toggle('hot', !!t);
    const txt = t?.dataset?.cursor || '';
    if (label.textContent !== txt) label.textContent = txt;
    el.classList.toggle('named', !!txt);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { shown = false; el.classList.remove('on'); });
  return el;
}
