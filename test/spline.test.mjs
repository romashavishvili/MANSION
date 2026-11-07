import test from 'node:test';
import assert from 'node:assert/strict';
import { Track } from '../src/sequence/spline.js';
import { ramp, smoothstep } from '../src/sequence/curves.js';
import { lampLevel, revealLevel, T } from '../src/sequence/schedule.js';

test('Track hits every key exactly and holds ends', () => {
  const k = [{ t: 0, v: [0, 0] }, { t: 2, v: [4, 1] }, { t: 5, v: [3, 7] }];
  const tr = new Track(k);
  for (const key of k) assert.deepEqual(tr.evaluate(key.t).map((x) => +x.toFixed(9)), key.v);
  assert.deepEqual(tr.evaluate(-5), k[0].v);
  assert.deepEqual(tr.evaluate(99), k[2].v);
});

test('Track is C1 continuous across keys', () => {
  const tr = new Track([{ t: 0, v: [0] }, { t: 3, v: [5] }, { t: 4, v: [5.5] }, { t: 9, v: [-2] }]);
  const e = 1e-4;
  for (const t of [3, 4]) {
    const dl = (tr.evaluate(t)[0] - tr.evaluate(t - e)[0]) / e;
    const dr = (tr.evaluate(t + e)[0] - tr.evaluate(t)[0]) / e;
    assert.ok(Math.abs(dl - dr) < 1e-2, `velocity jump at ${t}: ${dl} vs ${dr}`);
  }
});

test('Track rejects unsorted/duplicate times', () => {
  assert.throws(() => new Track([{ t: 1, v: [0] }, { t: 1, v: [1] }]));
});

test('ramp eases and clamps', () => {
  const k = [[0, 0], [1, 1], [2, 0.5]];
  assert.equal(ramp(k, -1), 0); assert.equal(ramp(k, 5), 0.5);
  assert.equal(ramp(k, 1), 1); assert.ok(Math.abs(ramp(k, 0.5) - 0.5) < 1e-9);
  assert.equal(smoothstep(0, 1, 2), 1);
});

test('ignition: dark before start, fully on after, values in [0,1]; Ferrari strobes; Maybach is slow', () => {
  for (const car of ['bmw', 'ferrari', 'maybach']) for (const s of ['L', 'R']) {
    assert.equal(lampLevel(car, s, T[car].start - 0.01), 0);
    assert.equal(lampLevel(car, s, T[car].full + 2.5), 1);
    for (let t = 0; t < T.end; t += 0.01) { const v = lampLevel(car, s, t); assert.ok(v >= 0 && v <= 1.0000001); }
  }
  let flips = 0, last = 0;
  for (let t = T.ferrari.start; t < T.ferrari.start + 1.0; t += 0.01) { const v = lampLevel('ferrari', 'L', t) > 0.5 ? 1 : 0; if (v !== last) flips++; last = v; }
  assert.ok(flips >= 4, `ferrari strobe flips ${flips}`);
  assert.ok(lampLevel('maybach', 'L', T.maybach.start + 1.5) < 0.2, 'maybach should still be dim 1.5 s in');
  assert.ok(revealLevel('bmw', 0) === 0 && revealLevel('bmw', T.end) === 1);
});

test('scenes are ordered and gates sit between ignitions', () => {
  assert.ok(T.bmw.full < T.gateFerrari && T.gateFerrari < T.ferrari.start);
  assert.ok(T.ferrari.full < T.gateMaybach && T.gateMaybach < T.maybach.start);
  assert.ok(T.maybach.full < T.sweep.start && T.title.in < T.title.subtitle && T.title.subtitle < T.end);
});
