// Section 07 - Contact: message form, WhatsApp, and whichever contact details the studio has supplied.
import { BUSINESS } from '../../business.config.js';
import { bindForm } from '../formUI.js';
import { validateContact, whatsappUrl, channels } from '../forms.js';

export default {
  id: 'contact',
  label: 'Contact',
  scrollVh: 1.4,

  cam({ profile }) {
    const sh = profile === 'mobile' ? [0, 0] : [-0.2, 0];
    return [
      { u: 0.0, pos: [8.5, 1.1, 11.5], look: [3.5, 0.7, 1.0], fov: 32, shift: sh },
      { u: 1.0, pos: [1.5, 1.4, 14.5], look: [0, 0.65, 0.4], fov: 34, shift: sh },
    ];
  },

  init({ el }) {
    bindForm(el.querySelector('form'), { kind: 'contact', validate: validateContact, summary: (v) => v.message });
    const ch = channels(), rows = [];
    if (ch.whatsapp) rows.push(`<li><a class="btn-line" href="${whatsappUrl('Hello MANSION, ')}" target="_blank" rel="noopener">Message on WhatsApp</a></li>`);
    if (BUSINESS.email) rows.push(`<li><a href="mailto:${BUSINESS.email}">${BUSINESS.email}</a></li>`);
    if (BUSINESS.phone) rows.push(`<li><a href="tel:${BUSINESS.phone.replace(/[^+\d]/g, '')}">${BUSINESS.phone}</a></li>`);
    if (BUSINESS.address) rows.push(`<li>${BUSINESS.address}</li>`);
    if (BUSINESS.hours) rows.push(`<li>${BUSINESS.hours}</li>`);
    const list = el.querySelector('.contact__direct');
    if (rows.length) list.innerHTML = rows.join(''); else list.hidden = true;
  },
};
