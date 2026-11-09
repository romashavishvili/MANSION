import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCameraScript } from '../src/sequence/cameraScript.js';
import { LAYOUT } from '../src/config.js';
import { T } from '../src/sequence/schedule.js';
import { distanceToCarBox, localToWorld } from '../src/math/pose.js';

const meta = Object.fromEntries(['bmw', 'ferrari', 'maybach'].map((k) =>
  [k, JSON.parse(fs.readFileSync(new URL(`../public/models/${k}.meta.json`, import.meta.url)))]));
const script = buildCameraScript(LAYOUT);
const STEP = 0.02;

function sample(fn) { for (let t = 0; t <= script.duration; t += STEP) fn(t, script.pos.evaluate(t), script.look.evaluate(t), script.fov.evaluate(t)[0]); }

test('camera never enters or grazes a car (>= 0.9 m clearance) and stays above the floor', () => {
  let minClear = Infinity, minY = Infinity, where = null;
  sample((t, p) => {
    minY = Math.min(minY, p[1]);
    for (const id of Object.keys(LAYOUT)) {
      const d = distanceToCarBox(LAYOUT[id], meta[id].size, p);
      if (d < minClear) { minClear = d; where = { t: +t.toFixed(2), id }; }
    }
  });
  console.log('   min clearance', minClear.toFixed(2), 'm at', JSON.stringify(where), '| min camera height', minY.toFixed(2));
  assert.ok(minClear >= 0.9, `clearance ${minClear} at ${JSON.stringify(where)}`);
  assert.ok(minY >= 0.3);
});

test('camera speed stays within cinematic limits (no snaps)', () => {
  let prev = null, vmax = 0, tmax = 0, amax = 0, pv = null;
  sample((t, p) => {
    if (prev) {
      const v = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) / STEP;
      if (v > vmax) { vmax = v; tmax = t; }
      if (pv != null) amax = Math.max(amax, Math.abs(v - pv) / STEP);
      pv = v;
    }
    prev = p.slice();
  });
  console.log('   max speed', vmax.toFixed(2), 'm/s at t=', tmax.toFixed(2), '| max accel', amax.toFixed(2), 'm/s2');
  assert.ok(vmax < 6.5, `speed ${vmax}`);
  assert.ok(amax < 9, `accel ${amax}`);
});

test('look target is continuous and the camera never looks straight down/up', () => {
  let prev = null, jump = 0;
  sample((t, p, l) => {
    if (prev) jump = Math.max(jump, Math.hypot(l[0] - prev[0], l[1] - prev[1], l[2] - prev[2]) / STEP);
    prev = l.slice();
    const dy = l[1] - p[1], dh = Math.hypot(l[0] - p[0], l[2] - p[2]);
    assert.ok(Math.abs(Math.atan2(dy, dh)) < 0.5, `extreme pitch at t=${t}`);
  });
  console.log('   max look-target speed', jump.toFixed(2), 'm/s');
  assert.ok(jump < 7);
});

test('every ignition scene frames its subject car (car centre inside the view cone)', () => {
  const checks = [['bmw', T.bmw.full], ['ferrari', T.ferrari.full + 1], ['maybach', T.maybach.full]];
  for (const [id, t] of checks) {
    const p = script.pos.evaluate(t), l = script.look.evaluate(t), fov = script.fov.evaluate(t)[0];
    const c = localToWorld(LAYOUT[id], [0, 0.7, 0.8]);
    const f = l.map((v, i) => v - p[i]), n = Math.hypot(...f);
    const d = c.map((v, i) => v - p[i]), m = Math.hypot(...d);
    const ang = Math.acos((f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / (n * m)) * 180 / Math.PI;
    console.log(`   ${id} @t=${t}s : subject ${ang.toFixed(1)} deg off view-centre (vertical fov ${fov})`);
    assert.ok(ang < fov * 0.9, `${id} not framed (${ang} deg off)`);
  }
});

test('hero frame sees all three cars (horizontal fov @16:9)', () => {
  const t = T.end, p = script.pos.evaluate(t), l = script.look.evaluate(t), fov = script.fov.evaluate(t)[0];
  const hfov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * 16 / 9) * 180 / Math.PI;
  const f = l.map((v, i) => v - p[i]), n = Math.hypot(...f);
  for (const id of Object.keys(LAYOUT)) {
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const c = localToWorld(LAYOUT[id], [sx * meta[id].size[0] / 2, 0.7, sz * meta[id].size[2] / 2]);
      const d = c.map((v, i) => v - p[i]);
      // horizontal angle only
      const fa = Math.atan2(f[0], f[2]), da = Math.atan2(d[0], d[2]);
      let off = Math.abs((da - fa) * 180 / Math.PI); if (off > 180) off = 360 - off;
      assert.ok(off < hfov / 2 - 2, `${id} edge outside hero frame: ${off.toFixed(1)} vs ${hfov / 2}`);
    }
  }
  console.log(`   hero horizontal fov ${hfov.toFixed(1)} deg - all car edges inside`);
});
