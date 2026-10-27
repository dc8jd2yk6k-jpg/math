import * as THREE from 'three';
import { frameAt, spineAt, headAt } from '../curve.js';
import { setUniforms } from '../gfx/glow.js';
import { envelope } from '../util.js';

// world anchors for set pieces and camera moves
export function computeAnchors() {
  const off = (b, t, n, z) => {
    const f = frameAt(b);
    return f.S.clone().addScaledVector(f.T, t).addScaledVector(f.N, n).addScaledVector(f.Z, z);
  };
  const A = {
    chess: off(2.0, 7, -13, 0),
    go: off(6.0, 9, -13, 0),
    imo: off(11.6, 0, 0, 0),
    erdos: off(16.6, 0, 0, -6.5),
    jacobian: off(18.6, 0, 1.5, 6.5),
    percolation: off(20.55, 0, 0, 0),
    navier: off(22.45, 0, 0.5, -6),
    papers: off(23.2, 0, 0, 0),
    yangmills: off(24.4, 0, 0, 5.5),
    finish: spineAt(26),
  };
  A.chartCenter = new THREE.Vector3(134, 128, 0);
  return A;
}

// basis matrix from a frame (columns T, N, Z) placed at origin `o`
export function frameMatrix(b, o) {
  const f = frameAt(b);
  const m = new THREE.Matrix4().makeBasis(f.T, f.N, f.Z);
  m.setPosition(o);
  return m;
}

export class Piece {
  constructor(b0, b1, fi = 0.25, fo = 0.5) {
    this.root = new THREE.Group();
    this.b0 = b0; this.b1 = b1; this.fi = fi; this.fo = fo;
  }
  gain(b) { return envelope(b, this.b0, this.b1, this.fi, this.fo); }
  update(b, ctx) {
    const g = this.gain(b) * (ctx.pieceGain ?? 1);
    this.root.visible = g > 0.001;
    if (!this.root.visible) return false;
    setUniforms(this.root, { uTime: b, uPixel: ctx.pixelScale });
    this.g = g;
    return true;
  }
  setGain(obj, v) { setUniforms(obj, { uGain: v }); }
}
