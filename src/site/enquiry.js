// Pure helpers for the enquiry form (no DOM): unit-tested. The form never claims a message was sent unless a real
// channel is configured AND the visitor's own app opens it; otherwise it only prepares text to copy.

export const SERVICES = ['Paint correction', 'Paint protection film (PPF)', 'Ceramic coating', 'Premium detailing', 'Surface protection', 'Not sure yet'];

export function validate(f) {
  const errors = {};
  if (!f.name?.trim()) errors.name = 'Please tell us your name.';
  const c = (f.contact || '').trim();
  const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
  const isPhone = /^\+?[\d\s().-]{7,}$/.test(c);
  if (!c) errors.contact = 'Add an email address or phone number so the studio can reply.';
  else if (!isMail && !isPhone) errors.contact = 'That does not look like an email address or phone number.';
  if (!f.vehicle?.trim()) errors.vehicle = 'Which vehicle is it?';
  return errors;
}

export function buildEnquiry(f) {
  const lines = [
    'Enquiry for MANSION',
    '',
    `Name: ${f.name.trim()}`,
    `Reply to: ${f.contact.trim()}`,
    `Vehicle: ${f.vehicle.trim()}`,
    `Service: ${f.service || 'Not sure yet'}`,
  ];
  if (f.message?.trim()) lines.push('', f.message.trim());
  return lines.join('\n');
}

/** Channels the studio has actually configured (config.js CONTACT). Empty object when none. */
export function channels(contact, text) {
  const out = {};
  const enc = encodeURIComponent;
  if (contact.email) out.email = `mailto:${contact.email}?subject=${enc('Enquiry for MANSION')}&body=${enc(text)}`;
  const wa = (contact.whatsapp || '').replace(/\D/g, '');
  if (wa) out.whatsapp = `https://wa.me/${wa}?text=${enc(text)}`;
  if (contact.phone) out.phone = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;
  return out;
}
