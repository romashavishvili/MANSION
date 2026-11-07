// Footer, structured data and the sound toggle: everything here is built from what is really configured.
import { BUSINESS } from '../business.config.js';
import { SECTIONS } from './sections/index.js';
import { Ambience } from './audio.js';

const NAMES = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };

export function initChrome({ hud, goTo }) {
  const $ = (id) => document.getElementById(id);
  $('footer-year').textContent = `\u00a9 ${new Date().getFullYear()} MANSION`;
  $('footer-credits').addEventListener('click', () => hud.toggleCredits(true));

  const nav = document.querySelector('.footer__nav');
  nav.innerHTML = SECTIONS.map((s) => `<a href="#${s.id}" data-go="${s.id}">${s.label}</a>`).join('');
  nav.addEventListener('click', (e) => { const a = e.target.closest('a[data-go]'); if (a) { e.preventDefault(); goTo(a.dataset.go); } });

  const social = Object.entries(BUSINESS.social || {}).filter(([, u]) => /^https:\/\//.test(u));
  const ul = document.querySelector('.footer__social');
  if (social.length) ul.innerHTML = social.map(([k, u]) => `<li><a href="${u}" target="_blank" rel="noopener me">${NAMES[k] || k}</a></li>`).join(''); else ul.hidden = true;

  // structured data: only facts that exist
  const ld = { '@context': 'https://schema.org', '@type': 'AutomotiveBusiness', name: 'MANSION', description: 'Luxury automotive detailing: paint correction, ceramic coating, paint protection film, interior detailing and maintenance.' };
  if (BUSINESS.siteUrl) ld.url = BUSINESS.siteUrl;
  if (BUSINESS.email) ld.email = BUSINESS.email;
  if (BUSINESS.phone) ld.telephone = BUSINESS.phone;
  if (BUSINESS.address) ld.address = BUSINESS.address;
  if (social.length) ld.sameAs = social.map(([, u]) => u);
  const tag = document.createElement('script'); tag.type = 'application/ld+json'; tag.textContent = JSON.stringify(ld); document.head.appendChild(tag);
  if (BUSINESS.siteUrl) { const l = document.createElement('link'); l.rel = 'canonical'; l.href = BUSINESS.siteUrl; document.head.appendChild(l); }

  new Ambience($('sound-btn'));
}
