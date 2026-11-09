// Pure camera-shot data and maths for the vehicle rooms (no three.js, no DOM): unit-tested in test/stage3.test.mjs.
// Shots are in the car's LOCAL frame (+Z nose, +X left). Every shot keeps the camera outside the car's box.

/** Interpolate two local positions on a cylinder around the car's vertical axis, so the camera arcs AROUND the car
 *  instead of cutting through it. Angle takes the short way round. */
export function cylLerp(a, b, k) {
  const ra = Math.hypot(a[0], a[2]), rb = Math.hypot(b[0], b[2]);
  const aa = Math.atan2(a[0], a[2]);
  let d = Math.atan2(b[0], b[2]) - aa;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const ang = aa + d * k, r = ra + (rb - ra) * k;
  return [Math.sin(ang) * r, a[1] + (b[1] - a[1]) * k, Math.cos(ang) * r];
}

export const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const ROOM_SHOTS = {
  bmw: {
    orbit: { target: [0, 0.6, 0.1], min: 2.2, max: 9.5 },
    views: {
      front:   { label: 'Front',    pos: [3.6, 1.15, 5.9],  look: [0, 0.62, 0.4],        fov: 32 },
      profile: { label: 'Profile',  pos: [6.6, 0.8, 0.1],   look: [0, 0.65, 0],          fov: 30 },
      rear:    { label: 'Rear',     pos: [-3.8, 1.2, -6.0], look: [0, 0.65, -0.2],       fov: 32 },
      wheel:   { label: 'Wheel',    pos: [3.3, 0.55, 3.9],  look: [0.84, 0.37, 1.6],     fov: 28 },
      lamp:    { label: 'Headlamp', pos: [2.2, 0.9, 4.1],   look: [0.69, 0.74, 2.13],    fov: 28 },
      grille:  { label: 'Grille',   pos: [0.7, 0.72, 4.3],  look: [0, 0.68, 2.3],        fov: 28 },
    },
  },
  ferrari: {
    orbit: { target: [0, 0.5, 0], min: 2.0, max: 8 },
    chapters: [
      { id: 'nose',     name: 'The nose',      pos: [1.3, 0.55, 4.2],   look: [0, 0.45, 2.0],       fov: 28 },
      { id: 'lamp',     name: 'The lamp',      pos: [1.6, 0.7, 3.1],    look: [0.77, 0.58, 1.55],   fov: 26 },
      { id: 'flank',    name: 'The flank',     pos: [3.2, 0.6, 1.8],    look: [0.9, 0.55, -0.4],    fov: 28 },
      { id: 'shoulder', name: 'The shoulder',  pos: [2.4, 0.95, -1.2],  look: [0.7, 0.7, 0.8],      fov: 28 },
      { id: 'wheel',    name: 'The wheel',     pos: [2.0, 0.45, -0.2],  look: [0.79, 0.33, -1.42],  fov: 30 },
      { id: 'tail',     name: 'The tail',      pos: [-1.4, 0.9, -4.6],  look: [0, 0.6, -2.0],       fov: 28 },
      { id: 'crown',    name: 'The crown',     pos: [-3.4, 2.1, -3.8],  look: [0, 0.5, 0],          fov: 34 },
    ],
  },
  maybach: {
    orbit: { target: [0, 0.7, 0], min: 3, max: 11 },
    stations: [
      { id: 'arrival', name: 'Arrival',  pos: [4.6, 1.3, 7.2],   look: [0, 0.7, 0.3],     fov: 30 },
      { id: 'face',    name: 'The face', pos: [0.9, 0.8, 5.3],   look: [0, 0.65, 2.7],    fov: 26 },
      { id: 'line',    name: 'The line', pos: [5.6, 0.95, 0.6],  look: [0, 0.75, 0.2],    fov: 28 },
      { id: 'rear',    name: 'The rear', pos: [-2.6, 1.1, -6.0], look: [0, 0.85, -2.6],   fov: 28 },
      { id: 'study',   name: 'The study', pos: [4.2, 2.4, 3.6], look: [0, 0.7, 0],       fov: 32 },
    ],
  },
};

export function allShots(carId) {
  const r = ROOM_SHOTS[carId];
  return [...Object.values(r.views || {}), ...(r.chapters || []), ...(r.stations || [])];
}
