// The shot list: one continuous camera, keyed on the bar grid.
// az/el in degrees (az 0 = facing the chart from +z), dist in world units,
// ox/oy = where the focus sits on screen. 'head' follows the head.
import * as THREE from 'three';
import { L } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function shotKeys() {
  const K = [];
  const k = (b, o) => K.push({ b, ...o });

  // 0-1: inside the island (path mode, see film.js), then whip out to the head at the top
  k(0.0, { focus: L.percolation.center, kappa: 0, az: 30, el: 18, dist: 70, fov: 40, ox: 0, oy: 0 });
  k(0.95, { focus: 'head', az: 20, el: -4, dist: 70, fov: 42, oy: 0.25 });
  // 1-2: rewind, chasing the head back down the wall and along to 1950
  k(1.3, { focus: 'head', az: 10, el: -2, dist: 85, fov: 44, oy: 0.0 });
  k(1.65, { focus: 'head', az: -20, el: 6, dist: 70, fov: 44, oy: 0.0 });
  // 2: 1950, face-on in the rings
  k(1.95, { focus: 'head', az: 58, el: 10, dist: 15, fov: 38, ox: 0, oy: -0.05 });
  k(2.45, { focus: 'head', az: 50, el: 12, dist: 13, fov: 38, oy: -0.05 });
  // launch: swing behind and chase to 1997
  k(3.0, { focus: 'head', az: -35, el: 12, dist: 22, fov: 42, ox: 0.15, oy: -0.1 });
  k(3.6, { focus: 'head', az: -55, el: 9, dist: 26, fov: 46, ox: 0.1, oy: -0.05 });
  // 4-6: Deep Blue, low over the board
  k(3.95, { focus: L.deepblue.center, kappa: 0.15, az: -12, el: 13, dist: 17, fov: 36, ox: 0, oy: -0.28 });
  k(5.85, { focus: L.deepblue.center, kappa: 0.25, az: 8, el: 9, dist: 14.5, fov: 36, oy: -0.25 });
  // 6-9: AlphaGo, from above, then low by Move 37
  k(6.1, { focus: L.alphago.center, kappa: 0.0, az: -14, el: 58, dist: 36, fov: 38, ox: 0, oy: -0.22 });
  k(7.4, { focus: L.alphago.center, kappa: 0.0, az: -4, el: 50, dist: 31, fov: 38, oy: -0.22 });
  k(7.95, { focus: L.alphago.move37, kappa: 0.0, az: 12, el: 16, dist: 11, fov: 38, ox: -0.15, oy: -0.25 });
  k(8.9, { focus: L.alphago.move37, kappa: 0.15, az: 24, el: 11, dist: 9.5, fov: 38, ox: -0.15, oy: -0.2 });
  // 9-10: side-on as the curve bends upward
  k(9.35, { focus: 'head', az: 4, el: 2, dist: 70, fov: 42, ox: 0.1, oy: -0.15 });
  k(9.8, { focus: 'head', az: -8, el: 2, dist: 48, fov: 40, ox: 0, oy: -0.2 });
  // 10-14: the Lean card
  k(10.05, { focus: L.imo24.center, kappa: 0, az: -18, el: 4, dist: 50, fov: 38, oy: -0.2 });
  k(13.7, { focus: L.imo24.center, kappa: 0, az: 4, el: 2, dist: 44, fov: 38, oy: -0.2 });
  // 14-18: IMO 2025 P2 drawn around point A
  k(14.1, { focus: L.imo25.A.clone().add(V(5.2, 5.4, 0)), kappa: 0, az: -8, el: 2, dist: 66, fov: 38, oy: -0.22 });
  k(17.7, { focus: L.imo25.A.clone().add(V(5.2, 5.4, 0)), kappa: 0, az: 6, el: 1, dist: 58, fov: 38, oy: -0.22 });
  // 18-20: Erdős, from below
  k(18.1, { focus: L.erdos.center, kappa: 0.2, az: 14, el: -32, dist: 34, fov: 40, oy: -0.05 });
  k(19.8, { focus: L.erdos.center, kappa: 0.3, az: 38, el: -24, dist: 30, fov: 40, oy: -0.05 });
  // 20-22: Jacobian, orbiting the 3D warp
  k(20.1, { focus: L.jacobian.center, kappa: 0.1, az: 40, el: 16, dist: 34, fov: 40, oy: -0.1 });
  k(21.8, { focus: L.jacobian.center, kappa: 0.1, az: 95, el: 10, dist: 30, fov: 40, oy: -0.1 });
  // 22-26: rising under the island
  k(21.95, { focus: 'head', az: 30, el: -6, dist: 70, fov: 42, oy: -0.25 });
  k(22.4, { focus: L.percolation.center.clone().add(V(0, 6, 0)), kappa: 0, az: 10, el: 40, dist: 125, fov: 40, oy: -0.12 });
  k(25.5, { focus: L.percolation.center.clone().add(V(0, 6, 0)), kappa: 0, az: 55, el: 30, dist: 95, fov: 40, oy: -0.12 });
  // 26-29: inside (path mode); 29-29.5: out of the top, looking down at the disc
  k(29.1, { focus: L.percolation.center, kappa: 0, az: 30, el: 60, dist: 110, fov: 42, oy: 0 });
  k(29.45, { focus: 'head', az: 20, el: 30, dist: 70, fov: 42, oy: 0.1 });
  // 29.5-32: Navier–Stokes
  k(29.8, { focus: L.navier.center, kappa: 0.1, az: -32, el: 14, dist: 52, fov: 40, oy: -0.08 });
  k(31.45, { focus: L.navier.center, kappa: 0.1, az: -12, el: 8, dist: 40, fov: 40, oy: -0.08 });
  // 32-33: inside the swarm of manuscripts, looking up the wall
  k(31.95, { focus: 'head', az: 0, el: -62, dist: 40, fov: 50, oy: 0.1 });
  k(32.9, { focus: 'head', az: 30, el: -55, dist: 34, fov: 50, oy: 0.1 });
  // 33-34: Yang–Mills
  k(33.05, { focus: L.yangmills.center, kappa: 0.1, az: 45, el: 20, dist: 46, fov: 40, oy: -0.12 });
  k(33.9, { focus: L.yangmills.center, kappa: 0.1, az: 70, el: 14, dist: 40, fov: 40, oy: -0.12 });
  // 34-37.5: ETH, the tree
  k(34.1, { focus: L.eth.root.clone().add(V(0, 40, 0)), kappa: 0, az: 0, el: 4, dist: 190, fov: 42, oy: -0.3 });
  k(35.2, { focus: L.eth.center, kappa: 0, az: -8, el: 3, dist: 420, fov: 44, oy: -0.22 });
  k(36.2, { focus: L.eth.top, kappa: 0, az: 4, el: 0, dist: 300, fov: 42, oy: -0.05 });
  k(37.3, { focus: 'head', az: 8, el: 2, dist: 60, fov: 40, ox: -0.1, oy: 0.3 });
  // 37.5-38.5: credit, close on the head
  k(38.3, { focus: 'head', az: 12, el: 3, dist: 40, fov: 40, ox: -0.25, oy: 0.35 });
  // 38.5-40.5: the pull-back reveal
  k(39.35, { focus: V(384, 560, 0), kappa: 0, az: 2, el: 2, dist: 3300, fov: 36, ox: 0, oy: 0 });
  k(40.35, { focus: V(390, 570, 0), kappa: 0, az: 5, el: 3, dist: 3150, fov: 36, oy: 0 });
  // 40.5-42: fly to the island and dive in (handed to path mode at the end)
  k(41.3, { focus: L.percolation.center, kappa: 0, az: 25, el: 22, dist: 160, fov: 42, oy: 0 });
  k(41.75, { focus: L.percolation.center, kappa: 0, az: 30, el: 18, dist: 70, fov: 40, oy: 0 });
  return K;
}
