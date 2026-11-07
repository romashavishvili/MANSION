// Binds a <form> to validation + honest submission. Used by the booking and contact sections.
import { BUSINESS } from '../business.config.js';
import { channels, submitForm, whatsappUrl } from './forms.js';

const FAIL = {
  'timeout': 'The request took too long. Please try again.',
  'network': 'We could not reach the server. Check your connection and try again.',
  'server': 'The server did not accept the request. Please try again in a moment.',
};

export function bindForm(form, { kind, validate, summary, onReady }) {
  const ch = channels();
  const $ = (s) => form.querySelector(s);
  const status = $('.form__status'), notice = form.parentElement.querySelector('.form__notice'), submit = $('button[type=submit]'), wa = $('.form__wa'), done = form.parentElement.querySelector('.form__done');
  const fields = [...form.querySelectorAll('[name]')].filter((f) => f.name !== 'company');

  // --- what is actually available, said plainly -------------------------------------------------
  if (!ch.endpoint && !ch.whatsapp) {
    notice.hidden = false;
    notice.textContent = 'Online requests are not switched on yet. ' + (ch.email ? `Please write to ${BUSINESS.email}.` : ch.phone ? `Please call ${BUSINESS.phone}.` : 'Contact details will appear here once the studio adds them.');
    fields.forEach((f) => (f.disabled = true)); submit.hidden = true;
    if (import.meta.env?.DEV) console.warn(`[MANSION] ${kind} form is inactive: set formEndpoint and/or whatsapp in src/business.config.js`);
  } else if (!ch.endpoint) { submit.hidden = true; }          // WhatsApp is the only channel
  if (!ch.whatsapp && wa) wa.hidden = true;

  const read = () => {
    const d = Object.fromEntries(new FormData(form).entries());
    for (const f of fields) if (f.type === 'checkbox') d[f.name] = f.checked;
    return d;
  };
  const show = (errors) => {
    for (const f of fields) {
      const key = f.name, msg = errors[key] || (['email', 'phone'].includes(key) && errors.contact) || '';
      const slot = form.querySelector(`[data-err="${key}"]`);
      f.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (slot) { slot.textContent = msg; }
    }
    const first = fields.find((f) => f.getAttribute('aria-invalid') === 'true');
    first?.focus();
  };
  fields.forEach((f) => f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') { f.setAttribute('aria-invalid', 'false'); const s = form.querySelector(`[data-err="${f.name}"]`); if (s) s.textContent = ''; } }));

  const say = (msg, bad) => { status.textContent = msg; status.dataset.state = bad ? 'error' : 'info'; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ch.endpoint) return;
    const r = validate(read());
    show(r.errors); if (!r.ok) { say('Please check the highlighted fields.', true); return; }
    form.setAttribute('aria-busy', 'true'); submit.disabled = true; submit.dataset.label ??= submit.textContent; submit.textContent = 'Sending…'; say('Sending…');
    const res = await submitForm(kind, r.values, { honeypot: form.elements.company?.value });
    form.removeAttribute('aria-busy'); submit.disabled = false; submit.textContent = submit.dataset.label;
    if (res.ok) { form.hidden = true; done.hidden = false; done.focus(); form.reset(); onReady?.(); say(''); }
    else say(FAIL[res.reason] || 'Something went wrong. Please try again.', true);
  });

  wa?.addEventListener('click', () => {
    const r = validate(read());
    show(r.errors); if (!r.ok) { say('Please check the highlighted fields.', true); return; }
    const url = whatsappUrl(summary(r.values));
    if (url) { say('Opening WhatsApp. Your message is ready to send there.'); window.open(url, '_blank', 'noopener'); }
  });
  done?.querySelector('[data-again]')?.addEventListener('click', () => { done.hidden = true; form.hidden = false; form.querySelector('[name]')?.focus(); });
  onReady?.();
}
