import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCameraScript, heroPose } from '../src/sequence/cameraScript.js';
import { LAYOUT } from '../src/config.js';
import { distanceToCarBox, localToWorld } from '../src/math/pose.js';
import { buildRail, railTimeAt } from '../src/site/rail.js';
import { aspectFov, profileFor } from '../src/camera/aspect.js';
import { SECTIONS } from '../src/site/sections/index.js';

const meta = Object.fromEntries(['bmw', 'ferrari', 'maybach'].map((k) =>
  [k, JSON.parse(fs.readFileSync(new URL(`../public/models/${k}.meta.json`, import.meta.url)))]));
const introHero = heroPose(buildCameraScript(LAYOUT));
const STEP = 0.004;

for (const profile of ['desktop', 'mobile']) {
  const rail = buildRail({ layout: LAYOUT, sections: SECTIONS, profile, introHero });
  const each = (fn) => { for (let t = 0; t <= SECTIONS.length; t += STEP) fn(t, rail.pos.evaluate(t), rail.look.evaluate(t), rail.fov.evaluate(t)[0], rail.shift.evaluate(t)); };

  test(`[${profile}] the rail starts exactly where the opening ends (seamless hand-off)`, () => {
    const p = rail.pos.evaluate(0), l = rail.look.evaluate(0), f = rail.fov.evaluate(0)[0];
    introHero.pos.forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-9));
    introHero.look.forEach((v, i) => assert.ok(Math.abs(v - l[i]) < 1e-9));
    assert.equal(f, introHero.fov);
    assert.deepEqual(rail.shift.evaluate(0), [0, 0]);
  });

  test(`[${profile}] camera keeps >= 1.0 m from every car and above the floor`, () => {
    let min = Infinity, minY = Infinity, where = null;
    each((t, p) => {
      minY = Math.min(minY, p[1]);
      for (const id of Object.keys(LAYOUT)) {
        const d = distanceToCarBox(LAYOUT[id], meta[id].size, p);
        if (d < min) { min = d; where = { t: +t.toFixed(3), id }; }
      }
    });
    console.log(`   [${profile}] min clearance ${min.toFixed(2)} m at ${JSON.stringify(where)} | min height ${minY.toFixed(2)} m`);
    assert.ok(min >= 1.0, `clearance ${min} at ${JSON.stringify(where)}`);
    assert.ok(minY >= 0.33);
  });

  test(`[${profile}] camera speed is cinematic: metres travelled per viewport of scroll stays bounded`, () => {
    let prev = null, worst = 0, at = 0;
    each((t, p) => {
      if (prev) {
        const i = Math.min(SECTIONS.length - 1, Math.floor(prev.t));
        const vhPerUnit = SECTIONS[i].scrollVh;                      // viewports of scroll per rail unit
        const metres = Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1], p[2] - prev.p[2]);
        const perVh = metres / ((t - prev.t) * vhPerUnit);
        if (perVh > worst) { worst = perVh; at = t; }
      }
      prev = { t, p: p.slice() };
    });
    console.log(`   [${profile}] max camera speed ${worst.toFixed(2)} m per viewport of scroll at rail t=${at.toFixed(2)}`);
    assert.ok(worst < 9, `too fast: ${worst}`);
  });

  test(`[${profile}] no extreme pitch; look target is continuous`, () => {
    let prev = null, jump = 0;
    each((t, p, l) => {
      const pitch = Math.atan2(l[1] - p[1], Math.hypot(l[0] - p[0], l[2] - p[2]));
      assert.ok(Math.abs(pitch) < 0.5, `pitch ${pitch} at ${t}`);
      if (prev) jump = Math.max(jump, Math.hypot(l[0] - prev[0], l[1] - prev[1], l[2] - prev[2]) / STEP);
      prev = l.slice();
    });
    assert.ok(jump < 60, `look target jump ${jump}`);
  });
}

test('philosophy keeps the Ferrari inside the view cone throughout', () => {
  const rail = buildRail({ layout: LAYOUT, sections: SECTIONS, profile: 'desktop', introHero });
  const c = localToWorld(LAYOUT.ferrari, [0, 0.6, 0.4]);
  let worst = 0;
  for (let t = 1.0; t <= 2.0; t += 0.01) {
    const p = rail.pos.evaluate(t), l = rail.look.evaluate(t), fov = rail.fov.evaluate(t)[0];
    const f = l.map((v, i) => v - p[i]), d = c.map((v, i) => v - p[i]);
    const ang = Math.acos((f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / (Math.hypot(...f) * Math.hypot(...d))) * 180 / Math.PI;
    worst = Math.max(worst, ang / fov);
  }
  console.log(`   worst subject offset = ${(worst * 100).toFixed(0)}% of the vertical fov`);
  assert.ok(worst < 0.9);
});

test('railTimeAt: piecewise-linear, continuous, clamped', () => {
  const tops = [0, 1400, 4800], max = 5200;
  assert.equal(railTimeAt(-50, tops, max), 0);
  assert.equal(railTimeAt(0, tops, max), 0);
  assert.equal(railTimeAt(700, tops, max), 0.5);
  assert.equal(railTimeAt(1400, tops, max), 1);
  assert.ok(Math.abs(railTimeAt(1399.999, tops, max) - 1) < 1e-6);
  assert.equal(railTimeAt(3100, tops, max), 1.5);
  assert.equal(railTimeAt(5200, tops, max), 3);
  assert.equal(railTimeAt(9999, tops, max), 3);
  let last = -1;
  for (let y = 0; y <= 5200; y += 13) { const t = railTimeAt(y, tops, max); assert.ok(t >= last); last = t; }
});

test('buildRail rejects malformed sections', () => {
  const bad = [{ id: 'x', cam: () => [{ u: 0.2, pos: [0, 1, 0], look: [0, 1, 1], fov: 30 }] }];
  assert.throws(() => buildRail({ layout: LAYOUT, sections: bad, profile: 'desktop', introHero }), /u = 0/);
  const bad2 = [{ id: 'a', cam: () => [{ u: 0, pos: [0, 1, 0], look: [0, 1, 1], fov: 30 }, { u: 1, pos: [0, 1, 1], look: [0, 1, 2], fov: 30 }] },
                { id: 'b', cam: () => [{ u: 0, pos: [0, 1, 0], look: [0, 1, 1], fov: 30 }] }];
  assert.throws(() => buildRail({ layout: LAYOUT, sections: bad2, profile: 'desktop', introHero }), /invalid key/);
});

test('aspectFov: unchanged at 16:9, widened (but capped) on narrow screens', () => {
  assert.equal(aspectFov(30, 16 / 9), 30);
  assert.equal(aspectFov(30, 1.6), 30);
  const tablet = aspectFov(30, 4 / 3), phone = aspectFov(30, 0.46);
  assert.ok(tablet > 30 && tablet < 40);
  assert.ok(phone > tablet && phone < 62, `phone fov ${phone}`);
  assert.equal(profileFor(1440, 900), 'desktop');
  assert.equal(profileFor(390, 844), 'mobile');
  assert.equal(profileFor(1024, 1024), 'desktop');
});
