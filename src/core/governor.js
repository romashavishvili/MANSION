/**
 * Performance governor: keeps the frame rate smooth on whatever GPU the visitor has.
 * It watches the real frame interval and steps the render resolution (a multiplier on the tier's pixel ratio)
 * down when frames are slow, and back up when there is clear headroom. If the lowest resolution is still too slow
 * it also drops the costliest optional effects (bloom, film grain, some dust). Changes are rate-limited with
 * hysteresis so the picture never flickers between sizes.
 *
 * Pure decision logic lives in `decide()` so it can be unit-tested without a GPU.
 */
export const GOV = { min: 0.55, max: 1.0, step: 0.1, slowMs: 24, fastMs: 15.5, downAfter: 0.9, upAfter: 4.0, warmup: 2.5 };

/** @returns {-1|0|1} -1 = render smaller, +1 = render larger */
export function decide({ avgMs, slowFor, fastFor, scale }, g = GOV) {
  if (avgMs > g.slowMs && slowFor >= g.downAfter && scale > g.min + 1e-6) return -1;
  if (avgMs < g.fastMs && fastFor >= g.upAfter && scale < g.max - 1e-6) return 1;
  return 0;
}

export class Governor {
  constructor({ stage, onChange }) {
    this.stage = stage; this.onChange = onChange;
    this.scale = 1; this.avg = 16.7; this.slowFor = 0; this.fastFor = 0; this.age = 0; this.level = 0;
    this.enabled = !new URLSearchParams(location.search).has('nogov');
    this._cool = 0;
  }

  /** @param {number} ms real time since the previous frame (unclamped) */
  frame(ms) {
    if (!this.enabled || document.hidden) return;
    const dt = ms / 1000;
    this.age += dt;
    if (ms > 250) return;                         // a hitch (tab switch, shader compile): not a trend
    this.avg += (ms - this.avg) * 0.06;
    if (this.age < GOV.warmup) return;
    this.slowFor = this.avg > GOV.slowMs ? this.slowFor + dt : 0;
    this.fastFor = this.avg < GOV.fastMs ? this.fastFor + dt : 0;
    this._cool -= dt;
    if (this._cool > 0) return;
    const d = decide({ avgMs: this.avg, slowFor: this.slowFor, fastFor: this.fastFor, scale: this.scale });
    if (d === 0) {
      // already at the floor and still slow: shed optional effects too
      if (this.scale <= GOV.min + 1e-6 && this.avg > GOV.slowMs && this.slowFor >= 2.5 && this.level < 2) { this.level++; this.stage.setEffects(this.level); this.slowFor = 0; this._cool = 1.5; }
      return;
    }
    this.scale = Math.round((this.scale + d * GOV.step) * 100) / 100;
    this.stage.setScale(this.scale);
    this.avg = d < 0 ? 16.7 : this.avg;           // re-measure at the new size
    this.slowFor = this.fastFor = 0; this._cool = d < 0 ? 0.8 : 2.0;
    this.onChange?.(this.scale);
  }
}
