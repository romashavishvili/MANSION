// Central configuration for Stage 1. Everything tunable lives here (layout, light identities,
// materials, timings). Stage 2 will extend this with per-car environments and scroll chapters.

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
export const asset = (p) => `${BASE}${p}`.replace(/\/{2,}/g, '/');

/** The brand. Single source for the wordmark, descriptor and document title. */
export const BRAND = {
  name: 'MANSION',
  descriptor: 'LUXURY AUTOMOTIVE DETAILING',
  documentTitle: 'MANSION \u2014 Luxury Automotive Detailing',
};

/** World layout. Cars face +Z (toward the opening camera); yaw turns the nose toward +X. */
export const LAYOUT = {
  bmw:     { x: -6.8, z: -0.6, yaw: 0.50 },
  ferrari: { x:  0.0, z:  2.4, yaw: 0.0 },
  maybach: { x:  7.0, z: -0.6, yaw: -0.50 },
};

export const CAR_ORDER = ['bmw', 'ferrari', 'maybach'];

export const CARS = {
  bmw: {
    id: 'bmw',
    number: '01',
    name: 'BMW M5',
    tagline: 'POWER',
    caption: { number: 'I', name: 'Paint Correction', tagline: 'Exterior' },   // what the viewer sees: the service, not the marque
    file: 'models/bmw_m5_2025.glb',
    meta: 'models/bmw.meta.json',
    bytes: 8245640,
    // Headlights: real SpotLights + a volumetric beam + lens flare, per lamp.
    lamp: {
      color: 0xdfe8ff,          // crisp cool-white LED
      intensity: 620,           // candela per lamp at full ignition
      angle: 0.38, penumbra: 0.9, distance: 34,
      // volumetric beam (see cars/beamShader.js): wide = soft body, core = hot centre (tan of 1/e half-widths)
      beam: { wide: 0.07, core: 0.024, coreAmt: 1.8, length: 15, g: 0.45, strength: 0.55, maxPath: 9, noise: 0.5 },
      flare: { size: 0.55, hdr: 5.0 },
      pitch: 0.07, toeIn: 0.025,
    },
    // Identity lighting (rim/accent) that reveals the body while the headlights are the "hero" light
    accent: { color: 0xff1f2a, intensity: 420, position: [-3.8, 4.6, -3.2], target: [0, 0.7, 0.4] },
    env: 'bmw',
    // Emissive "lamp" materials (matched by substring of material name)
    // The lamp's own texture atlas (LED module, projector lenses, reflector facets) becomes the emissive
    // map, so the real lamp interior lights up; front = white, rear = red tail-light interior.
    lampMap: { match: 'LightA_Material1', color: 0xe8eeff, strength: 2.6, rearTint: [1.0, 0.06, 0.04] },
    headlightMaterials: [
      { match: 'purple', exact: false, color: 0xeaf1ff, strength: 7 },       // DRL line inside the lens
      { match: 'gold',   exact: true,  color: 0xffe6c4, strength: 2.4 },     // illuminated kidney-grille outline ("Iconic Glow")
    ],
    taillightMaterials: [
      { match: 'Light_emis', color: 0xff1a1a, strength: 0.9 },
    ],
    paint: [
      // The file ships green paint; Stage 1 identity = deep black-sapphire with strong clear-coat.
      { match: 'Paint_Material1', color: 0x0b0c10, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.07 },
      // textured full-body shell (bumpers, mirror caps...): tint so it follows the new paint
      { match: 'Coloured_Material1', tintOnly: true, bodyMask: true, color: 0x14151a, bodyColor: 0x0b0c10 },
    ],
    envBoost: 1.0,
  },

  ferrari: {
    id: 'ferrari',
    number: '02',
    name: 'Ferrari LaFerrari',
    tagline: 'PERFORMANCE',
    caption: { number: 'II', name: 'Ceramic & Protection', tagline: 'Coating \u00b7 PPF' },
    wheels: { pattern: '^tire[ _]\\d$' },   // the four separate wheel groups (see tools/audit_models.py); BMW/Maybach have none
    file: 'models/ferrari_laferrari.glb',
    meta: 'models/ferrari.meta.json',
    bytes: 13411488,
    lamp: {
      color: 0xf2f4ff,
      intensity: 600,
      angle: 0.34, penumbra: 0.9, distance: 32,
      beam: { wide: 0.06, core: 0.022, coreAmt: 1.9, length: 11, g: 0.5, strength: 0.55, maxPath: 8, noise: 0.5 },
      flare: { size: 0.5, hdr: 5.5 },
      pitch: 0.05, toeIn: 0.02,
    },
    accent: { color: 0xc4121a, intensity: 380, position: [3.6, 4.2, -2.4], target: [0, 0.5, 0.2] },
    env: 'ferrari',
    headlightMaterials: [
      { match: 'Front_headlights.001', exact: true, color: 0xffffff, strength: 6 },
    ],
    taillightMaterials: [
      { match: 'tail_lights', exact: true, color: 0xff1010, strength: 1.6 },
      { match: 'red_light',   exact: true, color: 0xff1010, strength: 1.6 },
    ],
    // These two large rear-deck materials ship with an always-on WHITE emissive in the source file
    // (they used to show up as a glowing block above the car) - switch them off.
    killEmissive: [
      { match: 'break_lights.001', exact: true },
      { match: 'break_lights_glasses', exact: true },
    ],
    paint: [
      // The file's body material is rough-metal (glTF default metallic = 1). Re-tuned as red clear-coat.
      { match: 'Body', exact: true, lab: true, color: 0xb10d14, metalness: 0.62, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.07 },
    ],
    envBoost: 1.1,
  },

  maybach: {
    id: 'maybach',
    number: '03',
    name: 'Mercedes-Maybach',
    tagline: 'LUXURY',
    caption: { number: 'III', name: 'Interior & Care', tagline: 'Atelier' },
    file: 'models/mercedes_maybach_2022.glb',
    meta: 'models/maybach.meta.json',
    bytes: 40231960,
    lamp: {
      color: 0xffd9a6,          // warm champagne (~3200 K)
      intensity: 520,
      angle: 0.34, penumbra: 0.95, distance: 36,
      beam: { wide: 0.075, core: 0.026, coreAmt: 1.5, length: 14, g: 0.4, strength: 0.5, maxPath: 9, noise: 0.45 },
      flare: { size: 0.5, hdr: 4.2 },
      pitch: 0.06, toeIn: 0.02,
    },
    accent: { color: 0xffb870, intensity: 360, position: [3.4, 5.2, -3.6], target: [0, 0.8, 0.4] },
    env: 'maybach',
    headlightMaterials: [
      { match: 'Car_Paint.001', color: 0xfff1d6, strength: 5 },
    ],
    taillightMaterials: [
      { match: 'Material.001', color: 0xff1a1a, strength: 1.2 },
    ],
    paint: [
      { match: 'Car_Paint_With_Flakes', color: 0x050507, metalness: 0.4, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 },
    ],
    envBoost: 1.0,
  },
};

