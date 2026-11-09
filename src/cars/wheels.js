import * as THREE from 'three';
import { RollState } from './wheelMath.js';

/**
 * Real wheel rotation, for models whose wheels are separate nodes (today: the Ferrari's four `tire N`
 * groups). Each group is re-parented under a pivot placed at the wheel's measured centre, in the car's own
 * frame (+X = lateral axle axis), so rotating the pivot spins tyre, rim and disc about the true axle.
 * Brake calipers are separate nodes and deliberately stay still. Models without separable wheels (BMW:
 * four wheels fused into one mesh; Maybach: parts merged by material) get no rig - nothing is faked.
 *
 * Positive rotation about +X takes +Y toward +Z (the nose), i.e. the wheels roll forward.
 * NOTE: GLTFLoader turns node names like "tire 1" into "tire_1", so the pattern accepts both.
 */
export class WheelRig {
  constructor(car, root, pattern) {
    this.wheels = [];
    this.target = 0;       // ground speed in m/s the wheels are rolling at
    this._last = null;
    const re = new RegExp(pattern);
    const groups = [];
    root.traverse((o) => { if (!o.isMesh && re.test(o.name)) groups.push(o); });

    car.pivot.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new THREE.Vector3();
    for (const g of groups) {
      box.setFromObject(g);
      if (box.isEmpty()) continue;
      box.getCenter(c);
      const radius = (box.max.y - box.min.y) / 2;       // the car pivot only yaws, so the y-extent is the diameter
      car.pivot.worldToLocal(c);
      const pivot = new THREE.Object3D();
      pivot.name = `wheel-pivot:${g.name}`;
      pivot.position.copy(c);
      car.pivot.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(g);                                   // keeps the wheel exactly where it was
      this.wheels.push({ pivot, roll: new RollState(radius) });
    }
  }

  get count() { return this.wheels.length; }

  /** @param {number} mps ground speed the wheels should roll at (0 = stopped, eased) */
  setSpeed(mps) { this.target = mps; }

  update(time) {
    const dt = this._last == null ? 0 : Math.min(0.05, Math.max(0, time - this._last));
    this._last = time;
    for (const w of this.wheels) w.pivot.rotation.x = w.roll.step(dt, this.target);
  }
}
