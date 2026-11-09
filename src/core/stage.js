import * as THREE from 'three';
import { FOG, TIERS } from '../config.js';
import { buildEnvironments } from '../world/environment.js';
import { createFloor } from '../world/floor.js';
import { Dust } from '../world/atmosphere.js';
import { createComposer } from './post.js';
import { fitPixelRatio } from './renderer.js';

/**
 * Owns the Three.js scene: camera, floor + mirror, atmosphere, global lights, post-processing.
 * Cars are added with addCar(). Everything here is driven by update()/render() once per frame.
 */
export class Stage {
  constructor(renderer, tierName) {
    this.renderer = renderer;
    this.tierName = tierName;
    this.tier = TIERS[tierName];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(FOG.color);
    this.fog = new THREE.FogExp2(FOG.color, FOG.density);
    this.scene.fog = this.fog;

    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    this.camera = new THREE.PerspectiveCamera(30, size.x / size.y, 0.05, 140);
    this.camera.position.set(0, 1.6, 17);

    this.envs = buildEnvironments(renderer);

    this.floor = createFloor({ envTexture: this.envs.floor, tier: this.tier, size: new THREE.Vector2(size.x * pr, size.y * pr) });
    this.scene.add(this.floor.group);

    this.dust = new Dust(this.tier.particles);
    this.scene.add(this.dust.points);

    // The finale's "light sweep": one travelling overhead spot that rakes across floor and paint.
    this.sweep = new THREE.SpotLight(0xdbe4ff, 0, 80, 0.4, 1.0, 2);
    this.sweep.position.set(-16, 10, 11);
    this.sweep.target.position.set(-12, 0.3, 0.5);
    this.scene.add(this.sweep, this.sweep.target);
    this.sweepPeak = 1300;

    this.cars = [];
    this._beams = [];
    this.post = createComposer(renderer, this.scene, this.camera, this.tier);
    this.post.setSize(size.x, size.y);
    this.time = 0;
    this.lightScale = 1;
    this.scale = 1;          // render-resolution multiplier, owned by the governor (core/governor.js)

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
  }

  addCar(car) {
    this.cars.push(car);
    this.scene.add(car.pivot);
  }

  /** 0..1 progress of the finale sweep. */
  setSweep(s) {
    const x = THREE.MathUtils.lerp(-15, 15, s);
    this.sweep.position.set(x, 10, 11);
    this.sweep.target.position.set(x * 0.75, 0.3, 0.5);
    this.sweep.intensity = this.sweepPeak * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, s))), 1.3) * this.lightScale;
  }

  update(time) {
    this.time = time;
    this._beams.length = 0;
    let reveal = 0;
    for (const car of this.cars) {
      car.update(time, this.camera);
      car.collectBeams(this._beams);
      reveal = Math.max(reveal, car.reveal, car.lampAvg);
    }
    this.dust.setBeams(this._beams);
    this.dust.uniforms.uAmbient.value = reveal;
    this.dust.update(time, this.camera, this.renderer.domElement.height);
    this.floor.setReveal(reveal);
    this.post.grade.uniforms.uTime.value = time;
  }

  render(dt) {
    this.post.composer.render(dt);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = fitPixelRatio(this.tier, w, h) * this.scale;
    this.renderer.setPixelRatio(pr);
    this.post.composer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.floor.resize(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
  }

  /** Render-resolution multiplier (0.55..1). Re-sizes the targets; the page layout is unaffected. */
  setScale(s) { this.scale = s; this.resize(); }

  /** Shed optional effects when even the lowest resolution is too slow: 1 = no film grain / half the dust, 2 = also no bloom. */
  setEffects(level) {
    if (level >= 1) { this.post.grade.uniforms.uGrain.value = 0; this.dust.points.geometry.setDrawRange(0, Math.floor(this.tier.particles * 0.5)); }
    if (level >= 2 && this.post.bloom) this.post.bloom.enabled = false;
  }

  setFade(v) { this.post.grade.uniforms.uFade.value = v; }

  dispose() {
    window.removeEventListener('resize', this.resize);
    this.post.composer.dispose?.();
  }
}
