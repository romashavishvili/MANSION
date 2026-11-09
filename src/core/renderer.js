import * as THREE from 'three';
import { TIERS, EXPOSURE } from '../config.js';

export function webgl2Available() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

/** Auto-select a quality tier. Override with ?quality=low|medium|high. */
export function pickTier() {
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) return q;
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory ?? 8;
  if (coarse || mem <= 2) return 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

/** Pixel ratio that respects both the tier's dpr cap and its total-pixel budget. */
export function fitPixelRatio(tier, w = window.innerWidth, h = window.innerHeight) {
  const byBudget = Math.sqrt(tier.maxPixels / Math.max(1, w * h));
  return Math.max(0.6, Math.min(window.devicePixelRatio || 1, tier.dpr, byBudget));
}

export function createRenderer(canvas, tierName) {
  const tier = TIERS[tierName];
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,            // MSAA lives on the HDR composer target instead
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(fitPixelRatio(tier));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // applied by OutputPass (see post.js)
  renderer.toneMappingExposure = EXPOSURE;
  renderer.shadowMap.enabled = false;                    // headlights are un-shadowed (see README: design decisions)
  return renderer;
}
