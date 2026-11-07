// ============================================================================================
// MANSION - business configuration. THE ONLY FILE THAT NEEDS REAL-WORLD FACTS.
//
// Nothing here is invented. Every empty value ('' / []) means "not provided yet": the site then
// hides that feature or says plainly that it is not connected. Fill these in and rebuild.
// ============================================================================================

export const BUSINESS = {
  /** Public URL of the deployed site (used for canonical / Open Graph). e.g. 'https://mansion.example' */
  siteUrl: '',

  /** WhatsApp number in international format, digits only, e.g. '995555123456'. Enables the WhatsApp buttons. */
  whatsapp: '',

  /** Optional contact details. Shown in the contact section and footer only when set. */
  email: '',
  phone: '',          // display form, e.g. '+995 555 12 34 56'
  address: '',        // free text, shown as-is
  hours: '',          // free text, shown as-is, e.g. 'Mon-Sat 10:00-19:00'

  /** Social profiles (full https:// URLs). Only non-empty ones are rendered. */
  social: { instagram: '', facebook: '', tiktok: '', youtube: '' },

  /**
   * Where booking requests and messages are POSTed (JSON). Any service that accepts a JSON POST works:
   * Formspree (https://formspree.io/f/xxxx), Web3Forms, a Make/Zapier/n8n webhook, or your own endpoint
   * (see docs/FUNCTIONALITY.md for the payload). Leave '' until one exists - the forms will then say
   * so honestly instead of pretending to send.
   */
  formEndpoint: '',
};

/**
 * Before / after pairs for the results slider. Real photographs of real work only.
 * Put the files in public/results/ and list them here; the section stays hidden while this is empty.
 *   { before: 'results/bonnet-before.jpg', after: 'results/bonnet-after.jpg',
 *     title: 'Paint correction, bonnet', note: 'Optional one-line description', width: 1600, height: 1000 }
 */
export const BEFORE_AFTER = [];

/** Services. Descriptions are generic explanations of the work (DRAFT COPY: client to approve / replace). No prices or durations. */
export const SERVICES = [
  {
    id: 'paint-correction',
    car: 'bmw',
    name: 'Paint Correction',
    kicker: 'Exterior',
    lead: 'Swirls, holograms and fine scratches are removed by levelling a minimal layer of clear coat, so the paint reflects cleanly again.',
    steps: ['Wash and chemical decontamination', 'Paint inspection under dedicated lighting', 'Machine polishing, staged to the paint', 'Panel wipe-down and final inspection'],
    note: 'Depth of correction depends on the paint and its history; it is judged on the car, not promised in advance.',
  },
  {
    id: 'ceramic-ppf',
    car: 'ferrari',
    name: 'Ceramic Coating & Protection',
    kicker: 'Coating and film',
    lead: 'A ceramic coating adds a hard, slick, water-shedding layer over corrected paint. Paint protection film adds a physical barrier against stone chips and abrasion on the panels that take the hits.',
    steps: ['Paint prepared and corrected first', 'Coating or film chosen for the car and how it is used', 'Controlled application and curing', 'Aftercare guidance'],
    note: 'Which product and which panels is a conversation about the car, not a catalogue choice.',
  },
  {
    id: 'interior-care',
    car: 'maybach',
    name: 'Interior & Care',
    kicker: 'Interior and maintenance',
    lead: 'Leather, fabric, trim and glass cleaned and conditioned with materials matched to what they are made of, and maintenance visits to keep a finished car finished.',
    steps: ['Dry and wet extraction as the material allows', 'Leather cleaning and conditioning', 'Trim, glass and detail work', 'Maintenance schedule if wanted'],
    note: 'Materials are identified before anything is applied to them.',
  },
];

/** Preview finishes for the 3D paint selector (a visual preview of the model only, not a paint offering). */
export const FINISHES = [
  { id: 'onyx',     name: 'Onyx',     hex: 0x0b0c10 },
  { id: 'graphite', name: 'Graphite', hex: 0x3a3d44 },
  { id: 'silver',   name: 'Silver',   hex: 0xa7abb3 },
  { id: 'crimson',  name: 'Crimson',  hex: 0xb10d14 },
  { id: 'pearl',    name: 'Pearl',    hex: 0xd9d6cf },
];

/** Time-of-day preference offered on the booking form (a preference, not a promise of availability). */
export const TIME_PREFS = ['No preference', 'Morning', 'Afternoon', 'Evening'];
