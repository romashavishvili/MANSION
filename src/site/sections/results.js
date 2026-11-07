// Section 05 - Results: before / after photographs. Hidden entirely until real photos are listed in
// business.config.js (BEFORE_AFTER); no stock images or invented results are ever shown.
import { BEFORE_AFTER } from '../../business.config.js';
import { buildCompare } from '../compare.js';

export default {
  id: 'results',
  label: 'Results',
  scrollVh: 1.4,
  enabled: () => BEFORE_AFTER.length > 0,

  cam({ W }) {
    return [
      { u: 0.0, pos: W('maybach', [4.4, 0.8, 5.2]), look: W('maybach', [0, 0.8, 0.6]), fov: 30, shift: [0, 0] },
      { u: 0.97, pos: W('maybach', [4.4, 0.8, 5.2]), look: W('maybach', [0, 0.8, 0.6]), fov: 30, shift: [0, 0] },   // a hold: this section is mostly photographs
    ];
  },
  init({ el }) {
    const list = el.querySelector('.results__list');
    BEFORE_AFTER.forEach((item, i) => list.appendChild(buildCompare(item, i)));
  },
};
