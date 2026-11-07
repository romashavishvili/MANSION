// Section 06 - Booking request. A real request form (see forms.js / business.config.js for how it is delivered).
import { SERVICES, TIME_PREFS } from '../../business.config.js';
import { bindForm } from '../formUI.js';
import { validateBooking, bookingSummary } from '../forms.js';

export default {
  id: 'booking',
  label: 'Book',
  scrollVh: 1.6,

  cam({ W, profile }) {
    const sh = profile === 'mobile' ? [0, 0] : [0.2, 0];
    return [
      { u: 0.0, pos: W('maybach', [4.4, 0.8, 5.2]), look: W('maybach', [0, 0.8, 0.6]), fov: 30, shift: sh },
      { u: 0.97, pos: [8.5, 1.1, 11.5], look: [3.5, 0.7, 1.0], fov: 32, shift: sh },
    ];
  },

  init({ el, site }) {
    const form = el.querySelector('form');
    form.elements.service.innerHTML = '<option value="">Choose a service</option>' + SERVICES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    form.elements.time.innerHTML = TIME_PREFS.map((t) => `<option>${t}</option>`).join('');
    const d = new Date(); form.elements.date.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    bindForm(form, { kind: 'booking', validate: (v) => validateBooking(v), summary: bookingSummary });
    // "Request this service" buttons in the services chapters preselect the service, then scroll here
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('[data-book]'); if (!a) return;
      e.preventDefault(); form.elements.service.value = a.dataset.book; site.goTo('booking');
    });
  },
};
