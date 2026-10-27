// 2025.07 · IMO gold. Problem 2, constructed exactly and drawn stroke by stroke
// on the eighth notes: circles Ω and Γ, the line CMND, P the circumcentre of
// ACD, line AP meeting Ω at E and Γ at F, H the orthocentre of PMN, the circle
// BEF, and finally the line through H parallel to AP: tangent to it. ■
import * as THREE from 'three';
import { Piece } from './piece.js';
import { Lines } from '../gfx/lines.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, smoothstep, wrap } from '../time.js';

const v2 = (x, y) => ({ x, y });
const sub = (a, b) => v2(a.x - b.x, a.y - b.y);
const add = (a, b) => v2(a.x + b.x, a.y + b.y);
const mul = (a, k) => v2(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;

function circumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
  const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
  return v2(ux, uy);
}
// second intersection of the line through a (direction v) with circle (o, r)
const secondHit = (a, v, o) => add(a, mul(v, -2 * dot(sub(a, o), v) / dot(v, v)));

export function construct() {
  const r = 1, R = 1.5, d = 1.6;
  const M = v2(0, 0), N = v2(0, d), C = v2(0, -r), D = v2(0, d + R);
  const ya = (d * d + r * r - R * R) / (2 * d), xa = Math.sqrt(r * r - ya * ya);
  const A = v2(-xa, ya), B = v2(xa, ya);
  const P = circumcenter(A, C, D);
  const v = sub(P, A);
  const E = secondHit(A, v, M), F = secondHit(A, v, N);
  // orthocentre of PMN: MN is vertical, so the altitude from P is horizontal;
  // it meets the altitude from M (perpendicular to PN) where X·(N − P) = 0
  const PN = sub(N, P);
  const H = v2(-P.y * PN.y / PN.x, P.y);
  const O = circumcenter(B, E, F), rO = Math.hypot(B.x - O.x, B.y - O.y);
  // tangency check: distance from O to the line through H parallel to AP equals rO
  const n = v2(-v.y, v.x), nl = Math.hypot(n.x, n.y);
  const err = Math.abs(Math.abs(dot(sub(O, H), n) / nl) - rO);
  const T = sub(O, mul(n, dot(sub(O, H), n) / nl / nl));        // the tangency point
  return { r, R, M, N, C, D, A, B, P, E, F, H, O, rO, v, T, err };
}

// figure frame in the world: the line CMND is vertical and A sits exactly on
// the parked head
export const IMO25_SCALE = 5.6;
export function imo25World(p, z = 0) {
  const G = construct(), A3 = L.imo25.A;
  return new THREE.Vector3(A3.x + (p.x - G.A.x) * IMO25_SCALE, A3.y + (p.y - G.A.y) * IMO25_SCALE, z);
}

