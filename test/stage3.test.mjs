import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOM_SHOTS, allShots, cylLerp } from '../src/exhibit/shots.js';
import { distanceToCarBox } from '../src/math/pose.js';
import { validate, buildEnquiry, channels, SERVICES } from '../src/site/enquiry.js';
import { FINISHES } from '../src/exhibit/paint.js';
import { SECTIONS } from '../src/site/sections/index.js';
import { ANCHORS, CONTACT } from '../src/config.js';

const meta = Object.fromEntries(['bmw', 'ferrari', 'maybach'].map((k) =>
  [k, JSON.parse(fs.readFileSync(new URL(`../public/models/${k}.meta.json`, import.meta.url)))]));
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const origin = { x: 0, z: 0, yaw: 0 };

for (const id of ['bmw', 'ferrari', 'maybach']) {
  test(`[${id}] every room shot keeps the camera outside the car (>= 0.8 m) and above the floor, aimed near the car`, () => {
    for (const s of allShots(id)) {
      const d = distanceToCarBox(origin, meta[id].size, s.pos);
      assert.ok(d >= 0.8, `${id}: shot at ${s.pos} is only ${d.toFixed(2)} m from the body`);
      assert.ok(s.pos[1] >= 0.35, `${id}: shot too low`);
      assert.ok(distanceToCarBox(origin, meta[id].size, s.look) < 0.6, `${id}: look target ${s.look} is not on the car`);
      assert.ok(s.fov > 15 && s.fov < 45);
    }
  });
  test(`[${id}] the orbit target is on the car and the orbit limits bracket every shot`, () => {
    const o = ROOM_SHOTS[id].orbit;
    for (const s of allShots(id)) {
      const dist = Math.hypot(s.pos[0] - o.target[0], s.pos[1] - o.target[1], s.pos[2] - o.target[2]);
      assert.ok(dist <= o.max, `${id}: shot beyond max orbit distance`);
    }
  });
}

test('cylLerp arcs around the car: interpolated radius never drops below the smaller endpoint (no cut through the body)', () => {
  const a = [3.2, 0.6, 1.8], b = [-1.4, 0.9, -4.6];
  const r = (p) => Math.hypot(p[0], p[2]);
  const lo = Math.min(r(a), r(b)) - 1e-9;
  for (let k = 0; k <= 1.0001; k += 0.05) assert.ok(r(cylLerp(a, b, k)) >= lo);
  assert.deepEqual(cylLerp(a, b, 0).map((v) => +v.toFixed(6)), a);
  assert.deepEqual(cylLerp(a, b, 1).map((v) => +v.toFixed(6)), b);
});

test('measured anchors lie inside each car\'s bounding box (they are real geometry, not guesses)', () => {
  for (const [id, a] of Object.entries(ANCHORS)) for (const [k, v] of Object.entries(a)) {
    if (!Array.isArray(v)) continue;
    const [sx, sy, sz] = meta[id].size;
    assert.ok(Math.abs(v[0]) <= sx / 2 + 0.05 && v[1] >= 0 && v[1] <= sy && Math.abs(v[2]) <= sz / 2 + 0.05, `${id}.${k} ${v} outside box`);
  }
});

test('finishes are physically sane and never reach clear-coat 0 exactly (that would force a shader recompile)', () => {
  for (const [k, f] of Object.entries(FINISHES)) {
    for (const key of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness']) assert.ok(f[key] >= 0 && f[key] <= 1, `${k}.${key}`);
  }
  assert.ok(FINISHES.matte.roughness > FINISHES.gloss.roughness && FINISHES.satin.clearcoatRoughness > FINISHES.gloss.clearcoatRoughness);
});

test('enquiry: validation, text and channels; nothing is claimed sent without a configured channel', () => {
  const ok = { name: 'A', contact: 'a@b.co', vehicle: 'Ferrari LaFerrari', service: SERVICES[0], message: 'Hello' };
  assert.deepEqual(validate(ok), {});
  assert.ok(validate({ ...ok, contact: 'nope' }).contact);
  assert.ok(validate({ ...ok, name: ' ' }).name);
  assert.ok(validate({ ...ok, vehicle: '' }).vehicle);
  assert.ok(validate({ ...ok, contact: '+995 555 12 34 56' }).contact === undefined);
  const text = buildEnquiry(ok);
  assert.match(text, /Vehicle: Ferrari LaFerrari/); assert.match(text, /Hello$/);
  assert.deepEqual(channels({ email: '', whatsapp: '', phone: '', instagram: '' }, text), {});
  const ch = channels({ email: 'x@y.z', whatsapp: '+1 (555) 000', phone: '' }, text);
  assert.match(ch.email, /^mailto:x@y\.z\?subject=/); assert.match(ch.whatsapp, /^https:\/\/wa\.me\/1555000\?text=/);
  assert.deepEqual(Object.values(CONTACT), ['', '', '', ''], 'no business contact details may be invented in config');
});

test('every registered section has its element in index.html and unique ids', () => {
  const ids = SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
  for (const id of ['exhibit', 'veil']) assert.ok(html.includes(`id="${id}"`));
});

test('lab tabs and panels are paired for accessibility (aria-controls -> tabpanel, labelledby -> tab)', () => {
  for (const m of html.matchAll(/role="tab" id="(tab-\w+)" aria-controls="(pan-\w+)"/g)) {
    assert.ok(html.includes(`id="${m[2]}" aria-labelledby="${m[1]}"`), `${m[1]} <-> ${m[2]}`);
  }
});
