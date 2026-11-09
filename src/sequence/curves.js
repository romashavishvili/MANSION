// Small, dependency-free easing / curve helpers.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Piecewise curve through [[time, value], ...] with smoothstep easing inside every segment.
 * Holds the first value before the first key and the last value after the last key.
 * Used for light "ignition" rhythms (flickers, strobes, slow ramps).
 */
export function ramp(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (t >= t0 && t < t1) return lerp(v0, v1, smoothstep(t0, t1, t));
  }
  return last[1];
}
