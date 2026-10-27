// 2026.10.26 · 4D Yang–Mills. A hypercubic lattice (the setting of lattice
// gauge theory) turning through the fourth dimension, projected into 3D; the
// links pulse like a field. Existence is what OpenAI claims; the mass gap is not.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { BAR, smoothstep, wrap } from '../time.js';

const S = 5.0;
const HUES = [[0.95, 0.96, 1.0], [0.7, 0.82, 1.0], [0.86, 0.74, 1.0], [1.0, 0.86, 0.7]];

export class YangMills extends Piece {
  constructor() {
    super('yangmills', { appearS: S_OF.yangmills - 40, window: WINDOWS.yangmills });
    this.center = L.yangmills.center;
    const v = [-1, 0, 1];
    this.edges = [];
    for (const x of v) for (const y of v) for (const z of v) for (const w of v) {
      const p = [x, y, z, w];
      for (let d = 0; d < 4; d++) if (p[d] < 1) { const q = [...p]; q[d] += 1; this.edges.push([p, q, d]); }
    }
    this.lines = new Lines(this.edges.map(([, , d]) => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), color: HUES[d], alpha: 0.75, width: 1.4 })), { blending: THREE.AdditiveBlending });
    this.root.add(this.lines.mesh);
  }

  project(p, t, out) {
    // rotate in the xw and zw planes, then perspective-project from 4D to 3D
    let [x, y, z, w] = p;
    const a = t * 0.9, c = t * 0.55;
    [x, w] = [x * Math.cos(a) - w * Math.sin(a), x * Math.sin(a) + w * Math.cos(a)];
    [z, w] = [z * Math.cos(c) - w * Math.sin(c), z * Math.sin(c) + w * Math.cos(c)];
    const k = 3 / (3.4 - w);
    return out.set(this.center.x + x * k * S, this.center.y + y * k * S, this.center.z + z * k * S);
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 400);
    if (!this.root.visible) return;
    const t = (b - 33) * BAR + 2;
    const ga = this.lines.geometry.attributes.pa, gb = this.lines.geometry.attributes.pb;
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    this.edges.forEach(([p, q], j) => {
      this.project(p, t, A); this.project(q, t, B);
      for (let k = 0; k < 4; k++) { ga.setXYZ(j * 4 + k, A.x, A.y, A.z); gb.setXYZ(j * 4 + k, B.x, B.y, B.z); }
    });
    ga.needsUpdate = gb.needsUpdate = true;
    const on = b >= 32.95 && b < 34.2 ? smoothstep(32.95, 33.1, b) : 0.6;
    this.lines.set({ res: ctx.res, opacity: on * this.presence(ctx, 10), gain: 1.3 + 0.6 * Math.sin(t * 6) ** 2 });
  }

  labels(b) {
    b = wrap(b);
    const a = smoothstep(33.15, 33.3, b) * (1 - smoothstep(33.85, 33.95, b));
    const C = this.center;
    return [
      { p: C.clone().add(new THREE.Vector3(14, -10, 0)), text: 'ℝ⁴ · gauge field', style: 'serif', size: 32, alpha: a },
      { p: C.clone().add(new THREE.Vector3(14, -10, 0)), text: 'existence claimed · mass gap not claimed', style: 'label', size: 18, alpha: a * 0.85, dy: 28, color: 'rgba(200,202,214,1)' },
    ];
  }
}
