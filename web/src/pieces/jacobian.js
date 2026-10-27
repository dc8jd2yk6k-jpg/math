// 2026.07 · the Jacobian conjecture. Alpöge's map F: ℂ³ → ℂ³ (found with
// Claude) has Jacobian determinant −2 everywhere, yet sends three different
// points to the same place. Here it acts on a grid of real points: the grid
// flows from p to F(p) (drawn through a radial squash ψ so the degree-7
// growth stays on screen) and the three points meet on the downbeat.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { jacobianF, JACOBIAN_COLLIDE } from '../data.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, ease, smoothstep, wrap } from '../time.js';

const S = 2.4;           // world units per unit
const R = 3.2;           // squash radius
const psi = (q) => {
  const r = Math.hypot(q[0], q[1], q[2]);
  if (r < 1e-9) return q;
  const k = R * Math.tanh(r / R) / r;
  return [q[0] * k, q[1] * k, q[2] * k];
};

export class Jacobian extends Piece {
  constructor() {
    super('jacobian', { appearS: S_OF.jacobian - 25, window: WINDOWS.jacobian });
    this.O = L.jacobian.center.clone().add(new THREE.Vector3(0, -2, 0));     // the common image sits on the line
    this.center = this.O.clone().add(new THREE.Vector3(0, 9, 0));
    // grid lines in the domain, with the three special points inside
    const xs = [-1.2, 0, 1.2], ys = [-1.6, 0, 1.6], zs = [-0.5, 1.5, 3.5, 5.5, 7];
    const lines = [];
    const n = 20;
    const lin = (a, b) => Array.from({ length: n + 1 }, (_, i) => a.map((v, k) => v + (b[k] - v) * i / n));
    for (const y of ys) for (const z of zs) lines.push(lin([-1.2, y, z], [1.2, y, z]));
    for (const x of xs) for (const z of zs) lines.push(lin([x, -1.6, z], [x, 1.6, z]));
    for (const x of xs) for (const y of ys) lines.push(lin([x, y, -0.5], [x, y, 7]));
    this.src = lines.flat();
    this.img = this.src.map((p) => jacobianF(...p));
    const segs = [];
    let idx = 0;
    for (const l of lines) {
      for (let i = 0; i < l.length - 1; i++) segs.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), k0: 0, k1: 0, color: [0.82, 0.86, 1.0], alpha: 0.45, width: 1.1, i0: idx + i, i1: idx + i + 1 });
      idx += l.length;
    }
    this.segs = segs;
    this.lines = new Lines(segs.map((s) => ({ ...s })), { blending: THREE.AdditiveBlending });
    this.root.add(this.lines.mesh);
    // the three points that collide
    this.three = JACOBIAN_COLLIDE.map((p) => ({ p, F: jacobianF(...p) }));
    this.dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.PointsMaterial({ size: 11, sizeAttenuation: false, color: new THREE.Color(2.4, 0.5, 0.35), transparent: true, depthWrite: false }));
    this.root.add(this.dots);
    this.lastT = -1;
  }

  world(q, out = new THREE.Vector3()) {
    const s = psi([q[0] + 0.25, q[1], q[2]]);
    return out.set(this.O.x + s[0] * S, this.O.y + s[2] * S, this.O.z + s[1] * S);
  }

  morph(b) {
    b = wrap(b);
    if (b >= 38 || b < 3) return 1;
    if (b < 20.0) return 0;
    return ease.inOutCubic(clamp((b - 20.35) / 0.65));
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 500);
    if (!this.root.visible) return;
    const t = this.morph(b);
    if (t !== this.lastT) {
      this.lastT = t;
      const pts = this.src.map((p, i) => this.world(p.map((v, k) => v + (this.img[i][k] - v) * t)));
      const ga = this.lines.geometry.attributes.pa, gb = this.lines.geometry.attributes.pb;
      this.segs.forEach((s, j) => {
        const a = pts[s.i0], c = pts[s.i1];
        for (let k = 0; k < 4; k++) { ga.setXYZ(j * 4 + k, a.x, a.y, a.z); gb.setXYZ(j * 4 + k, c.x, c.y, c.z); }
      });
      ga.needsUpdate = gb.needsUpdate = true;
      const dp = this.dots.geometry.attributes.position;
      this.three.forEach((o, i) => { const w = this.world(o.p.map((v, k) => v + (o.F[k] - v) * t)); dp.setXYZ(i, w.x, w.y, w.z); });
      dp.needsUpdate = true;
    }
    const pres = this.presence(ctx, 10);
    const draw = b >= 38 || b < 3 ? 1 : smoothstep(20.0, 20.3, b);
    const hit = b >= 21.0 && b < 22 ? Math.exp(-(b - 21.0) * 8) : 0;
    this.lines.set({ res: ctx.res, opacity: pres * draw, gain: 1.1 + 2.5 * hit });
    this.dots.material.opacity = pres * draw;
    this.dots.material.size = (11 + 16 * hit) * ctx.res.x / 1080;
  }

  labels(b) {
    b = wrap(b);
    const t = this.morph(b);
    const fade = 1 - smoothstep(21.85, 22.0, b);
    const out = [];
    const names = ['p₁', 'p₂', 'p₃'];
    this.three.forEach((o, i) => {
      const w = this.world(o.p.map((v, k) => v + (o.F[k] - v) * t));
      out.push({ p: w, text: names[i], style: 'serif', size: 28, dx: 12, dy: -8, alpha: smoothstep(20.1, 20.3, b) * (1 - smoothstep(20.85, 21.0, b)) * fade });
    });
    const img = this.world(this.three[0].F);
    out.push({ screen: [0.5, 0.82], text: 'F(p₁) = F(p₂) = F(p₃)', style: 'serif', size: 40, align: 'center', alpha: smoothstep(21.0, 21.15, b) * fade });
    out.push({ screen: [0.5, 0.82], text: 'det J ≡ −2 everywhere', style: 'serif', size: 36, align: 'center', dy: 48, alpha: smoothstep(21.2, 21.35, b) * fade, color: 'rgba(255,120,104,1)' });
    return out;
  }
}
