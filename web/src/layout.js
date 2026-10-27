// Where each set piece sits relative to the line. Pieces, the shot list and
// the clearance check all read these, so a piece can move without the camera
// losing it and without the line ever passing through anything solid.
import * as THREE from 'three';
import { posAtS, S_OF } from './curve.js';
import { NODE } from './story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const node = (id, dx = 0, dy = 0, dz = 0) => posAtS(NODE[id]).add(V(dx, dy, dz));

// Boards stand entirely in front of the line (+z): the line runs behind their
// far edge and the parked head hovers just above it, as in the reference.
const CHESS_HALF = 5.55, GO_HALF = 6.13;
export const L = {
  shannon: { center: node('shannon') },
  deepblue: { node: node('deepblue'), center: node('deepblue', 0, -2.0, 1.05 + CHESS_HALF), half: CHESS_HALF },
  alphago: { node: node('alphago'), center: node('alphago', 0, -1.0, 1.2 + GO_HALF), half: GO_HALF },
  imo24: { head: node('imo24'), center: null },
  imo25: { A: node('imo25') },
  erdos: { center: node('erdos') },
  jacobian: { center: posAtS(S_OF.jacobian).add(V(0, 2, 0)) },
  percolation: { center: posAtS(S_OF.percolation), node: node('percolation') },
  navier: { center: node('navier', 0, 1, 0) },
  papers: { center: node('papers', 0, 6, 0) },
  yangmills: { center: node('yangmills', 0, 1, 0) },
  eth: { root: node('eth'), top: posAtS(NODE.top) },
};
// the Lean card stands just above the parked head (which sits in its input line)
L.imo24.center = L.imo24.head.clone().add(V(0, 7.2, 0));
L.eth.center = L.eth.root.clone().lerp(L.eth.top, 0.5);
L.alphago.move37 = L.alphago.center.clone().add(V(3.1, 0, 0));        // GO_MOVES[36] = B (14, 9)
L.deepblue.king = L.deepblue.center.clone().add(V(-1.875, 0, -4.375)); // black king on c8

// Solid volumes the line must never enter (checked by tools/check_clearance.mjs)
const box = (name, c, hx, y0, y1, hz) => ({ name, min: V(c.x - hx, c.y + y0, c.z - hz), max: V(c.x + hx, c.y + y1, c.z + hz) });
export const SOLIDS = [
  box('chess board', L.deepblue.center, CHESS_HALF, -0.5, 0, CHESS_HALF),
  box('chess pieces', L.deepblue.center, 5.0, 0, 2.0, 5.0),
  box('go board', L.alphago.center, GO_HALF, -1.6, 0, GO_HALF),
  box('go stones', L.alphago.center, GO_HALF, 0, 0.35, GO_HALF),
];
