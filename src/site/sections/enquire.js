import { CONTACT } from '../../config.js';
import { validate, buildEnquiry, channels, SERVICES } from '../enquiry.js';

// Section 06 - Enquire. The last frame: all three cars, the form on the right. No business facts are invented:
// with no contact channel configured (config.js CONTACT) the form prepares the message to copy and says exactly that.
export default {
  id: 'enquire',
  label: 'Enquire',
  scrollVh: 2.2,

  cam({ W, profile }) {
    const sh0 = profile === 'mobile' ? [0, -0.22] : [0.2, 0];
    const sh1 = profile === 'mobile' ? [0, -0.28] : [-0.2, 0];
    return [
      { u: 0.0, pos: W('maybach', [3.6, 1.2, 6.4]), look: W('maybach', [0, 0.65, 0.3]), fov: 33, shift: sh0 },       // = the Maybach station
      { u: 1.0, pos: [0, 2.1, 16.5], look: [0, 0.7, 0.2], fov: 34, shift: sh1 },
    ];
  },

  prepare({ gsap, el }) { gsap.set(el.querySelectorAll('.enq__kicker, .enq__h, .enq__form'), { autoAlpha: 0, y: 16 }); },

  init({ gsap, el, site }) {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, scrollTrigger: { trigger: el, start: 'top 40%', end: 'center center', scrub: 0.4 } });
    tl.to(el.querySelectorAll('.enq__kicker, .enq__h'), { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1 }, 0)
      .to(el.querySelector('.enq__form'), { autoAlpha: 1, y: 0, duration: 0.5 }, 0.2);

    const form = el.querySelector('form'), sel = form.elements.service, out = el.querySelector('.enq__out');
    sel.innerHTML = SERVICES.map((s) => `<option>${s}</option>`).join('');
    site.setEnquiryService = (name) => { const o = [...sel.options].find((x) => x.value === name); if (o) sel.value = name; };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const errors = validate(data);
      for (const f of ['name', 'contact', 'vehicle']) {
        const input = form.elements[f], msg = form.querySelector(`[data-err=${f}]`);
        msg.textContent = errors[f] || ''; input.setAttribute('aria-invalid', String(!!errors[f]));
      }
      const bad = Object.keys(errors)[0];
      if (bad) { form.elements[bad].focus(); out.hidden = true; return; }
      const text = buildEnquiry(data), ch = channels(CONTACT, text);
      out.hidden = false;
      const links = [];
      if (ch.email) links.push(`<a class="btn" href="${ch.email}">Open in email</a>`);
      if (ch.whatsapp) links.push(`<a class="btn" href="${ch.whatsapp}" target="_blank" rel="noopener">Open in WhatsApp</a>`);
      if (ch.phone) links.push(`<a class="btn" href="${ch.phone}">Call</a>`);
      out.innerHTML = `
        <p class="enq__state">${links.length ? 'Your enquiry is ready. Nothing has been sent yet: choose how to send it.' : 'Your enquiry is ready. Nothing has been sent: this site has no contact channel connected yet, so copy the text below and send it to the studio yourself.'}</p>
        <pre class="enq__text" tabindex="0"></pre>
        <div class="enq__actions">${links.join('')}<button type="button" class="btn" data-copy>Copy text</button></div>`;
      out.querySelector('pre').textContent = text;
      out.querySelector('[data-copy]').addEventListener('click', async (ev) => {
        try { await navigator.clipboard.writeText(text); ev.target.textContent = 'Copied'; } catch { ev.target.textContent = 'Select the text and copy it'; }
      });
    });
  },
};
