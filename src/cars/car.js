import * as THREE from 'three';
import { Headlight } from './headlight.js';
import { WheelRig } from './wheels.js';
import { patchLab } from './labShader.js';
import { LAYOUT } from '../config.js';

const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'clearcoatMap'];

function contactShadowTexture() {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s / 2);
  rg.addColorStop(0, 'rgba(0,0,0,0.95)');
  rg.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A car in the scene: pivot group (pose from LAYOUT) containing
 *   - the real glTF model (added after it has loaded)
 *   - two headlights (SpotLight + beam + flare) - created immediately, from the meta manifest
 *   - one identity accent light (rim light that carries the car's colour)
 *   - a soft contact shadow under the car
 * All lights exist from the start (even before the model loads) so the number of scene lights - and
 * therefore the compiled shader programs - never changes at runtime.
 */
export class Car {
  constructor(cfg, meta, envTexture, maxAnisotropy = 8, beamSteps = 18) {
    this.cfg = cfg;
    this.meta = meta;
    this.env = envTexture;
    this.anisotropy = maxAnisotropy;
    this.pose = LAYOUT[cfg.id];
    this.ready = false;
    this.reveal = 0;
    this.lampAvg = 0;
    this.lightGain = 1;    // live-tuning multipliers (debug panel)
    this.envGain = 1;
    this.lampGlow = 1;

    this.pivot = new THREE.Group();
    this.pivot.name = `car-${cfg.id}`;
    this.pivot.position.set(this.pose.x, 0, this.pose.z);
    this.pivot.rotation.y = this.pose.yaw;

    // Lamps sit on the FRONT face of the lens assembly (max z of the headlight geometry), not its
    // centre - the centre is inside the opaque housing and would hide the flare and beam apex.
    const front = (h) => [h.center[0], h.center[1], h.max[2] + 0.02];
    this.lamps = {
      L: new Headlight(this.pivot, front(meta.headlights.px), cfg.lamp, +1, beamSteps),   // +X = the car's left
      R: new Headlight(this.pivot, front(meta.headlights.nx), cfg.lamp, -1, beamSteps),
    };

    // identity accent light
    const a = cfg.accent;
    this.accent = new THREE.SpotLight(a.color, 0, 42, 0.85, 1.0, 2);
    this.accent.position.set(...a.position);
    this.accent.target.position.set(...a.target);
    this.pivot.add(this.accent, this.accent.target);

    // soft contact shadow (between the base floor at -0.01 and the mirror plane at 0)
    const sx = meta.size[0] * 1.55, sz = meta.size[2] * 1.22;
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.9, fog: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, -0.004, 0);
    this.shadow.renderOrder = 1;
    this.pivot.add(this.shadow);

    this.model = null;
    this.wheels = null;    // WheelRig, only for models whose wheels are separate nodes
    this.envMats = [];     // { mat, base }
    this.headMats = [];    // { mat, strength }
    this.tailMats = [];
    this.paintMats = [];   // { mat, kind: 'physical' | 'mask' } - recolourable paint (see exhibit/paint.js)
    this.paintU = null;    // uniforms of the body-colour mask on textured shells (BMW)
    this.lab = null;       // surface-lab uniforms (Ferrari body), see cars/labShader.js
    this._beamA = {}; this._beamB = {};
  }

  /** Attach the loaded glTF scene and prepare its materials. */
  setModel(root) {
    this.model = root;
    this.pivot.updateMatrixWorld(true);
    this._invPivot = new THREE.Matrix4().copy(this.pivot.matrixWorld).invert();   // world -> car-local (for lamp masks)
    this._prepareMaterials(root);
    this.pivot.add(root);
    if (this.cfg.wheels) this.wheels = new WheelRig(this, root, this.cfg.wheels.pattern);
    this.ready = true;
    this.setReveal(this.reveal);
    this.setLamps(this.lamps.L.level, this.lamps.R.level);
  }

  _applyLampMap(mat, rule) {
    mat.emissiveMap = mat.map;
    mat.emissive.set(rule.color);
    mat.emissiveIntensity = 0;
    const inv = this._invPivot, rear = new THREE.Vector3(...rule.rearTint);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uBtmInv = { value: inv };
      shader.uniforms.uBtmRear = { value: rear };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uBtmInv;\nvarying float vBtmZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvBtmZ = (uBtmInv * modelMatrix * vec4(transformed, 1.0)).z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uBtmRear;\nvarying float vBtmZ;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  float btmF = smoothstep(1.2, 1.6, vBtmZ);\n  float btmR = 1.0 - smoothstep(-1.6, -1.2, vBtmZ);\n  totalEmissiveRadiance *= vec3(btmF) + btmR * uBtmRear;');
    };
    mat.customProgramCacheKey = () => 'btm-lampmap';
    mat.needsUpdate = true;
    this.lampMapMat = { mat, strength: rule.strength };
  }

  /**
   * The BMW's textured shell is a 256px colour ATLAS: the large light-grey cells are the body-colour slots, the
   * rest are trim colours. Only the grey cells take the paint colour (uBody); every other texel keeps the original
   * dark grade (uOther), exactly as before. Result: the whole car recolours coherently.
   */
  _applyBodyMask(mat, rule) {
    const u = this.paintU = { uBody: { value: new THREE.Color(rule.bodyColor ?? rule.color) }, uOther: { value: new THREE.Color(rule.color) } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uBody; uniform vec3 uOther;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float body = smoothstep(0.38, 0.42, lum) * (1.0 - smoothstep(0.56, 0.60, lum)) * (1.0 - smoothstep(0.03, 0.06, sat));
    diffuseColor.rgb = mix(c * uOther, uBody, body); }`);
    };
    mat.customProgramCacheKey = () => 'btm-bodymask';
    mat.needsUpdate = true;
  }

  _matches(rule, name) { return rule.exact ? name === rule.match : name.includes(rule.match); }

  _prepareMaterials(root) {
    const cfg = this.cfg;
    const swaps = new Map();
    const tune = (m) => {
      if (swaps.has(m)) return swaps.get(m);
      let mat = m;
      const name = m.name || '';

      // 1. paint re-grade
      const rule = cfg.paint.find((p) => this._matches(p, name));
      if (rule) {
        if (rule.tintOnly) {
          if (rule.bodyMask) { mat.color.set(0xffffff); this._applyBodyMask(mat, rule); this.paintMats.push({ mat, kind: 'mask' }); }
          else mat.color.set(rule.color);
        } else {
          mat = new THREE.MeshPhysicalMaterial({
            name, color: rule.color, metalness: rule.metalness, roughness: rule.roughness,
            clearcoat: rule.clearcoat, clearcoatRoughness: rule.clearcoatRoughness, side: m.side,
          });
          m.dispose();
          if (rule.lab) this.lab = patchLab(mat, this._invPivot);
          this.paintMats.push({ mat, kind: 'physical' });
        }
      }

      // 2. never let a material trigger three's expensive transmission pass; keep alpha-blend glass
      if (mat.transmission > 0) { mat.transmission = 0; mat.transparent = true; mat.depthWrite = false; }
      if (mat.transparent) mat.depthWrite = false;

      // 3. explicit, per-car environment (strength animated by Car.setReveal)
      if (mat.isMeshStandardMaterial) {
        mat.envMap = this.env;
        const base = (rule && !rule.tintOnly ? 1.35 : 1.0) * cfg.envBoost;
        mat.envMapIntensity = 0;
        this.envMats.push({ mat, base });
      }

      // 4. lamp materials: kill the always-on emissive from the file, drive it with the ignition
      for (const r of cfg.headlightMaterials) if (this._matches(r, name) && mat.emissive) {
        mat.emissive.set(r.color); mat.emissiveIntensity = 0; this.headMats.push({ mat, strength: r.strength });
      }
      for (const r of cfg.taillightMaterials) if (this._matches(r, name) && mat.emissive) {
        mat.emissive.set(r.color); mat.emissiveIntensity = 0; this.tailMats.push({ mat, strength: r.strength });
      }

      // 4b. lamp-interior emission: reuse the lamp's own texture (LED module, projector lenses, reflector
      //     facets) as an emissive map, masked to the front (white) and rear (red) of the car.
      const lm = cfg.lampMap;
      if (lm && this._matches(lm, name) && mat.map && mat.emissive) this._applyLampMap(mat, lm);

      // 4c. materials whose always-on emissive from the source file must simply be switched off
      for (const k of cfg.killEmissive || []) if (this._matches(k, name) && mat.emissive) mat.emissiveIntensity = 0;

      // 5. texture quality
      for (const slot of MAP_SLOTS) if (mat[slot]) mat[slot].anisotropy = this.anisotropy;

      swaps.set(m, mat);
      return mat;
    };

    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map(tune) : tune(o.material);
    });
  }

  /** @param {number} l left lamp 0..1  @param {number} r right lamp 0..1 */
  setLamps(l, r) {
    this.lamps.L.setLevel(l);
    this.lamps.R.setLevel(r);
    this.lampAvg = (l + r) / 2;
    for (const h of this.headMats) h.mat.emissiveIntensity = h.strength * this.lampGlow * (this.lampAvg * 0.5 + Math.max(l, r) * 0.5);
    for (const t of this.tailMats) t.mat.emissiveIntensity = t.strength * this.lampAvg * 0.6;
    if (this.lampMapMat) this.lampMapMat.mat.emissiveIntensity = this.lampMapMat.strength * this.lampGlow * (this.lampAvg * 0.6 + Math.max(l, r) * 0.4);
  }

  /** 0..1: how much of the car is "revealed" (environment reflections + identity accent light). */
  setReveal(v) {
    this.reveal = v;
    const e = Math.pow(v, 1.5) * 1.15 * this.envGain;
    for (const m of this.envMats) m.mat.envMapIntensity = m.base * e;
    this.accent.intensity = this.cfg.accent.intensity * Math.pow(v, 1.6) * this.lightGain;
    this.shadow.material.opacity = 0.9 * Math.min(1, v * 2);
  }

  setGains(light, env) {
    this.lightGain = light; this.envGain = env;
    this.lamps.L.gain = light; this.lamps.R.gain = light;
  }

  setBeamGain(g) { this.lamps.L.beamGain = g; this.lamps.R.beamGain = g; }

  /** If the patched lamp shader ever fails to compile on a driver, fall back to the plain material. */
  disableLampMap() {
    if (!this.lampMapMat) return;
    const m = this.lampMapMat.mat;
    m.emissiveMap = null; m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'btm-lampmap-off';
    m.emissiveIntensity = 0; m.needsUpdate = true;
    this.lampMapMat = null;
    console.warn(`[BTM] ${this.cfg.name}: lamp-interior emission disabled (shader patch failed to compile)`);
  }

  setSway(yaw) {
    this.lamps.L.setSway(yaw);
    this.lamps.R.setSway(-yaw);
  }

  update(time, camera) { this.lamps.L.update(time, camera); this.lamps.R.update(time, camera); this.wheels?.update(time); }

  /** Appends the two world-space beams (for the dust shader). */
  collectBeams(list) {
    list.push(this.lamps.L.getBeamState(this._beamA));
    list.push(this.lamps.R.getBeamState(this._beamB));
  }

  dispose() {
    this.pivot.removeFromParent();
    this.lamps.L.dispose(); this.lamps.R.dispose();
    this.shadow.geometry.dispose(); this.shadow.material.map.dispose(); this.shadow.material.dispose();
    if (this.model) this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const k of Object.keys(m)) if (m[k] && m[k].isTexture && m[k] !== this.env) m[k].dispose();
        m.dispose();
      }
    });
  }
}
