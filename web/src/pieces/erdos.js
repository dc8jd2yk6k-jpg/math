// 2026.05 · Erdős unit distances. Erdős's own lower-bound construction: a
// square grid, scaled so that the most common distance (here 5, which is
// 3-4-5 in four ways) is the unit. Edges bloom outward from the line. The
// 2026 counterexample beats this family by a polynomial factor, n^{1+δ}.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, smoothstep, wrap } from '../time.js';

const K = 15, A = 1.05;   // grid size, spacing
const DIRS = [[5, 0], [0, 5], [3, 4], [4, 3], [3, -4], [4, -3]];

export class Erdos extends Piece {
  constructor() {
    super('erdos', { appearS: S_OF.erdos - 25, window: WINDOWS.erdos });
    const C = this.center = L.erdos.center;
    const P = (i, j) => new THREE.Vector3(C.x + (i - (K - 1) / 2) * A, C.y, C.z + (j - (K - 1) / 2) * A);
    const segs = [];
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) for (const [di, dj] of DIRS) {
      const i2 = i + di, j2 = j + dj;
      if (i2 < 0 || j2 < 0 || i2 >= K || j2 >= K) continue;
      const a = P(i, j), b = P(i2, j2);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const r = Math.hypot(mid.x - C.x, mid.z - C.z);
      segs.push({ a, b, k0: r, k1: r + 2.5, color: [1, 1, 1], alpha: 0.3, width: 1.0 });
    }
    this.nEdges = segs.length;
    this.lines = new Lines(segs, { blending: THREE.AdditiveBlending });
    this.root.add(this.lines.mesh);
    const pts = [];
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) pts.push(P(i, j));
    this.dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, color: new THREE.Color(1.7, 1.7, 1.7), transparent: true, depthWrite: false }));
    this.root.add(this.dots);
    this.rMax = Math.hypot((K - 1) / 2 * A, (K - 1) / 2 * A) + 2.5;
  }

  reveal(b) {
    b = wrap(b);
    if (b >= 38 || b < 3) return 1e9;            // complete in the opening / rewind and after
    if (b < this.window[0]) return -1;
    return smoothstep(18.25, 19.4, b) * this.rMax;
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 500);
    if (!this.root.visible) return;
    const pres = this.presence(ctx, 10);
    this.lines.set({ res: ctx.res, reveal: this.reveal(b), opacity: pres, gain: 0.95 });
    this.dots.material.opacity = pres * (b >= 38 || b < 3 ? 1 : smoothstep(18.0, 18.2, b));
    this.dots.material.size = 5 * ctx.res.x / 1080;
  }

  labels(b) {
    b = wrap(b);
    const C = this.center;
    const a = smoothstep(19.0, 19.2, b) * (1 - smoothstep(19.85, 20.0, b));
    const a0 = smoothstep(18.4, 18.6, b) * (1 - smoothstep(19.85, 20.0, b));
    return [
      { screen: [0.5, 0.80], text: 'Erdős grid, 1946', style: 'serif', size: 34, align: 'center', alpha: a0 },
      { screen: [0.5, 0.80], text: `${K * K} points · ${this.nEdges} unit distances`, style: 'label', size: 20, align: 'center', dy: 32, alpha: a0 * 0.9, color: 'rgba(205,207,218,1)' },
      { screen: [0.5, 0.80], text: 'beaten: n^{1+δ}', style: 'serif', size: 44, align: 'center', dy: 92, alpha: a, color: 'rgba(255,120,104,1)' },
    ];
  }
}
