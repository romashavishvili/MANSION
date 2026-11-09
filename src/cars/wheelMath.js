// Pure wheel kinematics (no three.js). A wheel of radius r rolling at ground speed v turns at v / r rad/s,
// so the larger rear wheels of the Ferrari turn slightly slower than the fronts - exactly as they would.

export const rollRate = (speed, radius) => (radius > 1e-4 ? speed / radius : 0);

/** Frame-rate independent ease toward a target (time constant tau, seconds). */
export const approach = (cur, target, dt, tau = 0.7) => cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) / tau));

export class RollState {
  constructor(radius) { this.radius = radius; this.angle = 0; this.speed = 0; }
  /** @returns {number} wheel angle in radians (0..2pi) about the axle */
  step(dt, targetSpeed, tau = 0.7) {
    this.speed = approach(this.speed, targetSpeed, dt, tau);
    this.angle = (this.angle + rollRate(this.speed, this.radius) * dt) % (Math.PI * 2);
    return this.angle;
  }
}
