// Where each set piece sits on the line. Pieces and the shot list both read
// these, so a piece can move without the camera losing it.
import * as THREE from 'three';
import { posAtS, S_OF } from './curve.js';
import { HEAD_KEYS } from './story.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (s, dx = 0, dy = 0, dz = 0) => posAtS(s).add(V(dx, dy, dz));
const S = S_OF;

// the head's arc position during each dwell (the key that opens the dwell)
const keyS = (b) => HEAD_KEYS.find((k) => Math.abs(k[0] - b) < 1e-6)[1];

export const L = {
  shannon: { center: at(0) },
  deepblue: { center: at(S.deepblue, 0, -2.4, 3.4), size: 10 },
  alphago: { center: at(S.alphago, 0, -1.1, 4.4), size: 12 },  // Move 37 sits at center + (3.1, 0, 0)
  imo24: { head: at(keyS(10.0) + 0.4), center: null, size: [13, 17] },
  imo25: { A: at(keyS(14.05) + 1.5) },
  erdos: { center: at(S.erdos) },
  jacobian: { center: at(S.jacobian, 0, 2, 0) },
  percolation: { center: at(S.percolation) },
  navier: { center: at(S.navier, 0, 1, 0) },
  papers: { center: at(S.papers, 0, 6, 0) },
  yangmills: { center: at(S.yangmills, 0, 1, 0) },
  eth: { root: at(S.yangmills + 8), top: at(S_OF.eth) },
};
// the Lean card stands just above the head's dwell point (the head sits in its input line)
L.imo24.center = L.imo24.head.clone().add(V(0, 7.2, 0));
L.eth.center = L.eth.root.clone().lerp(L.eth.top, 0.5);
L.alphago.move37 = L.alphago.center.clone().add(V(3.1, 0, 0));
