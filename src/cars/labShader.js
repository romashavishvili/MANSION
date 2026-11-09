import * as THREE from 'three';

/**
 * "Surface lab" shader: patches a car's clear-coated paint material so the paint-correction and PPF demos run on
 * the REAL model. Everything is gated by uniforms and is a no-op at rest (uLabDefect = 0, uLabZone = 0).
 *   - swirl defects: a procedurally generated marring texture (circular arcs + fine scratches, sampled
 *     triplanar in car-local space) perturbs the clear-coat normal and raises clear-coat roughness on one side of a
 *     plane at car-local z = uLabSplit.  ILLUSTRATIVE: generated, not scanned from real paint.
 *   - coverage zones: a thin cool-tinted overlay and a boundary line showing which AREA a film package covers.
 */
export function swirlTexture(size = 1024, seed = 7) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, size, size);
  g.lineCap = 'round';
  const offs = [-size, 0, size];
  const arcs = 650, lines = 160;
  for (let i = 0; i < arcs; i++) {
    const cx = rnd() * size, cy = rnd() * size, r = 24 + rnd() * 240, a0 = rnd() * 6.283, span = 0.35 + rnd() * 1.9;
    g.lineWidth = 1.4 + rnd() * 1.8;
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.12 + rnd() * 0.4})` : `rgba(0,0,0,${0.12 + rnd() * 0.4})`;
    for (const ox of offs) for (const oy of offs) { g.beginPath(); g.arc(cx + ox, cy + oy, r, a0, a0 + span); g.stroke(); }
  }
  for (let i = 0; i < lines; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * 6.283, l = 20 + rnd() * 110;
    g.lineWidth = 1.2 + rnd() * 1.2;
    g.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.1 + rnd() * 0.3})` : `rgba(0,0,0,${0.1 + rnd() * 0.3})`;
    for (const ox of offs) for (const oy of offs) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

const PERTURB = `
vec3 btmPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`;

/** @returns the uniforms object (live: write .value to drive the effect) */
export function patchLab(material, invPivot) {
  const tex = swirlTexture();
  const u = {
    uLabInv: { value: invPivot },
    uLabTex: { value: tex },
    uLabSplit: { value: 9 },        // car-local z; paint nose-ward of this plane is "untreated"
    uLabDefect: { value: 0 },       // 0..1 strength of the simulated marring
    uLabZone: { value: 0 },         // 0 off, 1 leading edge, 2 front end, 3 full body
    uLabZoneAmt: { value: 0 },      // 0..1 fade of the zone overlay
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uLabInv;\nvarying vec3 vLabP;\nvarying vec3 vLabN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLabP = (uLabInv * modelMatrix * vec4(transformed, 1.0)).xyz;\n  vLabN = normalize(mat3(uLabInv) * mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uLabTex; uniform float uLabSplit, uLabDefect, uLabZone, uLabZoneAmt;
varying vec3 vLabP; varying vec3 vLabN;
${PERTURB}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  vec2 labDH = vec2(0.0); float labMask = 0.0;
  if (uLabDefect > 0.001) {
    labMask = smoothstep(uLabSplit - 0.06, uLabSplit + 0.06, vLabP.z) * uLabDefect;
    vec3 w = pow(abs(vLabN), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4);
    float h = texture2D(uLabTex, vLabP.zy * 0.5).r * w.x + texture2D(uLabTex, vLabP.xz * 0.5).r * w.y + texture2D(uLabTex, vLabP.xy * 0.5).r * w.z;
    labDH = vec2(dFdx(h), dFdy(h)) * labMask * 9.0;
  }`)
      .replace('#include <clearcoat_normal_fragment_begin>', `#include <clearcoat_normal_fragment_begin>
  #ifdef USE_CLEARCOAT
    if (labMask > 0.0) clearcoatNormal = btmPerturb(-vViewPosition, clearcoatNormal, labDH, faceDirection);
  #endif`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
    material.clearcoatRoughness = clamp(material.clearcoatRoughness + labMask * 0.2, 0.0, 1.0);
  #endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (uLabZone > 0.5 && uLabZoneAmt > 0.001) {
    float zl = uLabZone < 1.5 ? 1.35 : (uLabZone < 2.5 ? 0.05 : -9.0);
    float inZone = smoothstep(zl - 0.012, zl + 0.012, vLabP.z);
    float edge = (1.0 - smoothstep(0.0, 0.016, abs(vLabP.z - zl))) * step(-8.0, zl);
    totalEmissiveRadiance += uLabZoneAmt * (vec3(0.05, 0.16, 0.2) * inZone * 0.55 + vec3(0.35, 0.8, 1.0) * edge * 1.6);
  }
  if (uLabDefect > 0.001) {            // the plane that divides before / after
    float e = 1.0 - smoothstep(0.0, 0.014, abs(vLabP.z - uLabSplit));
    totalEmissiveRadiance += vec3(1.0, 0.95, 0.9) * e * 1.1 * step(0.001, uLabDefect);
  }`);
  };
  material.customProgramCacheKey = () => 'btm-lab';
  material.needsUpdate = true;
  return u;
}
