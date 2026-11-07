// Time-parameterised cubic Hermite spline through keyframes (non-uniform Catmull-Rom tangents).
// Passes exactly through every key, is C1-continuous, and has zero velocity at the first and last
// key (a shot eases in and out). Two equal consecutive keys create a hold.
//
//   const track = new Track([{ t: 0, v: [0, 1, 5] }, { t: 4, v: [2, 1, 3] }]);
//   track.evaluate(2.5, out);

export class Track {
  constructor(keys) {
    if (!keys.length) throw new Error('Track needs at least one key');
    this.keys = keys.slice().sort((a, b) => a.t - b.t);
    for (let i = 1; i < this.keys.length; i++) {
      if (!(this.keys[i].t > this.keys[i - 1].t)) throw new Error('Track keys need strictly increasing t');
    }
    this.dim = this.keys[0].v.length;
    const n = this.keys.length;
    this.tangents = this.keys.map((k, i) => {
      const m = new Array(this.dim).fill(0);
      if (i > 0 && i < n - 1) {
        const p = this.keys[i - 1], q = this.keys[i + 1];
        const dt = q.t - p.t;
        for (let d = 0; d < this.dim; d++) m[d] = (q.v[d] - p.v[d]) / dt;
      }
      return m;
    });
    this.start = this.keys[0].t;
    this.end = this.keys[n - 1].t;
    this._i = 0;
  }

  evaluate(t, out = new Array(this.dim)) {
    const K = this.keys, n = K.length;
    if (t <= this.start) { for (let d = 0; d < this.dim; d++) out[d] = K[0].v[d]; return out; }
    if (t >= this.end) { for (let d = 0; d < this.dim; d++) out[d] = K[n - 1].v[d]; return out; }
    let i = this._i;
    if (!(K[i].t <= t && t < K[i + 1].t)) {
      i = 0;
      while (!(K[i].t <= t && t < K[i + 1].t)) i++;
      this._i = i;
    }
    const a = K[i], b = K[i + 1];
    const h = b.t - a.t, u = (t - a.t) / h, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const ma = this.tangents[i], mb = this.tangents[i + 1];
    for (let d = 0; d < this.dim; d++) {
      out[d] = h00 * a.v[d] + h10 * h * ma[d] + h01 * b.v[d] + h11 * h * mb[d];
    }
    return out;
  }
}
