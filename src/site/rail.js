import { Track } from '../sequence/spline.js';
import { localToWorld } from '../math/pose.js';

// The scroll rail: the camera choreography of the WEBSITE, the counterpart of sequence/cameraScript.js
// (the opening). Both are authored the same way - keys in a car's local frame (+Z = nose, +X = left),
// converted to world space, evaluated with the same Hermite Track - so the two connect seamlessly.
//
// Rail time is measured in "sections": section i occupies rail time [i, i+1]. Each section module
// (src/site/sections/*.js) supplies its own camera keys with a local coordinate u in [0, 1):
//     cam({ W, profile, introHero }) -> [{ u, pos, look, fov, shift }]
//   pos / look : world-space camera position and look-at target
//   fov        : authored vertical field of view (degrees, designed for 16:9)
//   shift      : [x, y] frame shift as a fraction of the viewport. +x moves the picture RIGHT, +y moves it
//                DOWN, so type can own one half of the screen while the car owns the other.
// The last section must also supply a key at u = 1 (the end of the page).
//
// Everything here is pure (no DOM, no three.js) and unit-tested in test/rail.test.mjs.

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** @param {{layout:object, sections:object[], profile:'desktop'|'mobile', introHero:{pos:number[],look:number[],fov:number}}} o */
export function buildRail({ layout, sections, profile, introHero }) {
  const W = (car, p) => localToWorld(layout[car], p);
  const P = [], L = [], F = [], S = [];
  sections.forEach((section, i) => {
    const keys = section.cam({ W, profile, introHero });
    if (!keys.length || keys[0].u !== 0) throw new Error(`section "${section.id}" must start its camera at u = 0`);
    const last = i === sections.length - 1;
    for (const k of keys) {
      if (k.u < 0 || k.u > 1 || (k.u === 1 && !last)) throw new Error(`section "${section.id}": invalid key u = ${k.u}`);
      const t = i + k.u;
      P.push({ t, v: k.pos });
      L.push({ t, v: k.look });
      F.push({ t, v: [k.fov] });
      S.push({ t, v: k.shift ?? [0, 0] });
    }
  });
  return { pos: new Track(P), look: new Track(L), fov: new Track(F), shift: new Track(S), count: sections.length };
}

/**
 * Maps the scroll position to rail time. Section i spans [tops[i], tops[i+1]] of scroll (the last one
 * ends at maxScroll), so the camera keeps travelling smoothly while the next section scrolls into view.
 * @param {number} scrollY  current (smoothed) scroll offset in px
 * @param {number[]} tops   ascending scroll offsets where each section begins (tops[0] = 0)
 * @param {number} maxScroll document scroll height minus viewport height
 */
export function railTimeAt(scrollY, tops, maxScroll) {
  const n = tops.length;
  if (!n) return 0;
  for (let i = n - 1; i >= 0; i--) {
    if (scrollY >= tops[i] || i === 0) {
      const end = i + 1 < n ? tops[i + 1] : Math.max(maxScroll, tops[i] + 1);
      return i + clamp01((scrollY - tops[i]) / Math.max(1e-6, end - tops[i]));
    }
  }
  return 0;
}
