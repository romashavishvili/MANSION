// Pure helpers for framing on any screen shape. No three.js.

/**
 * The opening and the scroll rail are authored for a 16:9 screen. On a narrower window (4:3, tablets,
 * phones in portrait) the same vertical field of view would crop the line-up to a sliver, so the
 * vertical fov is widened to keep roughly the same horizontal coverage. The boost is capped so
 * portrait phones do not get an extreme wide-angle lens; the dedicated mobile re-cut of the shots
 * (a later stage) will tighten this further.
 *
 * @param {number} vfovDeg authored vertical fov, degrees
 * @param {number} aspect  viewport width / height
 */
export function aspectFov(vfovDeg, aspect, ref = 1.6, maxBoost = 1.8) {
  if (!(aspect > 0) || aspect >= ref) return vfovDeg;
  const k = Math.min(maxBoost, ref / aspect);
  return (2 * Math.atan(Math.tan((vfovDeg * Math.PI) / 360) * k) * 180) / Math.PI;
}

/** 'mobile' for portrait-ish viewports, 'desktop' otherwise. Mirrors the CSS (max-aspect-ratio: 9/10). */
export function profileFor(width, height) {
  return width / Math.max(1, height) < 0.9 ? 'mobile' : 'desktop';
}
