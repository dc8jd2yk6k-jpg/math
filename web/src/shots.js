// The shot list: one continuous camera keyed on the bar grid.
// az/el in degrees (az 0 = facing the chart from +z), dist in world units,
// ox/oy = where the focus sits on screen, roll = Dutch tilt in degrees.
// 'head' follows the head. Designed flights (the island dive, the loop) are
// CameraPaths in pieces/percolation.js that start and end on these keys.
//
// Stop-and-orbit: at every milestone the head is parked (story.js HOLDS) and
// the camera performs a few beat-locked moves around it: establish, orbital
// pan, Dutch tilt, close-up sweep, then pull out and whip after the head.
import * as THREE from 'three';
import { L } from './layout.js';
import { construct, imo25World } from './pieces/imo25.js';
import { islandGeom } from './pieces/percolation.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const plus = (p, x, y, z) => p.clone().add(V(x, y, z));

export function shotKeys() {
  const K = [];
  const k = (b, o) => K.push({ b, roll: 0, ...o });
  const G = construct();

  const CB = L.deepblue.center, KING = plus(L.deepblue.king, 0, 0.9, 0);
  const CG = L.alphago.center, M37 = plus(L.alphago.move37, 0, 0.35, 0);
  const CC = L.imo24.center;
  const FC = imo25World({ x: 0.3, y: 1.05 }), TAN = imo25World(G.T);
  const EC = L.erdos.center, JC = L.jacobian.center, JI = plus(L.jacobian.center, 0, -2, 0);
  const PI = plus(L.percolation.center, 0, 6, 0);
  const GOLD = islandGeom().gold.c, NODE_P = L.percolation.node;
  const NSC = L.navier.center, YC = L.yangmills.center;

  // ---- 0–2. The loop path (pieces/percolation.js) glides over the island and
  // yanks back to this pose: the island floating in space (0.78). The head
  // streaks down the line into it (1.0) and the camera drops after it: a close
  // chase down the wall and along the flat, swinging round in front of the head
  // so it arrives head-on into Shannon's rings on the 1950 hit (2.0).
  k(0.7, { focus: PI, kappa: 0, az: 31, el: 18, dist: 166, fov: 40 });      // (inside the path; sets its exit velocity)
  k(0.78, { focus: PI, az: 31, el: 18, dist: 170, fov: 40 });
  k(0.93, { focus: PI, az: 27, el: 13, dist: 182, fov: 40 });
  k(1.06, { focus: 'head', kappa: 0.75, az: 20, el: 2, dist: 80, fov: 44 });
  k(1.2, { focus: 'head', kappa: 1, az: 12, el: -2, dist: 50, fov: 48 });
  k(1.38, { focus: 'head', az: 0, el: 2, dist: 42, fov: 50 });
  k(1.55, { focus: 'head', az: -20, el: 5, dist: 48, fov: 50 });
  k(1.72, { focus: 'head', az: -42, el: 6, dist: 50, fov: 48 });
  k(1.88, { focus: 'head', az: -68, el: 6, dist: 40, fov: 44 });
  // ---- 2–2.5: 1950. Head-on in the rings, a slow Dutch drift
  k(2.0, { focus: 'head', az: -82, el: 6, dist: 14.5, fov: 38 });
  k(2.3, { focus: 'head', az: -72, el: 9, dist: 13.5, roll: -8 });
  k(2.5, { focus: 'head', az: -62, el: 10, dist: 13, roll: 0 });
  // the head departs: swing behind it and chase it along the flat to 1997
  k(2.85, { focus: 'head', az: -30, el: 12, dist: 22, fov: 42, ox: 0.15, oy: -0.1 });
  k(3.5, { focus: 'head', az: -55, el: 9, dist: 26, fov: 46, ox: 0.1, oy: -0.05 });
  k(3.85, { focus: 'head', az: -30, el: 11, dist: 20, fov: 40, ox: 0, oy: -0.1 });
  // ---- 4–5.75: Deep Blue. Low frontal, slow orbit and dolly, close on the king as it tips, pull out
  k(4.0, { focus: plus(CB, 0, 1.2, -1.5), kappa: 0, az: -12, el: 13, dist: 19, fov: 36, oy: -0.2 });
  k(4.85, { focus: plus(CB, 0, 1.2, -1.5), az: 10, el: 11, dist: 15.5 });
  k(5.05, { focus: KING, az: 18, el: 16, dist: 8.5, roll: -7 });
  k(5.45, { focus: KING, az: 30, el: 14, dist: 8, roll: -5 });
  k(5.7, { focus: L.deepblue.node, kappa: 0.5, az: 20, el: 26, dist: 26, roll: 0 });
  // 5.75–6: ride out wide with the head, then drop onto the Go board as it lands
  k(5.87, { focus: 'head', kappa: 1, az: 8, el: 34, dist: 64, fov: 40 });
  // ---- 6–8.875: AlphaGo, beat for beat after the reference
  k(6.0, { focus: plus(CG, 0, 0, -0.8), kappa: 0, az: 0, el: 64, dist: 32, fov: 38, oy: -0.12 });   // high frontal: stones land
  k(6.95, { focus: plus(CG, 0, 0, -0.8), az: 2, el: 60, dist: 30 });
  k(7.55, { focus: CG, az: -22, el: 36, dist: 22, roll: -12 });                                       // orbital pan + Dutch tilt
  k(7.95, { focus: M37, az: -8, el: 9, dist: 9.5, roll: -4 });                                        // close-up sweep to board height
  k(8.45, { focus: M37, az: 14, el: 7, dist: 8.5, roll: 0 });                                         // Move 37: low lateral sweep
  k(8.75, { focus: M37, az: 26, el: 14, dist: 12, roll: 2 });
  k(8.86, { focus: L.alphago.node, kappa: 0.4, az: 18, el: 24, dist: 26, roll: 0 });                 // pull up, hand to the head
  // 2016 → 2024: side-on as the curve bends upward
  k(9.35, { focus: 'head', az: 4, el: 2, dist: 70, fov: 42, ox: 0.1, oy: -0.15 });
  k(9.8, { focus: 'head', az: -8, el: 2, dist: 48, fov: 40, ox: 0, oy: -0.2 });
  // ---- 10–13.75: the Lean card. Push in, the scores with a tilt, the compute clock
  k(10.0, { focus: CC, kappa: 0, az: -18, el: 4, dist: 52, fov: 38, oy: -0.2 });
  k(11.4, { focus: CC, az: -6, el: 3, dist: 44 });
  k(12.2, { focus: plus(CC, 0, 1.5, 0), az: 4, el: 2, dist: 34, roll: 5 });
  k(13.2, { focus: plus(CC, -1.5, -2.5, 0), az: 10, el: 1, dist: 30, roll: 0 });
  k(13.7, { focus: L.imo24.head, kappa: 0.3, az: 6, el: 0, dist: 44 });
  // ---- 14–17.75: IMO 2025 P2. Establish, sweep in to the tangent at ■ (bar 16), drift out with a tilt
  k(14.0, { focus: FC, kappa: 0, az: -8, el: 2, dist: 66, fov: 38, oy: -0.22 });
  k(15.4, { focus: FC, az: 0, el: 2, dist: 60 });
  k(16.0, { focus: TAN, az: 10, el: 4, dist: 32, roll: 6 });
  k(16.8, { focus: FC, az: 4, el: 2, dist: 50, roll: 0 });
  k(17.55, { focus: FC, az: -6, el: 3, dist: 58, roll: -6 });
  k(17.74, { focus: L.imo25.A, kappa: 0.3, az: -4, el: 4, dist: 50, roll: 0 });
  // ---- 18–19.75: Erdős, a rising quarter orbit from below
  k(18.0, { focus: EC, kappa: 0, az: 14, el: -34, dist: 36, fov: 40, oy: -0.05 });
  k(19.0, { focus: EC, az: 60, el: -26, dist: 32, roll: 8 });
  k(19.7, { focus: EC, az: 104, el: -18, dist: 30, roll: 0 });
  // ---- 20–21.75: Jacobian, orbit, then push in on the collision (bar 21)
  k(20.0, { focus: JC, kappa: 0, az: 40, el: 16, dist: 36, fov: 40, oy: -0.1 });
  k(20.85, { focus: JI, az: 75, el: 10, dist: 20, roll: -8 });
  k(21.15, { focus: JI, az: 90, el: 8, dist: 16, roll: -4 });
  k(21.7, { focus: JC, az: 125, el: 12, dist: 30, roll: 0 });
  // ---- 22–25.5: percolation, a high orbit above the island while p rises to p_c
  k(21.95, { focus: 'head', az: 110, el: 14, dist: 60, fov: 42 });
  k(22.4, { focus: PI, kappa: 0, az: 10, el: 40, dist: 125, fov: 40, oy: -0.12 });
  k(24.0, { focus: PI, az: 32, el: 35, dist: 110, roll: 4 });
  k(25.5, { focus: PI, az: 55, el: 30, dist: 95, roll: 0 });
  // 25.5–27.6: drop to the largest cluster and orbit it from outside the canopy,
  // look locked on it, while every other tree sinks back: it is finite, it ends.
  k(25.75, { focus: GOLD, az: 50, el: 31, dist: 72, fov: 42, oy: -0.05 });
  k(26.0, { focus: GOLD, az: 40, el: 30, dist: 60, fov: 42, oy: -0.05 });
  k(26.5, { focus: GOLD, az: 15, el: 28, dist: 56, roll: 4 });
  k(27.0, { focus: GOLD, az: -15, el: 27, dist: 54, roll: 0 });
  k(27.5, { focus: GOLD, az: -45, el: 26, dist: 52, roll: -4 });
  // 27.6–28.75: swing over to the parked head, hovering just above the canopy,
  // and push in on it; the line rises out of it into the sky
  // and push in on it, looking down so it glows against the canopy
  k(27.85, { focus: plus(NODE_P, 0, 1, 0), az: -35, el: 30, dist: 26, fov: 44, oy: 0, roll: 0 });
  k(28.35, { focus: NODE_P, az: -22, el: 24, dist: 18, oy: 0.05 });
  // 28.75–29.35: lift off with the head (the camera tilts up after it) as the sky
  // turns to space, then whip to the vortex
  k(28.75, { focus: 'head', kappa: 1, az: -14, el: 14, dist: 20, oy: 0 });
  k(29.1, { focus: 'head', az: -10, el: -8, dist: 30, fov: 46, oy: 0 });
  k(29.35, { focus: NSC, kappa: 0.3, az: -32, el: 14, dist: 52, fov: 40, oy: -0.08 });
  // ---- 29.5–31.625: Navier–Stokes. Push in as the tube tightens; the burst throws us back
  k(29.5, { focus: NSC, kappa: 0.1, az: -32, el: 14, dist: 52, fov: 40, oy: -0.08 });
  k(31.4, { focus: NSC, az: -12, el: 8, dist: 36, roll: -5 });
  k(31.5, { focus: NSC, az: -10, el: 8, dist: 35, roll: -5 });
  k(31.62, { focus: NSC, az: -6, el: 12, dist: 62, roll: 0 });
  // ---- 32–32.75: 722 manuscripts, looking up the wall through the pages, rolling
  k(31.95, { focus: 'head', az: 0, el: -62, dist: 40, fov: 50, oy: 0.1, roll: 0 });
  k(32.7, { focus: 'head', az: 30, el: -55, dist: 34, fov: 50, oy: 0.1, roll: 24 });
  // ---- 33–33.75: Yang–Mills, an orbit around the lattice
  k(33.0, { focus: YC, kappa: 0.1, az: 45, el: 20, dist: 46, fov: 40, oy: -0.12, roll: 0 });
  k(33.7, { focus: YC, az: 118, el: 14, dist: 40, roll: 10 });
  // ---- 34–37.5: ETH, crane up with the two lab heads; the fold; close on the head
  k(34.0, { focus: plus(L.eth.root, 0, 40, 0), kappa: 0, az: 0, el: 4, dist: 190, fov: 42, oy: -0.3, roll: 0 });
  k(35.2, { focus: L.eth.center, az: -8, el: 3, dist: 420, fov: 44, oy: -0.22 });
  k(36.2, { focus: L.eth.top, az: 4, el: 0, dist: 300, fov: 42, oy: -0.05 });
  k(37.3, { focus: 'head', az: 8, el: 2, dist: 60, fov: 40, ox: -0.1, oy: 0.3 });
  // ---- 37.5–38.5: credit, a slow tilted drift on the head
  k(38.3, { focus: 'head', az: 14, el: 3, dist: 40, fov: 40, ox: -0.25, oy: 0.35, roll: 6 });
  // ---- 38.5–40.5: the pull-back reveal; the loop path takes over at 40.5
  k(39.35, { focus: V(384, 560, 0), kappa: 0, az: 2, el: 2, dist: 3300, fov: 36, ox: 0, oy: 0, roll: 0 });
  k(40.5, { focus: V(390, 570, 0), kappa: 0, az: 5, el: 3, dist: 3150, fov: 36 });
  return K;
}
