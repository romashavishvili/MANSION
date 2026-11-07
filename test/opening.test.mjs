import test from 'node:test';
import assert from 'node:assert/strict';
import { Opening } from '../src/sequence/opening.js';
import { buildCameraScript } from '../src/sequence/cameraScript.js';
import { LAYOUT } from '../src/config.js';
import { T } from '../src/sequence/schedule.js';

function rig() {
  const script = buildCameraScript(LAYOUT);
  return { script, mode: 'script', applied: [], leaveOrbit() { this.mode = 'script'; }, enterOrbit(l) { this.mode = 'orbit'; this.look = l; },
    applyScript(t) { this.applied.push(t); } };
}
function fakes(ready = { bmw: true, ferrari: true, maybach: true }) {
  const mk = (id) => ({ id, ready: ready[id], lamps: [0, 0], reveal: 0, sway: 0,
    setLamps(l, r) { this.lamps = [l, r]; }, setReveal(v) { this.reveal = v; }, setSway(s) { this.sway = s; } });
  const cars = { bmw: mk('bmw'), ferrari: mk('ferrari'), maybach: mk('maybach') };
  const hud = { title: null, sub: null, cap: null, phase: null, setTitle(v) { this.title = v; }, setSubtitle(v) { this.sub = v; },
    setCaption(c) { this.cap = c; }, setPhase(p) { this.phase = p; } };
  const stage = { sweep: -1, setSweep(s) { this.sweep = s; } };
  return { cars, hud, stage, rig: rig() };
}
const run = (o, seconds, dt = 1 / 60) => { for (let i = 0; i < seconds / dt; i++) { o.update(dt); o.apply(i * dt, dt); } };

test('plays through, lights ignite in order BMW -> Ferrari -> Maybach, then hands over to orbit', () => {
  const d = fakes(); const o = new Opening(d); o.start();
  const first = {};
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 45 && !o.finished; i++) {
    o.update(dt); o.apply(i * dt, dt);
    for (const id of ['bmw', 'ferrari', 'maybach']) if (first[id] == null && d.cars[id].lamps[0] > 0.05) first[id] = o.t;
  }
  assert.ok(o.finished);
  assert.ok(first.bmw < first.ferrari && first.ferrari < first.maybach, JSON.stringify(first));
  assert.ok(Math.abs(first.bmw - T.bmw.start) < 1.0 && Math.abs(first.ferrari - T.ferrari.start) < 0.5 && Math.abs(first.maybach - T.maybach.start) < 2.0, JSON.stringify(first));
  assert.equal(d.rig.mode, 'orbit'); assert.equal(d.hud.phase, 'free');
  assert.equal(d.hud.title, true); assert.equal(d.hud.sub, true);
  for (const id of ['bmw', 'ferrari', 'maybach']) { assert.deepEqual(d.cars[id].lamps, [1, 1]); assert.equal(d.cars[id].reveal, 1); }
  console.log('   first light at', JSON.stringify(Object.fromEntries(Object.entries(first).map(([k, v]) => [k, +v.toFixed(2)]))));
});

test('the clock is HELD at a gate until the next car has loaded, then resumes', () => {
  const d = fakes({ bmw: true, ferrari: false, maybach: false }); const o = new Opening(d); o.start();
  run(o, 30);
  assert.ok(o.t < T.gateFerrari && o.t > T.gateFerrari - 0.01, `held at ${o.t}`);
  assert.equal(o.waitingFor, 'ferrari');
  assert.equal(d.cars.ferrari.lamps[0], 0, 'Ferrari must not ignite before it exists');
  d.cars.ferrari.ready = true;
  run(o, 3);
  assert.ok(o.t > T.gateFerrari, 'resumes after load');
  assert.equal(o.waitingFor, null);
  run(o, 30);
  assert.ok(o.t < T.gateMaybach && o.waitingFor === 'maybach');
});

test('captions follow the story and title appears late; scrubbing backwards removes them', () => {
  const d = fakes(); const o = new Opening(d); o.start();
  const at = (t) => { o.scrub(t); o.apply(t, 0.016); return { cap: d.hud.cap, title: d.hud.title, sub: d.hud.sub }; };
  assert.deepEqual(at(1), { cap: null, title: false, sub: false });
  assert.equal(at(T.bmw.full).cap, 'bmw');
  assert.equal(at(T.ferrari.full + 1).cap, 'ferrari');
  assert.equal(at(T.maybach.full).cap, 'maybach');
  assert.deepEqual(at(T.title.in + 0.1), { cap: null, title: true, sub: false });
  assert.equal(at(T.end - 0.1).sub, true);
  assert.equal(at(2).title, false);
});

test('skip fast-forwards; scrubbing out of orbit returns to script mode', () => {
  const d = fakes(); const o = new Opening(d); o.start(); o.skip();
  run(o, 12);
  assert.ok(o.finished, 'skip reaches the end in a few seconds');
  o.scrub(10); assert.equal(d.rig.mode, 'script'); assert.equal(o.finished, false);
});

test('jumpToEnd (reduced motion) shows the finished state immediately', () => {
  const d = fakes(); const o = new Opening(d); o.jumpToEnd(0); o.apply(0, 0.016);
  assert.ok(o.finished && d.rig.mode === 'orbit' && d.hud.title === true);
});
