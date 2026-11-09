import { Track } from './spline.js';
import { localToWorld } from '../math/pose.js';
import { T } from './schedule.js';

/**
 * Builds the opening camera choreography. Shots are authored in each car's LOCAL frame
 * (+Z = nose, +X = car's left) and converted to world space, so changing LAYOUT keeps framing intact.
 *
 * Returns tracks for camera position, look-at target and field of view, all keyed on master time.
 */
export function buildCameraScript(layout) {
  const W = (car, p) => localToWorld(layout[car], p);
  const P = []; // position keys
  const L = []; // look-at keys
  const F = []; // fov keys
  const key = (t, pos, look, fov) => { P.push({ t, v: pos }); L.push({ t, v: look }); F.push({ t, v: [fov] }); };

  // ---- Scene 01/02 : darkness, then the slow approach to the BMW (camera on the car's right-front)
  key(0.0,  W('bmw', [-3.0, 1.60, 17.0]), W('bmw', [0.0, 0.80, 2.0]), 30);
  key(3.0,  W('bmw', [-3.4, 1.10, 10.5]), W('bmw', [0.0, 0.80, 2.0]), 30);
  key(7.4,  W('bmw', [-4.2, 0.62, 5.6]),  W('bmw', [0.2, 0.72, 1.6]), 34);
  // macro: the lit lamp interior, the DRL and the grille outline, ~3 m away
  key(10.6, W('bmw', [-2.4, 0.86, 4.5]),  W('bmw', [-0.1, 0.78, 2.2]), 28);

  // ---- Scene 03 : cross to the Ferrari, then arc low across its nose (right -> head-on -> left)
  key(13.4, [-3.0, 0.95, 8.6],            W('ferrari', [0.0, 0.55, 1.6]), 35);
  key(15.6, W('ferrari', [-3.4, 0.45, 5.0]), W('ferrari', [0.0, 0.55, 1.0]), 36);
  key(18.2, W('ferrari', [0.0, 0.33, 5.6]),  W('ferrari', [0.0, 0.50, 1.2]), 38);
  key(21.0, W('ferrari', [4.0, 0.55, 3.0]),  W('ferrari', [0.0, 0.55, 0.4]), 34);
  key(22.6, W('ferrari', [4.8, 0.80, 0.8]),  W('ferrari', [0.0, 0.55, -0.1]), 34);

  // ---- Scene 04 : glide to the Maybach, slow and formal
  key(25.8, W('maybach', [4.8, 1.00, 7.0]),  W('maybach', [0.0, 0.80, 1.6]), 32);
  key(29.2, W('maybach', [1.2, 0.75, 8.0]),  W('maybach', [0.0, 0.80, 1.0]), 30);
  key(32.2, W('maybach', [-2.0, 1.00, 9.5]), W('maybach', [0.0, 0.80, 1.0]), 32);

  // ---- Scene 05 : pull back across the line-up to the hero frame
  key(35.6, [0.0, 1.25, 11.5],  [0.0, 0.80, 1.0], 32);
  key(T.end, [0.0, 1.55, 19.0], [0.0, 0.85, 0.8], 34);   // single end key = natural ease-out into the hero frame

  return {
    pos: new Track(P),
    look: new Track(L),
    fov: new Track(F),
    duration: T.end,
    keys: { P, L, F },
  };
}

/** Final hero pose (used to hand over to free orbit). */
export function heroPose(script) {
  const pos = script.pos.evaluate(script.duration);
  const look = script.look.evaluate(script.duration);
  const fov = script.fov.evaluate(script.duration)[0];
  return { pos, look, fov };
}
