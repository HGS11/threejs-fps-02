import { MAP } from './mapdata.js';

const resolved = { x: 0, z: 0 };

// Pushes a circle out of solid boxes while preserving sliding motion.
export function resolveCircle(x, z, radius = 0.38) {
  for (const box of MAP.boxes) {
    const closestX = Math.max(box.x - box.w / 2, Math.min(x, box.x + box.w / 2));
    const closestZ = Math.max(box.z - box.d / 2, Math.min(z, box.z + box.d / 2));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared < radius * radius) {
      const distance = Math.sqrt(distanceSquared) || 0.001;
      x += dx / distance * (radius - distance);
      z += dz / distance * (radius - distance);
    }
  }
  resolved.x = x;
  resolved.z = z;
  return resolved;
}

// Tests whether a two dimensional segment intersects a box.
export function segmentBox(ax, az, bx, bz, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const p = [-dx, dx, -dz, dz];
  const q = [ax - (box.x - box.w / 2), box.x + box.w / 2 - ax,
    az - (box.z - box.d / 2), box.z + box.d / 2 - az];
  for (let i = 0; i < 4; i++) {
    if (!p[i] && q[i] < 0) return false;
    const t = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, t);
    else if (p[i] > 0) t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

// Checks sight and shot obstruction from boxes at least two meters tall.
export function blocked(ax, az, bx, bz) {
  return MAP.boxes.some(box => box.h >= 2 && segmentBox(ax, az, bx, bz, box));
}

// Returns the closest ray intersection distance with a sphere.
export function raySphere(origin, direction, center, radius) {
  const x = origin.x - center.x;
  const y = origin.y - center.y;
  const z = origin.z - center.z;
  const b = x * direction.x + y * direction.y + z * direction.z;
  const q = x * x + y * y + z * z - radius * radius;
  const h = b * b - q;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}
