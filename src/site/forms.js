// Forms: validation, WhatsApp link building and submission. Pure (no DOM) so it is unit-tested in node.
import { BUSINESS, SERVICES, TIME_PREFS } from '../business.config.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s().-]{5,18}[0-9]$/;
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Which ways of reaching the business are actually configured. The UI renders only what is true here. */
export function channels(b = BUSINESS) {
  return { endpoint: !!b.formEndpoint, whatsapp: /^[0-9]{7,15}$/.test(b.whatsapp || ''), email: !!b.email, phone: !!b.phone };
}

function contactErrors(v, e) {
  if (clean(v.name).length < 2) e.name = 'Please enter your name.';
  const em = clean(v.email), ph = clean(v.phone);
  if (!em && !ph) e.contact = 'Please give an email address or a phone number so we can reach you.';
  if (em && !EMAIL.test(em)) e.email = 'That email address does not look right.';
  if (ph && !PHONE.test(ph)) e.phone = 'That phone number does not look right.';
}

/** @returns {{ok:boolean, errors:Record<string,string>, values:object}} */
export function validateBooking(raw, now = new Date()) {
  const v = {
    service: clean(raw.service), vehicle: clean(raw.vehicle), date: clean(raw.date), time: clean(raw.time || TIME_PREFS[0]),
    name: clean(raw.name), email: clean(raw.email), phone: clean(raw.phone), notes: String(raw.notes ?? '').trim().slice(0, 1000),
    consent: !!raw.consent,
  };
  const e = {};
  if (!SERVICES.some((s) => s.id === v.service)) e.service = 'Please choose a service.';
  if (v.vehicle.length < 2) e.vehicle = 'Please tell us the make and model.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = 'Please choose a date.';
  else {
    const d = new Date(`${v.date}T00:00:00`);
    if (Number.isNaN(d.getTime()) || iso(d) !== v.date) e.date = 'That date does not exist.';
    else if (v.date < iso(now)) e.date = 'Please choose today or a later date.';
  }
  if (!TIME_PREFS.includes(v.time)) e.time = 'Please choose a time preference.';
  contactErrors(v, e);
  if (!v.consent) e.consent = 'Please agree so we may contact you about this request.';
  return { ok: Object.keys(e).length === 0, errors: e, values: v };
}

export function validateContact(raw) {
  const v = { name: clean(raw.name), email: clean(raw.email), phone: clean(raw.phone), message: String(raw.message ?? '').trim().slice(0, 2000), consent: !!raw.consent };
  const e = {};
  contactErrors(v, e);
  if (v.message.length < 5) e.message = 'Please write a short message.';
  if (!v.consent) e.consent = 'Please agree so we may reply to you.';
  return { ok: Object.keys(e).length === 0, errors: e, values: v };
}

const serviceName = (id) => SERVICES.find((s) => s.id === id)?.name ?? id;

/** Plain-text summary used for WhatsApp and for the payload's `summary` field. */
export function bookingSummary(v) {
  return [
    'Booking request', `Service: ${serviceName(v.service)}`, `Vehicle: ${v.vehicle}`, `Preferred date: ${v.date} (${v.time})`,
    `Name: ${v.name}`, v.email && `Email: ${v.email}`, v.phone && `Phone: ${v.phone}`, v.notes && `Notes: ${v.notes}`,
  ].filter(Boolean).join('\n');
}

export function whatsappUrl(text, b = BUSINESS) {
  if (!channels(b).whatsapp) return null;
  return `https://wa.me/${b.whatsapp}?text=${encodeURIComponent(text)}`;
}

/**
 * POSTs JSON to the configured endpoint. Resolves { ok:true } only when the server answered 2xx;
 * never reports success otherwise. `honeypot` must be empty (bots fill it).
 */
export async function submitForm(kind, values, { endpoint = BUSINESS.formEndpoint, fetchImpl = globalThis.fetch, timeoutMs = 15000, honeypot = '' } = {}) {
  if (!endpoint) return { ok: false, reason: 'not-configured' };
  if (honeypot) return { ok: true, silent: true };            // pretend-success to bots only; nothing is sent
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const payload = { form: kind, ...values, summary: kind === 'booking' ? bookingSummary(values) : values.message, submittedAt: new Date().toISOString() };
    const res = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: ctl?.signal });
    if (!res.ok) return { ok: false, reason: 'server', status: res.status };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally { if (timer) clearTimeout(timer); }
}
