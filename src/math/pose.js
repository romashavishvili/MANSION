// Car pose helpers (pure math, no three.js). A car model's local frame is:
//   +Z = front of the car, +Y = up, +X = the car's LEFT side, origin = centre of the footprint on the floor.
// A pose is { x, z, yaw } with yaw rotating about +Y (positive yaw turns the nose toward +X).

export function localToWorld(pose, [x, y, z]) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  return [pose.x + x * c + z * s, y, pose.z - x * s + z * c];
}

export function localDirToWorld(pose, [x, y, z]) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  return [x * c + z * s, y, -x * s + z * c];
}

/** Distance from a world point to a car's bounding box (0 when inside). */
export function distanceToCarBox(pose, size, [wx, wy, wz]) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  const dx = wx - pose.x, dz = wz - pose.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const ox = Math.max(Math.abs(lx) - size[0] / 2, 0);
  const oz = Math.max(Math.abs(lz) - size[2] / 2, 0);
  const oy = Math.max(wy - size[1], 0);
  return Math.hypot(ox, oy, oz);
}
