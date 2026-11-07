// Before / after comparison slider. Accessible (native range input drives it, so keyboard + screen readers
// work), pointer-draggable, and honest: it only ever shows the photographs it is given.
export function buildCompare(item, i) {
  const fig = document.createElement('figure');
  fig.className = 'cmp';
  const alt = item.title || 'Paint comparison';
  fig.innerHTML = `
    <div class="cmp__frame" style="--r:${item.width && item.height ? item.width / item.height : 1.6}; --p:50%">
      <img class="cmp__img" src="${item.after}" alt="After: ${alt}" loading="lazy" decoding="async" draggable="false">
      <img class="cmp__img cmp__img--before" src="${item.before}" alt="Before: ${alt}" loading="lazy" decoding="async" draggable="false">
      <i class="cmp__line" aria-hidden="true"></i><i class="cmp__knob" aria-hidden="true"></i>
      <span class="cmp__tag cmp__tag--b" aria-hidden="true">Before</span><span class="cmp__tag cmp__tag--a" aria-hidden="true">After</span>
      <input class="cmp__range" type="range" min="0" max="100" step="0.5" value="50" aria-label="Reveal before and after: ${alt}" aria-valuetext="50% before, 50% after">
    </div>
    <figcaption><b>${alt}</b>${item.note ? `<span>${item.note}</span>` : ''}</figcaption>`;
  const frame = fig.querySelector('.cmp__frame'), range = fig.querySelector('.cmp__range');
  const set = (v) => { frame.style.setProperty('--p', `${v}%`); range.setAttribute('aria-valuetext', `${Math.round(v)}% before, ${100 - Math.round(v)}% after`); };
  range.addEventListener('input', () => set(+range.value));
  // hover-follow on fine pointers only (touch uses the range thumb / drag)
  frame.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons === 0) return;
    const r = frame.getBoundingClientRect(); const v = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); range.value = v; set(v);
  });
  return fig;
}