/** Renderer quality tiers (auto-selected; override with ?quality=low|medium|high). */
export const TIERS = {
  // dpr = max device-pixel-ratio, maxPixels = total render-pixel budget (keeps 4K / Retina screens affordable)
  high:   { dpr: 1.5, maxPixels: 3.6e6, msaa: 2, reflection: 0.6, bloom: true,  particles: 2600, grain: true, beamSteps: 22 },
  medium: { dpr: 1.25, maxPixels: 2.4e6, msaa: 2, reflection: 0.4, bloom: true,  particles: 1400, grain: true, beamSteps: 16 },
  low:    { dpr: 1.0, maxPixels: 1.5e6, msaa: 0, reflection: 0.0, bloom: false, particles: 600,  grain: false, beamSteps: 10 },
};

export const FOG = { color: 0x040508, density: 0.021 };
export const EXPOSURE = 1.0;

/**
 * Where the studio can be reached. EMPTY ON PURPOSE: no business details were supplied, and none are invented.
 * Fill any of these in and the enquiry form will offer that channel; with all empty it only prepares the text
 * for the visitor to copy (and says so). whatsapp = international number, digits only. email = address.
 */
export const CONTACT = { email: '', whatsapp: '', phone: '', instagram: '' };

/**
 * Measured anchor points, car-local metres (+Z nose, +X left). Measured from the GLBs with tools in the project
 * history (per-mesh bounding boxes; the BMW's fused wheel mesh was clustered per wheel). Used for camera targets
 * and hotspots; nothing here is guessed from a spec sheet.
 */
export const ANCHORS = {
  bmw:     { lamp: [0.69, 0.74, 2.13], wheel: [0.84, 0.369, 1.604], wheelR: 0.37, rearWheel: [0.825, 0.373, -1.403], grille: [0, 0.68, 2.3] },
  ferrari: { lamp: [0.769, 0.584, 1.483], wheel: [0.794, 0.316, 1.097], wheelR: 0.313, rearWheel: [0.787, 0.333, -1.418] },
  maybach: { face: [0, 0.62, 2.67], rear: [0, 0.88, -2.5] },
};
