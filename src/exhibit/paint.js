import * as THREE from 'three';

/** Finishes expressed in the real material parameters of the car's clear-coated paint. */
export const FINISHES = {
  gloss:    { label: 'Gloss',    metalness: 0.45, roughness: 0.28, clearcoat: 1.0,  clearcoatRoughness: 0.05 },
  metallic: { label: 'Metallic', metalness: 0.92, roughness: 0.26, clearcoat: 1.0,  clearcoatRoughness: 0.06 },
  satin:    { label: 'Satin',    metalness: 0.5,  roughness: 0.5,  clearcoat: 0.35, clearcoatRoughness: 0.38 },
  matte:    { label: 'Matte',    metalness: 0.3,  roughness: 0.82, clearcoat: 0.0,  clearcoatRoughness: 0.5 },
};

/**
 * Smooth, real-time recolour / re-finish of a car's paint. Works on every paint material the Car recorded:
 * clear-coated physical materials (colour + metalness + roughness + clear-coat) and the BMW's textured shell
 * (body-colour uniform + metalness / roughness). Values ease toward their targets in update(), so a change is a
 * material transition, never a pop. A clear-coat of 0 (matte) is reachable without a shader recompile because
 * three.js only toggles the clear-coat code path at exactly 0 -> we floor it at 0.001.
 */
export class PaintController {
  constructor(car) {
    this.car = car;
    this.items = car.paintMats.map((p) => ({ ...p, goal: this._read(p) }));
    this.target = new THREE.Color();
    this.hasTarget = false;
    this.finish = null;
    this.current = this.items[0] ? this._read(this.items[0]) : null;
  }

  get supported() { return this.items.length > 0; }

  _read(p) {
    const m = p.mat;
    const color = p.kind === 'mask' ? this.car.paintU.uBody.value.clone() : m.color.clone();
    return { color, metalness: m.metalness, roughness: m.roughness, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: m.clearcoatRoughness ?? 0 };
  }

  setColor(hex) { this.target.set(hex); this.hasTarget = true; for (const it of this.items) it.goal.color.copy(this.target); }

  setFinish(name) {
    const f = FINISHES[name]; if (!f) return;
    this.finish = name;
    for (const it of this.items) {
      it.goal.metalness = f.metalness; it.goal.roughness = f.roughness;
      it.goal.clearcoat = Math.max(0.001, f.clearcoat); it.goal.clearcoatRoughness = f.clearcoatRoughness;
    }
  }

  /** @param {number} dt seconds  @param {number} rate easing speed (higher = faster) */
  update(dt, rate = 3.2) {
    const k = 1 - Math.exp(-dt * rate);
    for (const it of this.items) {
      const m = it.mat, g = it.goal;
      const col = it.kind === 'mask' ? this.car.paintU.uBody.value : m.color;
      col.lerp(g.color, k);
      m.metalness += (g.metalness - m.metalness) * k;
      m.roughness += (g.roughness - m.roughness) * k;
      if (it.kind === 'physical') {
        m.clearcoat += (g.clearcoat - m.clearcoat) * k;
        m.clearcoatRoughness += (g.clearcoatRoughness - m.clearcoatRoughness) * k;
      }
    }
  }
}
