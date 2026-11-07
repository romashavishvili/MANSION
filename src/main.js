import * as THREE from 'three';
import { CARS, CAR_ORDER, LAYOUT, BRAND } from './config.js';
import { webgl2Available, pickTier, createRenderer } from './core/renderer.js';
import { Stage } from './core/stage.js';
import { AssetLoader, fetchJSON } from './core/loader.js';
import { Car } from './cars/car.js';
import { CameraRig } from './camera/rig.js';
import { buildCameraScript } from './sequence/cameraScript.js';
import { Opening } from './sequence/opening.js';
import { T } from './sequence/schedule.js';
import { Site } from './site/Site.js';
import { HUD } from './ui/hud.js';
import { initChrome } from './site/chrome.js';
import { DebugPanel } from './ui/debug.js';

const params = new URLSearchParams(location.search);

async function boot() {
  document.title = BRAND.documentTitle;
  const hud = new HUD();
  if (!webgl2Available()) { hud.showFallback(); return; }

  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tierName = pickTier();
  const canvas = document.getElementById('gl');
  const renderer = createRenderer(canvas, tierName);

  hud.setLoader(0, 'PREPARING THE DARK');
  // Manifests (tiny) first: they carry headlight anchors, so every light can be placed immediately.
  const metas = Object.fromEntries(await Promise.all(CAR_ORDER.map(async (id) => [id, await fetchJSON(CARS[id].meta)])));

  const stage = new Stage(renderer, tierName);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cars = {};
  for (const id of CAR_ORDER) {
    cars[id] = new Car(CARS[id], metas[id], stage.envs[CARS[id].env], aniso, stage.tier.beamSteps);
    stage.addCar(cars[id]);
  }

  // Safety net: if the patched lamp material fails to compile, drop just that effect instead of the lamp.
  renderer.debug.onShaderError = () => { for (const id of CAR_ORDER) cars[id].disableLampMap(); };

  const script = buildCameraScript(LAYOUT);
  const rig = new CameraRig(stage.camera, canvas, script);
  rig.reduced = reducedMotion;
  rig.applyScript(0, 0, 0.016);

  const opening = new Opening({ cars, stage, rig, hud });
  // The website layer (scroll, navigation, DOM choreography). When the opening ends it hands the camera
  // to a scroll-driven rail that starts on the opening's last frame (see src/site/).
  const site = new Site({ rig, hud, opening, introScript: script, layout: LAYOUT, cars, reducedMotion });
  opening.handoff = () => site.handoff();
  initChrome({ hud, goTo: (id) => site.goTo(id) });
  const loader = new AssetLoader();
  const debug = new DebugPanel({ el: hud.el.debug, renderer, stage, cars, opening, rig, tierName });
  window.BTM = { THREE, renderer, stage, cars, rig, opening, hud, site, T, params };

  hud.onSkip = () => opening.skip();
  hud.onReplay = () => (site.live ? site.replay() : opening.start());

  // ---- Phase 1: the first vehicle (blocking; drives the loader with real byte progress) ----------
  const compile = async (obj) => {
    try { await renderer.compileAsync(obj, stage.camera, stage.scene); }
    catch (e) { console.warn('[BTM] shader pre-compile skipped:', e); }
  };
  // three.js uploads geometry/textures lazily, the first time a mesh is inside the view frustum. For a
  // 40 MB model that would be a visible hitch mid-sequence, so right after loading we render the scene
  // once into a tiny off-screen target with frustum culling disabled for that car.
  const upload = (car) => {
    const meshes = [];
    car.model.traverse((o) => { if (o.isMesh) { meshes.push(o); o.frustumCulled = false; } });
    const rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType });
    const prev = renderer.getRenderTarget();
    try { renderer.setRenderTarget(rt); renderer.render(stage.scene, stage.camera); }
    finally { renderer.setRenderTarget(prev); rt.dispose(); for (const o of meshes) o.frustumCulled = true; }
  };
  try {
    cars.bmw.setModel(await loader.loadCarModel(CARS.bmw, (p) => hud.setLoader(0.04 + p * 0.86, 'LOADING ' + CARS.bmw.name.toUpperCase())));
    hud.setLoader(0.93, 'COMPILING LIGHT');
    await compile(stage.scene);
    upload(cars.bmw);
  } catch (err) {
    console.error('[BTM] failed to load the BMW', err);
    hud.setLoader(0, 'COULD NOT LOAD MODELS — SEE CONSOLE');
    return;
  }
  hud.setLoader(1, 'READY');

  // ---- render loop ---------------------------------------------------------------------------------
  let last = performance.now() / 1000, clock = 0;
  renderer.setAnimationLoop((nowMs) => {
    const now = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0, now - last));
    last = now; clock += dt;
    opening.update(dt);
    opening.apply(clock, dt);
    site.update(dt, nowMs, clock);          // Lenis + the scroll rail (no-op until the opening hands over)
    rig.update();
    stage.update(clock);
    stage.render(dt);
    debug.frame(dt);
  });

  // ---- Phase 2: Ferrari then Maybach stream in while the opening plays ---------------------------------
  const rest = (async () => {
    for (const id of ['ferrari', 'maybach']) {
      const cfg = CARS[id];
      try {
        hud.setBackgroundLoad('LOADING ' + cfg.name, 0);
        const root = await loader.loadCarModel(cfg, (p) => hud.setBackgroundLoad('LOADING ' + cfg.name, p));
        cars[id].setModel(root);
        await compile(cars[id].pivot);
        upload(cars[id]);
      } catch (err) {
        console.error(`[BTM] failed to load ${cfg.name}`, err);
        hud.setBackgroundLoad('COULD NOT LOAD ' + cfg.name.toUpperCase(), 1);
        throw err;
      }
    }
    hud.setBackgroundLoad(null);
  })();

  // ---- go ----------------------------------------------------------------------------------------------
  const startAt = parseFloat(params.get('t'));
  const skipIntro = reducedMotion || params.has('site');      // ?site jumps straight to the website
  if (Number.isFinite(startAt) || skipIntro) {
    // deep-link / reduced-motion: wait for every model so any moment of the sequence is complete
    await rest.catch(() => {});
    hud.hideLoader();
    if (skipIntro && !Number.isFinite(startAt)) {
      opening.jumpToEnd(clock);
    } else {
      opening.start(); opening.scrub(startAt);
      if (params.has('pause')) opening.pause();
    }
  } else {
    hud.hideLoader();
    setTimeout(() => opening.start(), 700);     // let the loader finish fading to black first
  }
  rest.catch(() => {});
}

boot().catch((err) => {
  console.error('[BTM] fatal', err);
  const l = document.getElementById('loader-label');
  if (l) l.textContent = 'SOMETHING WENT WRONG — SEE CONSOLE (F12)';
});
