import * as THREE from 'three';
import { CARS, LAYOUT } from '../config.js';
import { localToWorld } from '../math/pose.js';
import { aspectFov, profileFor } from '../camera/aspect.js';
import { T, lampLevel, revealLevel } from '../sequence/schedule.js';
import { cylLerp, lerp3, ROOM_SHOTS } from './shots.js';
import { BmwRoom } from './rooms/bmw.js';
import { FerrariRoom } from './rooms/ferrari.js';
import { MaybachRoom } from './rooms/maybach.js';

const ROOMS = { bmw: BmwRoom, ferrari: FerrariRoom, maybach: MaybachRoom };
export const ROOM_TITLES = { bmw: 'I \u2014 Precision', ferrari: 'II \u2014 Sculpture', maybach: 'III \u2014 Exclusivity' };
const $ = (id) => document.getElementById(id);
const smooth = (k) => k * k * (3 - 2 * k);

/**
 * The vehicle rooms. Entering one hands the camera from the scroll rail to a controlled, orbitable camera around
 * ONE car, dims the other two (the hall goes dark around the exhibit), and mounts that car's own interface. Each room
 * is its own class (rooms/*.js) with its own interaction model; this class owns what they share: the veil
 * transition, camera moves (arcing around the car), the per-car light state, and clean-up.
 */
