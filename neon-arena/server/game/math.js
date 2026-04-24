/**
 * Pure math helpers. No state, no I/O.
 */
'use strict';

const C = require('./constants');

/** Pick a random spawn point inside the arena, away from center obstacles. */
function randomSpawn() {
  const half = C.MAP_SIZE / 2 - 3;
  // Try a few candidates to avoid spawning inside a known box.
  for (let i = 0; i < 8; i++) {
    const x = (Math.random() * 2 - 1) * half;
    const z = (Math.random() * 2 - 1) * half;
    if (Math.hypot(x, z) > 4) return { x, y: 0, z };
  }
  return { x: half, y: 0, z: half };
}

/**
 * Ray vs AABB (slab method). Returns t (distance along normalized dir) of
 * first hit, or null if miss or behind origin.
 */
function rayAABB(origin, dir, min, max) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    const o = origin[axis];
    const d = dir[axis];
    const mn = min[axis];
    const mx = max[axis];
    if (Math.abs(d) < 1e-8) {
      if (o < mn || o > mx) return null;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

/**
 * Hitscan raycast against a player modeled as a vertical AABB.
 * playerFeet.y is the ground position; body extends up by PLAYER_HEIGHT.
 */
function raycastPlayer(origin, dir, playerFeet) {
  const r = C.PLAYER_RADIUS;
  const h = C.PLAYER_HEIGHT;
  const min = { x: playerFeet.x - r, y: playerFeet.y,     z: playerFeet.z - r };
  const max = { x: playerFeet.x + r, y: playerFeet.y + h, z: playerFeet.z + r };
  return rayAABB(origin, dir, min, max);
}

/** Normalize a 3-vector in place and return it. */
function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  v.x /= len; v.y /= len; v.z /= len;
  return v;
}

module.exports = { randomSpawn, rayAABB, raycastPlayer, normalize };
