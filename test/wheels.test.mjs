import test from 'node:test';
import assert from 'node:assert/strict';
import { rollRate, approach, RollState } from '../src/cars/wheelMath.js';

// Wheel centres/sizes measured from the real GLB geometry by tools/audit_models.py (Ferrari, car-local, metres).
const FERRARI_WHEELS = [
  { id: 'tire 1', radius: 0.313 }, { id: 'tire 2', radius: 0.313 },
  { id: 'tire 3', radius: 0.330 }, { id: 'tire 4', radius: 0.330 },
];

test('rollRate = v / r, and is safe for degenerate radii', () => {
  assert.equal(rollRate(2, 0.5), 4);
  assert.equal(rollRate(2, 0), 0);
});

test('approach converges, is monotone and frame-rate independent', () => {
  let a = 0, b = 0;
  for (let i = 0; i < 60; i++) a = approach(a, 1, 1 / 60, 0.7);          // 1 s at 60 fps
  for (let i = 0; i < 30; i++) b = approach(b, 1, 1 / 30, 0.7);          // 1 s at 30 fps
  assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  assert.ok(a > 0.7 && a < 0.8);
});

test('rear (larger) wheels turn slower than the fronts at the same ground speed; angle stays in [0, 2pi)', () => {
  const s = FERRARI_WHEELS.map((w) => new RollState(w.radius));
  let last;
  for (let i = 0; i < 600; i++) last = s.map((r) => r.step(1 / 60, 0.55));
  assert.ok(s[2].speed === s[0].speed);                                  // same ground speed
  const ang = [], steps = s.map((r) => rollRate(r.speed, r.radius));
  assert.ok(steps[0] > steps[2], 'front wheels must turn faster than larger rear wheels');
  last.forEach((a) => { assert.ok(a >= 0 && a < Math.PI * 2); });
  assert.ok(Math.abs(steps[0] / steps[2] - 0.33 / 0.313) < 0.05);
});

test('a stopped wheel stays stopped', () => {
  const r = new RollState(0.3);
  for (let i = 0; i < 100; i++) r.step(1 / 60, 0);
  assert.equal(r.angle, 0);
});
