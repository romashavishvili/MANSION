import * as THREE from 'three';
import { BEAM_VERT, BEAM_FRAG } from './beamShader.js';

// One headlight = three real parts, all driven by a single 0..1 "level":
//   1. THREE.SpotLight    - actual illumination: floor pool, spill on paint and neighbouring cars
//   2. Volumetric beam    - analytic single-scattering shader (see beamShader.js): soft, tapering,
//                           forward-scattering glare when you look into the lamp
//   3. Lens flare         - a small, hot core that fades when the lamp points away from the camera
// The emissive lamp materials on the model itself are driven by Car (they need the loaded model).

/** Tight hot flare: a pin-point core, a small inner glow and a faint halo. No streak, no gray disc. */
let _flareTex = null;
function flareTexture() {
  if (_flareTex) return _flareTex;
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const r = Math.hypot(x - s / 2 + 0.5, y - s / 2 + 0.5) / (s / 2);
    const core = Math.exp(-Math.pow(r / 0.075, 2));
    const inner = 0.42 * Math.exp(-r / 0.15);
    const halo = 0.05 * Math.exp(-r / 0.42);
    const v = Math.min(1, (core + inner + halo) * (1 - sm(0.72, 1.0, r)));
    const i = (y * s + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(v * 255);
  }
  g.putImageData(img, 0, 0);
  _flareTex = new THREE.CanvasTexture(c);
  _flareTex.colorSpace = THREE.SRGBColorSpace;
  return _flareTex;
}

export class Headlight {
  /**
   * @param {THREE.Object3D} parent  car pivot (car local frame: +Z = nose)
   * @param {number[]} lens          lens front-face position in car local space
   * @param {object} cfg             config.lamp
   * @param {number} side            +1 / -1 (sign of local x)
   * @param {number} steps           ray-march steps for the beam (quality tier)
   */
  constructor(parent, lens, cfg, side, steps = 18) {
    this.cfg = cfg;
    this.level = 0;
    this.gain = 1;                 // live-tuning multipliers (debug panel)
    this.beamGain = 1;
    this.color = new THREE.Color(cfg.color);
    this.baseToe = -side * cfg.toeIn;
    const bm = cfg.beam;

    this.anchor = new THREE.Group();
    this.anchor.position.set(lens[0], lens[1], lens[2]);
    this.anchor.rotation.set(cfg.pitch, this.baseToe, 0, 'YXZ');   // Ry(toe) * Rx(pitch): +pitch tilts the beam DOWN
    parent.add(this.anchor);

    // 1. real light
    this.spot = new THREE.SpotLight(cfg.color, 0, cfg.distance, cfg.angle, cfg.penumbra, 2);
    this.spot.castShadow = false;
    this.spot.target.position.set(0, 0, 20);      // in anchor space -> follows the rotation
    this.anchor.add(this.spot, this.spot.target);

    // 2. volumetric beam. The mesh is only a bounding cone (apex pulled back by d0 so it always
    //    contains the gaussian beam); the look comes from the fragment shader.
    const tanB = 2.7 * bm.wide;
    const d0 = 0.035 / bm.wide;
    const L = bm.length;
    const H = L + d0, Rb = tanB * H;
    const geo = new THREE.CylinderGeometry(0, Rb, H, 32, 12, false);
    geo.translate(0, -H / 2, 0);
    geo.rotateX(-Math.PI / 2);                     // apex at the origin, opens toward +Z
    geo.translate(0, 0, -d0);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uApex: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 0, 1) },
        uColor: { value: this.color.clone() },
        uLen: { value: L }, uCos2: { value: 1 / (1 + tanB * tanB) }, uTanB: { value: tanB }, uD0: { value: d0 },
        uWideW: { value: bm.wide }, uCoreW: { value: bm.core }, uCoreAmt: { value: bm.coreAmt },
        uIntensity: { value: 0 }, uG: { value: bm.g }, uFloorY: { value: 0 },
        uMaxPath: { value: bm.maxPath }, uNoise: { value: bm.noise }, uTime: { value: 0 }, uSteps: { value: steps },
      },
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.BackSide,          // exactly one shaded fragment per covered pixel, even with the camera inside
      fog: false,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.beam.renderOrder = 3;
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    this.anchor.add(this.beam);

    // 3. lens flare
    this.flareMat = new THREE.SpriteMaterial({
      map: flareTexture(), color: this.color.clone(), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0, fog: false,
    });
    this.flare = new THREE.Sprite(this.flareMat);
    this.flare.position.set(0, 0, 0.05);
    this.flare.scale.setScalar(0.001);
    this.flare.renderOrder = 5;
    this.flare.visible = false;
    this.anchor.add(this.flare);

    this._pos = new THREE.Vector3();
    this._dir = new THREE.Vector3(0, 0, 1);
    this._tmp = new THREE.Vector3();
    this._facing = 1;
  }

  setLevel(l) {
    this.level = l;
    const c = this.cfg;
    this.spot.intensity = c.intensity * Math.pow(l, 1.4) * this.gain;
    this.beam.visible = l > 0.002;
    this.beamMat.uniforms.uIntensity.value = c.beam.strength * Math.pow(l, 1.25) * this.gain * this.beamGain;
    this.flare.visible = l > 0.002;
    this._applyFlare();
  }

  _applyFlare() {
    // A real lamp only dazzles when you look into it: strong head-on, a small pin-point from the side.
    const f = 0.10 + 0.90 * Math.pow(Math.max(this._facing, 0), 3);
    const l = this.level;
    this.flareMat.color.copy(this.color).multiplyScalar(this.cfg.flare.hdr);
    this.flareMat.opacity = Math.min(1, l * 5) * (0.55 + 0.45 * f);
    this.flare.scale.setScalar(this.cfg.flare.size * (0.35 + 0.65 * Math.pow(l, 0.7)) * (0.45 + 1.0 * f));
  }

  /** Slow outward sway used in the finale ("light sweep"), radians. */
  setSway(yaw) { this.anchor.rotation.y = this.baseToe + yaw; }

  update(time, camera) {
    this.anchor.updateWorldMatrix(true, false);
    this._pos.setFromMatrixPosition(this.anchor.matrixWorld);
    this._dir.set(0, 0, 1).transformDirection(this.anchor.matrixWorld);
    const u = this.beamMat.uniforms;
    u.uApex.value.copy(this._pos);
    u.uAxis.value.copy(this._dir);
    u.uTime.value = time;
    this._tmp.copy(camera.position).sub(this._pos);
    const d = this._tmp.length();
    this._facing = d > 1e-3 ? this._dir.dot(this._tmp) / d : 1;
    if (this.flare.visible) this._applyFlare();
  }

  /** World-space beam description for the dust shader (valid after update()). */
  getBeamState(out) {
    out.pos = this._pos; out.dir = this._dir; out.color = this.color; out.level = this.level;
    return out;
  }

  dispose() {
    this.beam.geometry.dispose(); this.beamMat.dispose(); this.flareMat.dispose();
  }
}