export class Geometry extends Piece {
  constructor() {
    super('imo25', { appearS: S_OF.imo25 - 30, window: WINDOWS.imo25 });
    const G = this.G = construct();
    this.to3 = (p, z = 0) => imo25World(p, z);
    const P = (p) => this.to3(p);
    this.center = P(v2(0.4, 1.0));
    const segs = [];
    let k = 0;
    const circle = (o, rr, dk, col = [1, 0.86, 0.9], width = 1.4, alpha = 0.8, a0 = Math.PI / 2) => {
      const n = 120;
      for (let i = 0; i < n; i++) {
        const t0 = a0 + i / n * Math.PI * 2, t1 = a0 + (i + 1) / n * Math.PI * 2;
        segs.push({ a: P(add(o, v2(Math.cos(t0) * rr, Math.sin(t0) * rr))), b: P(add(o, v2(Math.cos(t1) * rr, Math.sin(t1) * rr))),
          k0: k + dk * i / n, k1: k + dk * (i + 1) / n, color: col, alpha, width });
      }
      k += dk;
    };
    const seg = (a, b, dk, col = [1, 1, 1], width = 1.2, alpha = 0.7) => { segs.push({ a: P(a), b: P(b), k0: k, k1: k + dk, color: col, alpha, width }); k += dk; };
    const ext = (a, b, t0, t1) => [add(a, mul(sub(b, a), t0)), add(a, mul(sub(b, a), t1))];
    // the order of construction (one key unit = one eighth note)
    circle(G.M, G.r, 3);                                     // Ω
    circle(G.N, G.R, 3);                                     // Γ
    seg(G.C, G.D, 1.5);                                      // line C M N D
    seg(G.A, G.C, 0.75, [1, 1, 1], 1.0, 0.45); seg(G.A, G.D, 0.75, [1, 1, 1], 1.0, 0.45);
    this.kP = k;
    const [l0, l1] = ext(G.A, G.P, -0.12, 1.08);
    seg(l0, l1, 1.5);                                        // line A E F P
    seg(G.P, G.M, 0.5, [1, 1, 1], 1.0, 0.5); seg(G.P, G.N, 0.5, [1, 1, 1], 1.0, 0.5);
    seg(G.H, v2(G.P.x, G.P.y), 0.5, [1, 1, 1], 1.0, 0.35);  // altitude from P
    this.kH = k;
    circle(G.O, G.rO, 2.5, [1, 0.86, 0.9], 1.5, 0.85);      // circle BEF
    this.kT = k;
    const u = mul(G.v, 1 / Math.hypot(G.v.x, G.v.y));
    seg(add(G.H, mul(u, -0.55)), add(G.T, mul(u, 0.45)), 1.5, [1.0, 0.92, 0.82], 2.4, 1.0);   // the tangent
    this.kEnd = k;
    this.lines = new Lines(segs, { blending: THREE.AdditiveBlending });
    this.root.add(this.lines.mesh);
    // points
    const pts = ['A', 'B', 'C', 'D', 'M', 'N', 'P', 'E', 'F', 'H'];
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((n) => P(G[n])));
    this.dots = new THREE.Points(g, new THREE.PointsMaterial({ size: 6, sizeAttenuation: false, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, depthWrite: false }));
    this.root.add(this.dots);
    this.pointKeys = { A: 6, B: 6, C: 6, D: 6, M: 6, N: 6, P: this.kP, E: this.kP + 1, F: this.kP + 1.2, H: this.kH - 0.2 };
    console.log(`IMO 2025 P2: tangency error ${G.err.toExponential(2)}`);
  }

  reveal(b) {
    b = wrap(b);
    if (b >= 38 || b < 3) return 1e9;
    if (b < this.window[0]) return -1;
    return (b - 14.0) * 8;                    // eighth notes since bar 14
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 500);
    if (!this.root.visible) return;
    const pres = this.presence(ctx, 12);
    this.lines.set({ res: ctx.res, reveal: this.reveal(b), opacity: pres, gain: 1.3 + 1.2 * smoothstep(this.kT + 14 * 8 / 8, 0, 0) });
    this.dots.material.opacity = pres * clamp(this.reveal(b) / 6);
    this.dots.material.size = 6 * ctx.res.x / 1080;
  }

  labels(b) {
    b = wrap(b);
    const r = this.reveal(b);
    const out = [];
    const nm = { A: 'A', B: 'B', C: 'C', D: 'D', M: 'M', N: 'N', P: 'P', E: 'E', F: 'F', H: 'H' };
    const off = { A: [-26, 6], B: [12, 18], C: [10, 26], D: [10, -10], M: [12, 18], N: [12, -6], P: [12, -8], E: [-4, -14], F: [10, -12], H: [-6, -14] };
    const fade = 1 - smoothstep(17.85, 18.0, b);
    for (const [k, t] of Object.entries(this.pointKeys)) {
      out.push({ p: this.to3(this.G[k]), text: nm[k], style: 'serif', size: 26, dx: off[k][0], dy: off[k][1], alpha: clamp((r - t) / 1.5) * fade });
    }
    out.push({ p: this.to3(add(this.G.M, v2(-0.62, -0.55))), text: 'Ω', style: 'serif', size: 30, alpha: clamp(r / 2) * fade });
    out.push({ p: this.to3(add(this.G.N, v2(-1.32, 0.95))), text: 'Γ', style: 'serif', size: 30, alpha: clamp((r - 3) / 2) * fade });
    out.push({ p: this.to3(this.G.T), text: '■', style: 'mathUp', size: 26, dx: 16, dy: -10, alpha: clamp((r - this.kEnd) / 1) * fade });
    return out;
  }
}
