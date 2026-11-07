// The section registry. Order here = order on the page = order along the camera rail.
// The menu, the rail, the scroll lengths and the tests all read SECTIONS. A section with `enabled() === false`
// (e.g. Results while no before/after photos are configured) is left out of all of them and its markup is hidden.
import hero from './hero.js';
import philosophy from './philosophy.js';
import services from './services.js';
import results from './results.js';
import booking from './booking.js';
import contact from './contact.js';

export const ALL_SECTIONS = [hero, philosophy, services, results, booking, contact];
export const SECTIONS = ALL_SECTIONS.filter((s) => !s.enabled || s.enabled());
