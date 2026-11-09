import { ramp } from './curves.js';

// Master timeline for the opening (seconds). Everything visual is a pure function of this clock,
// so the sequence can be scrubbed, paused, skipped and replayed deterministically.
export const T = {
  // Scene 01  - absolute darkness
  dark: 0.0,
  // Scene 02  - BMW ignition
  bmw:     { start: 3.0,  full: 6.6 },
  // Gate: the clock will not pass this time until the Ferrari has finished loading
  gateFerrari: 11.0,
  // Scene 03  - Ferrari ignition
  ferrari: { start: 12.4, full: 14.6 },
  gateMaybach: 22.0,
  // Scene 04  - Maybach ignition
  maybach: { start: 23.0, full: 27.4 },
  // Scene 05  - all three
  sweep:   { start: 32.0, end: 39.0 },
  title:   { in: 35.6, subtitle: 38.2 },
  end: 40.5,
};

export const GATES = [
  { t: T.gateFerrari, car: 'ferrari' },
  { t: T.gateMaybach, car: 'maybach' },
];

// Per-lamp ignition rhythms, as [secondsSinceStart, level] keys. Each car has a different character.
const RHYTHM = {
  // BMW: HID/LED warm-up - hesitant flicker, then a confident rise
  bmw: {
    L: [[0, 0], [0.12, 0.2], [0.26, 0], [0.55, 0.32], [0.7, 0.04], [1.15, 0.6], [1.4, 0.42], [2.3, 0.85], [3.6, 1]],
    R: [[0.35, 0], [0.5, 0.18], [0.62, 0], [0.9, 0.3], [1.05, 0.05], [1.5, 0.55], [1.75, 0.4], [2.6, 0.85], [3.6, 1]],
  },
  // Ferrari: hard strobe -> solid. Short and electric.
  ferrari: {
    L: [[0, 0], [0.06, 1], [0.2, 0], [0.32, 1], [0.46, 0.08], [0.58, 1], [0.8, 0.7], [1.3, 1]],
    R: [[0.04, 0], [0.1, 1], [0.24, 0], [0.36, 1], [0.5, 0.08], [0.62, 1], [0.84, 0.7], [1.3, 1]],
  },
  // Maybach: slow, ceremonial cross-fade. Right lamp follows the left.
  maybach: {
    L: [[0, 0], [1.2, 0.07], [4.4, 1]],
    R: [[0.8, 0], [2.0, 0.07], [4.4, 1]],
  },
};

/** Lamp level 0..1 for a car's left/right lamp at master time t. */
export function lampLevel(car, side, t) {
  const start = T[car].start;
  const keys = RHYTHM[car][side];
  const local = t - start;
  if (local <= 0) return 0;
  return ramp(keys, local);
}

/** Smooth 0..1 "body reveal" for a car (env reflections + accent light), following its ignition. */
export function revealLevel(car, t) {
  const { start, full } = T[car];
  return ramp([[start + 0.2, 0], [full + 2.2, 1]], t);
}
