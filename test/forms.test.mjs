import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBooking, validateContact, submitForm, whatsappUrl, channels, bookingSummary } from '../src/site/forms.js';

const now = new Date('2026-11-07T10:00:00');
const good = { service: 'paint-correction', vehicle: 'BMW M5', date: '2026-11-20', time: 'Morning', name: 'Ana K', email: 'ana@example.com', phone: '', notes: '', consent: true };

test('valid booking passes', () => assert.ok(validateBooking(good, now).ok));
test('booking rejects every bad field with a message', () => {
  const r = validateBooking({ service: 'x', vehicle: '', date: '2026-11-06', time: 'Midnight', name: '', email: '', phone: '', consent: false }, now);
  for (const k of ['service', 'vehicle', 'date', 'time', 'name', 'contact', 'consent']) assert.ok(r.errors[k], k);
  assert.equal(r.ok, false);
});
test('today is allowed, impossible dates are not', () => {
  assert.ok(validateBooking({ ...good, date: '2026-11-07' }, now).ok);
  assert.ok(validateBooking({ ...good, date: '2026-02-31' }, now).errors.date);
});
test('email or phone is enough, but malformed ones fail', () => {
  assert.ok(validateBooking({ ...good, email: '', phone: '+995 555 12 34 56' }, now).ok);
  assert.ok(validateBooking({ ...good, email: 'nope' }, now).errors.email);
  assert.ok(validateBooking({ ...good, email: '', phone: 'abc' }, now).errors.phone);
});
test('contact form validation', () => {
  assert.ok(validateContact({ name: 'Ana', email: 'a@b.co', message: 'Hello there', consent: true }).ok);
  assert.ok(validateContact({ name: 'Ana', email: 'a@b.co', message: 'hi', consent: true }).errors.message);
});
test('submit: never claims success without an endpoint or a 2xx', async () => {
  assert.deepEqual(await submitForm('booking', good, { endpoint: '' }), { ok: false, reason: 'not-configured' });
  const f = (status) => async () => ({ ok: status < 300, status });
  assert.equal((await submitForm('booking', good, { endpoint: 'https://x', fetchImpl: f(500) })).ok, false);
  assert.equal((await submitForm('booking', good, { endpoint: 'https://x', fetchImpl: f(200) })).ok, true);
  assert.equal((await submitForm('booking', good, { endpoint: 'https://x', fetchImpl: async () => { throw new TypeError('x'); } })).reason, 'network');
});
test('submit: sends JSON with a summary; honeypot sends nothing', async () => {
  let seen; await submitForm('booking', good, { endpoint: 'https://x', fetchImpl: async (u, o) => { seen = JSON.parse(o.body); return { ok: true }; } });
  assert.equal(seen.form, 'booking'); assert.match(seen.summary, /Paint Correction/);
  let called = false; const r = await submitForm('booking', good, { endpoint: 'https://x', honeypot: 'bot', fetchImpl: async () => { called = true; } });
  assert.equal(called, false); assert.ok(r.silent);
});
test('whatsapp link only exists when a number is configured', () => {
  assert.equal(whatsappUrl('hi', { whatsapp: '' }), null);
  assert.equal(whatsappUrl('a b', { whatsapp: '995555123456' }), 'https://wa.me/995555123456?text=a%20b');
  assert.deepEqual(channels({ whatsapp: '12', formEndpoint: '' }), { endpoint: false, whatsapp: false, email: false, phone: false });
  assert.match(bookingSummary(validateBooking(good, now).values), /Vehicle: BMW M5/);
});
