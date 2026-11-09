import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { aspectFov } from './aspect.js';

/**
 * Camera rig. Three modes:
 *   'script' - the camera follows the authored choreography (position/look/fov tracks keyed on master
 *              time) plus two thin "human" layers: operator breathing and mouse parallax.
 *   'rail'   - the website: the same evaluation (+ breathing, parallax) driven by SCROLL instead of the
 *              master clock, along the rail built in site/rail.js. It starts on the opening's last frame.
 *   'orbit'  - free, damped orbit around the line-up (the Stage 1 hand-over; kept for the debug tools).
 * Any track set exposing pos / look / fov (and optionally shift) can be evaluated with applyTracks().
 */
export class CameraRig {
  constructor(camera, domElement, script) {
    this.camera = camera;
    this.script = script;
    this.mode = 'script';
    this.pos = [0, 0, 0]; this.look = [0, 0, 0]; this.fovArr = [30]; this.shiftArr = [0, 0];
    this.rail = null;
    this._viewShift = [0, 0];
    this.parallax = { tx: 0, ty: 0, x: 0, y: 0 };
    this.breath = 1;
    this.reduced = false;
    this._v = new THREE.Vector3();

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.55;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 34;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.495;   // never below the floor

    this._onMove = (e) => {
      this.parallax.tx = (e.clientX / window.innerWidth) * 2 - 1;
      this.parallax.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', this._onMove, { passive: true });
  }

  /** Evaluate the scripted shot at master time t. `time` is the real clock (for breathing). */
  applyScript(t, time, dt) { this.applyTracks(this.script, t, time, dt); }

  /** Evaluate the website rail at rail time t (see site/rail.js). */
  applyRail(t, time, dt) { if (this.rail) this.applyTracks(this.rail, t, time, dt); }

  applyTracks(s, t, time, dt) {
    s.pos.evaluate(t, this.pos); s.look.evaluate(t, this.look); s.fov.evaluate(t, this.fovArr);
    if (s.shift) s.shift.evaluate(t, this.shiftArr); else { this.shiftArr[0] = 0; this.shiftArr[1] = 0; }
    const p = this.parallax;
    const k = 1 - Math.exp(-dt * 2.2);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;

    const m = this.reduced ? 0 : 1;
    const b = this.breath * m;
    const x = this.pos[0] + Math.sin(time * 0.37) * 0.035 * b + p.x * 0.22 * m;
    const y = this.pos[1] + Math.sin(time * 0.53 + 1.3) * 0.02 * b - p.y * 0.07 * m;
    const z = this.pos[2] + Math.sin(time * 0.29 + 0.4) * 0.03 * b;
    const lx = this.look[0] + p.x * 0.18 * m;
    const ly = this.look[1] - p.y * 0.06 * m;
    const lz = this.look[2];

    const cam = this.camera;
    cam.position.set(Math.max(-60, x), Math.max(0.25, y), z);
    const fov = aspectFov(this.fovArr[0], cam.aspect);
    if (Math.abs(cam.fov - fov) > 1e-4) { cam.fov = fov; cam.updateProjectionMatrix(); }
    this._applyShift(this.shiftArr[0], this.shiftArr[1]);
    cam.lookAt(lx, ly, lz);
  }

  /**
   * Frame shift: slides the picture inside the viewport (+x = right, +y = down, as fractions of the
   * width / height) using the camera's view offset, so the car can sit beside the type. It changes only
   * the projection, never the pose, so reflections, fog and post-processing are unaffected.
   */
  _applyShift(sx, sy) {
    const cam = this.camera, v = this._viewShift;
    const zero = Math.abs(sx) < 1e-5 && Math.abs(sy) < 1e-5;
    if (zero) {
      if (cam.view && cam.view.enabled) cam.clearViewOffset();
      v[0] = 0; v[1] = 0;
      return;
    }
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    if (Math.abs(sx - v[0]) < 1e-5 && Math.abs(sy - v[1]) < 1e-5 && this._viewKey === key && cam.view?.enabled) return;
    v[0] = sx; v[1] = sy; this._viewKey = key;
    cam.setViewOffset(w, h, -sx * w, -sy * h, w, h);
  }

  /** Hand over from the script to free orbit, keeping the current pose. */
  enterOrbit(lookAt) {
    this.mode = 'orbit';
    this.controls.target.set(lookAt[0], lookAt[1], lookAt[2]);
    this.controls.enabled = true;
    this.controls.update();
  }

  /** Hand over from the opening to the website: the camera is now driven by scroll along `rail`. */
  enterRail(rail) {
    this.rail = rail;
    this.mode = 'rail';
    this.controls.enabled = false;
  }

  leaveOrbit() {
    this.mode = 'script';
    this.controls.enabled = false;
  }

  update() {
    if (this.mode === 'orbit') this.controls.update();
  }

  dispose() {
    window.removeEventListener('pointermove', this._onMove);
    this.controls.dispose();
  }
}