export class Exhibit {
  constructor({ gsap, site, rig, stage, cars, reducedMotion }) {
    Object.assign(this, { gsap, site, rig, stage, cars });
    this.reduced = reducedMotion;
    this.root = $('exhibit'); this.veil = $('veil'); this.veilLabel = $('veil-label');
    this.html = document.documentElement;
    this.active = false; this.busy = false; this.id = null; this.room = null;
    this.tween = null; this.look = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.shift = [0, 0];
    this.scene = { gain: 1, env: 1, lamps: 1, accent: null, others: 0.14 };
    this.state = {};   // per-car eased { reveal, lamp, gain, env }
    this._ctl = new AbortController();
    const c = rig.controls;
    c.addEventListener('start', () => { this.tween?.kill(); this.tween = null; this.room?.onUserOrbit?.(true); });
    c.addEventListener('end', () => this.room?.onUserOrbit?.(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.active && !this.busy && !document.documentElement.classList.contains('menu-open')) this.leave(); });
  }

  get car() { return this.cars[this.id]; }

  _ready(id) { return this.cars[id]?.ready; }

  // ------------------------------------------------------------------ veil (slat wipe with the room's name)
  _veil(show, label) {
    const gsap = this.gsap, slats = this.veil.querySelectorAll('i');
    if (label) this.veilLabel.textContent = label;
    gsap.killTweensOf([this.veil, slats, this.veilLabel]);
    if (this.reduced) { gsap.set(this.veil, { autoAlpha: show ? 1 : 0 }); gsap.set(slats, { scaleY: 1 }); return Promise.resolve(); }
    this.veil.style.visibility = 'visible';
    return new Promise((res) => {
      if (show) {
        gsap.set(this.veil, { autoAlpha: 1 });
        gsap.timeline({ onComplete: res })
          .fromTo(slats, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7, ease: 'expo.inOut', stagger: 0.06 }, 0)
          .fromTo(this.veilLabel, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.45);
      } else {
        gsap.timeline({ onComplete: () => { gsap.set(this.veil, { autoAlpha: 0 }); res(); } })
          .to(this.veilLabel, { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in' }, 0)
          .set(slats, { transformOrigin: '50% 0%' }, 0.2)
          .to(slats, { scaleY: 0, duration: 0.8, ease: 'expo.inOut', stagger: 0.06 }, 0.25);
      }
    });
  }

  // ------------------------------------------------------------------ enter / leave
  async enter(id) {
    if (this.busy || this.active || !ROOMS[id] || !this._ready(id)) return false;
    this.busy = true;
    this.site.sound?.cue?.('section');
    await this._veil(true, ROOM_TITLES[id]);
    this.id = id; const car = this.car, cfg = ROOM_SHOTS[id];
    this.site.lenis.stop();
    this.html.classList.add('in-exhibit');
    this.active = true;
    this.scene = { gain: 1, env: 1, lamps: 1, accent: null, others: 0 };
    // a room is private: the other two cars leave the hall (their lights stay, at zero, so no shader recompiles)
    for (const [cid, oc] of Object.entries(this.cars)) if (cid !== id) { oc.model.visible = false; oc.shadow.visible = false; }
    for (const cid of Object.keys(this.cars)) this.state[cid] = { reveal: this.cars[cid].reveal, lamp: this.cars[cid].lampAvg, gain: 1, env: 1 };

    const rig = this.rig, c = rig.controls;
    this.profile = profileFor(innerWidth, innerHeight);
    c.minDistance = cfg.orbit.min; c.maxDistance = cfg.orbit.max;
    c.minPolarAngle = 0.25; c.maxPolarAngle = Math.PI * 0.49;
    c.enablePan = false; c.autoRotate = false;
    const first = cfg.views ? cfg.views.front : (cfg.chapters || cfg.stations)[0];
    this.cut(first, cfg.orbit.target);
    rig.enterOrbit(this._world(cfg.orbit.target, this._v).toArray());
    this.shift = this.profile === 'mobile' ? [0, -0.2] : [0.17, 0];

    this.room = new ROOMS[id]({ exhibit: this, car, root: this.root, gsap: this.gsap, cfg, reduced: this.reduced });
    this.root.hidden = false;
    this.room.mount();
    await this._veil(false);
    this.busy = false;
    this.root.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    return true;
  }

  async leave() {
    if (!this.active || this.busy) return;
    this.busy = true;
    await this._veil(true, 'MANSION');
    this._teardown();
    this.site.resumeFromExhibit();
    await this._veil(false);
    this.busy = false;
  }

  /** Immediate exit with no transition (replay, navigation to another section). */
  leaveNow() { if (!this.active) return; this._teardown(); this.site.resumeFromExhibit(); this._veil(false); this.busy = false; }

  _teardown() {
    this.tween?.kill(); this.tween = null;
    this.room?.unmount(); this.room = null;
    this.root.hidden = true; this.root.replaceChildren();
    for (const oc of Object.values(this.cars)) { oc.model.visible = true; oc.shadow.visible = true; }
    const car = this.car;
    car.setGains(1, 1);
    car.accent.color.set(CARS[this.id].accent.color);
    car.wheels?.setSpeed(0);
    this.stage.sweep.intensity = 0;
    this.rig.controls.autoRotate = false;
    this.html.classList.remove('in-exhibit');
    this.active = false; this.id = null;
  }

  // ------------------------------------------------------------------ camera
  _world(local, out) { const w = localToWorld(LAYOUT[this.id], local); return out.set(w[0], w[1], w[2]); }
  _local(world) { const p = LAYOUT[this.id], c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = world.x - p.x, dz = world.z - p.z; return [dx * c - dz * s, world.y, dx * s + dz * c]; }

  _apply(pos, look, fov) {
    const cam = this.rig.camera, p = this._world(pos, this._v);
    cam.position.copy(p);
    this._world(look, this.rig.controls.target);
    const f = aspectFov(fov, cam.aspect);
    if (Math.abs(cam.fov - f) > 1e-4) { cam.fov = f; cam.updateProjectionMatrix(); }
  }

  /** Instant placement. */
  cut(shot) { this.fov = shot.fov; this._apply(shot.pos, shot.look, shot.fov); this._cur = { pos: shot.pos.slice(), look: shot.look.slice(), fov: shot.fov }; }

  /** Glide to a shot: the camera arcs around the car (cylindrical path), the look target and lens ease along. */
  go(shot, { dur = 2.2, ease = 'power3.inOut', onDone } = {}) {
    this.tween?.kill();
    const cam = this.rig.camera;
    const from = { pos: this._local(cam.position), look: this._local(this.rig.controls.target), fov: this._cur?.fov ?? shot.fov };
    if (this.reduced || dur <= 0) { this.cut(shot); onDone?.(); return null; }
    const k = { v: 0 }, ez = this.gsap.parseEase(ease);
    this.tween = this.gsap.to(k, {
      v: 1, duration: dur, ease: 'none',
      onUpdate: () => {
        const e = ez(k.v);
        const f = from.fov + (shot.fov - from.fov) * e;
        this._apply(cylLerp(from.pos, shot.pos, e), lerp3(from.look, shot.look, e), f);
        this._cur = { fov: f };
      },
      onComplete: () => { this.tween = null; this._cur = { pos: shot.pos.slice(), look: shot.look.slice(), fov: shot.fov }; onDone?.(); },
    });
    return this.tween;
  }

  /** Screen position (px) + visibility of a car-local point. */
  project(local, out = {}) {
    const v = this._world(local, this._v).project(this.rig.camera);
    out.x = (v.x * 0.5 + 0.5) * innerWidth; out.y = (-v.y * 0.5 + 0.5) * innerHeight; out.on = v.z > -1 && v.z < 1;
    return out;
  }

  /** Light state for this room: { gain, env, lamps 0..1, accent hex, others } - eased in update(). */
  setScene(p) { Object.assign(this.scene, p); }

  // ------------------------------------------------------------------ per frame (replaces opening.apply while active)
  update(dt, clock) {
    const k = 1 - Math.exp(-dt * 3);
    const sc = this.scene;
    for (const [cid, car] of Object.entries(this.cars)) {
      const st = this.state[cid]; if (!st) continue;
      const mine = cid === this.id;
      const tReveal = mine ? 1 : sc.others, tLamp = mine ? sc.lamps : 0;
      st.reveal += (tReveal - st.reveal) * k; st.lamp += (tLamp - st.lamp) * k;
      st.gain += ((mine ? sc.gain : 1) - st.gain) * k; st.env += ((mine ? sc.env : 1) - st.env) * k;
      car.setGains(st.gain, st.env);
      car.setLamps(st.lamp, st.lamp); car.setReveal(st.reveal); car.setSway(0);
      if (mine && sc.accent != null) { this._acc ??= new THREE.Color(); car.accent.color.lerp(this._acc.set(sc.accent), k); }
    }
    const rig = this.rig; rig._applyShift(this.shift[0], this.shift[1]);
    this.room?.update?.(dt, clock);
  }

  /** Restore the opening's end state for a car (used by the site when scrolling resumes). */
  static restingState() { return { lamp: (id) => lampLevel(id, 'L', T.end), reveal: (id) => revealLevel(id, T.end) }; }
}
