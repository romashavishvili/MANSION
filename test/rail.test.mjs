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

  // A segment between two keys may only come as close as the closer-working of the two sections it joins.
  const need = (t) => {
    const keys = rail.pos.keys;
    let i = 0; while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const sec = (kt) => SECTIONS[Math.min(SECTIONS.length - 1, Math.floor(kt + 1e-9))];
    return Math.min(sec(keys[i].t).minClear ?? 1.0, sec(keys[i + 1].t).minClear ?? 1.0);
  };

  test(`[${profile}] camera keeps its section's clearance from every car (1.0 m, 0.4 m in macro shots) and stays above the floor`, () => {
    let worst = Infinity, minY = Infinity, where = null;
    each((t, p) => {
      minY = Math.min(minY, p[1]);
      for (const id of Object.keys(LAYOUT)) {
        const margin = distanceToCarBox(LAYOUT[id], meta[id].size, p) - need(t);
        if (margin < worst) { worst = margin; where = { t: +t.toFixed(3), id, need: need(t) }; }
      }
    });
    console.log(`   [${profile}] tightest margin over required clearance ${worst.toFixed(2)} m at ${JSON.stringify(where)} | min height ${minY.toFixed(2)} m`);
    assert.ok(worst >= 0, `clearance violated by ${-worst} m at ${JSON.stringify(where)}`);
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
  for (let t = 1.0; t <= 1.84; t += 0.01) {
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

// ---- Craftsmanship: the macro subjects are real, measured geometry and must be IN SHOT at their beat ----
const FERRARI = {
  lamp: [0.769, 0.584, 1.483],            // headlamp assembly centre (ferrari.meta.json)
  rearWheel: [0.787, 0.333, -1.418],      // rear-left wheel centre (tools/audit_models.py)
  flank: [0.95, 0.65, -0.9],              // a point on the left shoulder line
};
function angleOffFov(rail, t, worldPoint) {
  const p = rail.pos.evaluate(t), l = rail.look.evaluate(t), fov = rail.fov.evaluate(t)[0];
  const f = l.map((v, i) => v - p[i]), d = worldPoint.map((v, i) => v - p[i]);
  const ang = Math.acos((f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / (Math.hypot(...f) * Math.hypot(...d))) * 180 / Math.PI;
  return { ratio: ang / fov, dist: Math.hypot(...d), fov };
}
test('craftsmanship beats keep their subject centred and sized sensibly (lamp, flank, wheel)', () => {
  const rail = buildRail({ layout: LAYOUT, sections: SECTIONS, profile: 'desktop', introHero });
  const i = SECTIONS.findIndex((x) => x.id === 'craft');
  const W = (p) => localToWorld(LAYOUT.ferrari, p);
  const cases = [
    ['lamp', i + 0.24, W(FERRARI.lamp), 0.2, 1.1, 1.8],
    ['line', i + 0.5, W(FERRARI.flank), 0.9, 1.5, 3.8],
    ['wheel', i + 1.0, W(FERRARI.rearWheel), 0.2, 0.8, 1.6],
  ];
  for (const [name, t, pt, maxRatio, minD, maxD] of cases) {
    const r = angleOffFov(rail, Math.min(t, SECTIONS.length), pt);
    // the subject's apparent height = 2*d*tan(fov/2) must comfortably contain it: the lamp (~0.2 m), the wheel (0.66 m)
    const frameH = 2 * r.dist * Math.tan((r.fov * Math.PI) / 360);
    console.log(`   ${name}: off-axis ${(r.ratio * 100).toFixed(0)}% of fov, distance ${r.dist.toFixed(2)} m, frame height ${frameH.toFixed(2)} m`);
    assert.ok(r.ratio <= maxRatio, `${name} off-axis ${r.ratio}`);
    assert.ok(r.dist >= minD && r.dist <= maxD, `${name} distance ${r.dist}`);
  }
  const wheelFrame = (() => { const r = angleOffFov(rail, SECTIONS.length, W(FERRARI.rearWheel)); return 2 * r.dist * Math.tan((r.fov * Math.PI) / 360); })();
  assert.ok(wheelFrame >= 0.66 * 1.15, `the 0.66 m wheel must fit the frame (frame ${wheelFrame})`);
});

test('every section module has the interface the Site expects', () => {
  for (const s of SECTIONS) {
    assert.equal(typeof s.id, 'string'); assert.equal(typeof s.label, 'string');
    assert.ok(s.scrollVh > 0); assert.equal(typeof s.cam, 'function');
  }
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length, 'duplicate section ids');
});

test('craft.tick drives real model state only inside its window and never throws without the Ferrari/wheels', () => {
  const craft = SECTIONS.find((x) => x.id === 'craft');
  const calls = [];
  const f = { ready: true, setLamps: (l, r) => calls.push(['lamps', l, r]), wheels: { setSpeed: (v) => calls.push(['spin', v]) } };
  craft.tick({ u: 0, cars: { ferrari: f } });                      // section start: lamps untouched, wheels still
  assert.deepEqual(calls.filter((c) => c[0] === 'lamps'), []);
  assert.deepEqual(calls.at(-1), ['spin', 0]);
  calls.length = 0;
  craft.tick({ u: 0.08, cars: { ferrari: f } });                   // dipping
  assert.ok(calls.find((c) => c[0] === 'lamps')[1] < 0.5);
  calls.length = 0;
  craft.tick({ u: 0.34, cars: { ferrari: f } });                   // window closed: back to the opening's own state
  assert.deepEqual(calls.filter((c) => c[0] === 'lamps'), []);
  calls.length = 0;
  craft.tick({ u: 1, cars: { ferrari: f } });
  assert.ok(Math.abs(calls.at(-1)[1] - 0.55) < 1e-9);
  craft.tick({ u: 0.5, cars: {} });                                // no Ferrari yet
  craft.tick({ u: 1, cars: { ferrari: { ready: true, setLamps() {}, wheels: null } } });   // model without wheel rig
});
