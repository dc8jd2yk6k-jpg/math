// 2024 · IMO silver: a glass card types the Lean 4 statement of P1 while a
// compute clock runs toward 72 hours, the constraint of that system.
// 2025 · IMO gold: the construction of IMO 2025 Problem 2, drawn stroke by
// stroke: Ω, Γ, A–F, P, H, and the tangent line the problem asks to prove.
import * as THREE from 'three';
import { Piece, WHITE, DIM } from './common.js';
import { makeSegments, makePoints } from '../gfx/glow.js';
import { frameAt, spineAt } from '../curve.js';
import { IMO24 } from '../data.js';
import { clamp, ease } from '../util.js';
import { FONTS } from '../hud/text.js';

const LEAN = [
  ['kw', 'theorem '], ['id', 'imo2024_p1'], ['tx', ' :'], ['nl'],
  ['tx', '  {α : ℝ | ∀ n : ℕ, 0 < n →'], ['nl'],
  ['tx', '    (n : ℤ) ∣ ∑ i ∈ Finset.Icc 1 n, ⌊i * α⌋}'], ['nl'],
  ['tx', '  = {α : ℝ | ∃ k : ℤ, Even k ∧ α = k} := '], ['kw', 'by'],
];

export class LeanCard extends Piece {
  constructor() {
    super(9.8, 14.0, 0.3, 0.25);
    const f = frameAt(11.8);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024; this.canvas.height = 700;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.premultiplyAlpha = true;
    this.tex.anisotropy = 8;
    const w = 9.2, h = w * 700 / 1024;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex }, uGain: { value: 1 }, uTime: { value: 0 }, uPixel: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float uGain; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); c.rgb = pow(max(c.rgb, 0.0) / max(c.a, 1e-4), vec3(2.2)) * c.a; gl_FragColor = c * uGain; }',
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.mesh.frustumCulled = false;
    const c = spineAt(12.0).addScaledVector(f.U, -2.0).addScaledVector(f.R, 0.2).addScaledVector(f.F, -1.0);
    const yaw = new THREE.Quaternion().setFromAxisAngle(f.U, -0.16);
    const m = new THREE.Matrix4().makeBasis(f.R.clone().applyQuaternion(yaw), f.U, f.F.clone().applyQuaternion(yaw));
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrix.copy(m.setPosition(c));
    this.root.add(this.mesh);
    this.center = c.clone().addScaledVector(f.U, 1.5);
  }

  draw(b) {
    const ctx = this.ctx, W = 1024, H = 700;
    ctx.clearRect(0, 0, W, H);
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    rr(6, 6, W - 12, H - 12, 34);
    ctx.fillStyle = 'rgba(28,30,34,0.78)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = FONTS.inter(26, 500); ctx.fillStyle = 'rgba(210,214,222,0.75)';
    ctx.fillText('AlphaProof · Lean 4', 48, 70);
    ctx.textAlign = 'right'; ctx.fillText('IMO 2024 · P1', W - 48, 70); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(48, 96, W - 96, 2);
    // typed Lean statement
    const total = LEAN.reduce((a, t) => a + (t[1] ? t[1].length : 0), 0);
    let left = Math.floor(clamp((b - 10.15) / 1.1) * total);
    let x = 48, y = 158;
    ctx.font = FONTS.mono(27, 400);
    for (const [k, s] of LEAN) {
      if (k === 'nl') { x = 48; y += 50; continue; }
      if (left <= 0) break;
      const part = s.slice(0, left); left -= s.length;
      ctx.fillStyle = k === 'kw' ? '#ffffff' : k === 'id' ? '#e6e8ee' : 'rgba(205,210,220,0.86)';
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    }
    if (left <= 0 && Math.floor(b * 4) % 2 === 0 && b < 11.6) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y - 24, 14, 30); }
    // compute clock: up to 72 hours per problem
    const hrs = 72 * ease.inOutSine(clamp((b - 10.6) / 3.0));
    const hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60), ss = Math.floor(((hrs - hh) * 60 - mm) * 60);
    ctx.font = FONTS.inter(24, 500); ctx.fillStyle = 'rgba(210,214,222,0.7)';
    ctx.fillText('compute', 48, 452);
    ctx.font = FONTS.mono(54, 300); ctx.fillStyle = '#ffffff';
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 48, 516);
    ctx.font = FONTS.inter(24, 400); ctx.fillStyle = 'rgba(210,214,222,0.55)';
    ctx.fillText('humans get 4.5 hours', 48, 556);
    // problems P1..P6
    for (let i = 0; i < 6; i++) {
      const bx = 470 + i * 84, by = 430;
      const hit = 10.5 + [0, 0.25, 0, 0.5, 0, 0.75][i];
      const solved = IMO24[i] > 0 && b >= hit;
      ctx.strokeStyle = solved ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      rr(bx, by, 70, 70, 14); ctx.stroke();
      if (solved) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); }
      ctx.font = FONTS.inter(26, 600); ctx.textAlign = 'center';
      ctx.fillStyle = solved ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.fillText(`P${i + 1}`, bx + 35, by + 44);
      ctx.textAlign = 'left';
    }
    if (b > 11.5) {
      ctx.globalAlpha = clamp((b - 11.5) / 0.2);
      ctx.font = FONTS.inter(30, 600); ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
      ctx.fillText('28 / 42', W - 48, 556);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    this.tex.needsUpdate = true;
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.draw(b);
    this.mesh.material.uniforms.uGain.value = this.g;
  }
}

// ---------------------------------------------------------------- IMO 2025 P2
function circumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
  const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
  return new THREE.Vector2(ux, uy);
}

export function imo2025p2() {
  const V = (x, y) => new THREE.Vector2(x, y);
  const r = 1, d = 1.15, R = 1.5;
  const M = V(0, 0), N = V(d, 0);
  const xA = (d * d + r * r - R * R) / (2 * d), yA = Math.sqrt(r * r - xA * xA);
  const A = V(xA, yA), B = V(xA, -yA);
  const C = V(-r, 0), D = V(d + R, 0);
  const P = circumcenter(A, C, D);
  const v = P.clone().sub(A);
  const second = (O) => A.clone().addScaledVector(v, -2 * A.clone().sub(O).dot(v) / v.lengthSq());
  const E = second(M), F = second(N);
  // orthocentre of PMN: MN is horizontal, so one altitude is x = P.x
  const pn = N.clone().sub(P);
  const H = V(P.x, -(pn.x / pn.y) * P.x);
  const Q = circumcenter(B, E, F), rq = Q.distanceTo(B);
  const vn = v.clone().normalize();
  const T = H.clone().addScaledVector(vn, Q.clone().sub(H).dot(vn));   // foot of Q on the parallel through H
  return { r, R, d, M, N, A, B, C, D, P, E, F, H, Q, rq, T, v: vn, tangentError: Math.abs(Q.distanceTo(T) - rq) };
}

export class Geometry extends Piece {
  constructor() {
    super(13.85, 16.15, 0.2, 0.3);
    const g = imo2025p2();
    this.check = g.tangentError;   // ~1e-15: the construction really is tangent
    const f = frameAt(15.0);
    const s = 2.3;
    const origin = spineAt(15.0).addScaledVector(f.U, -2.5).addScaledVector(f.R, -1.9).addScaledVector(f.F, -2);
    const W = (p) => origin.clone().addScaledVector(f.R, p.x * s).addScaledVector(f.U, p.y * s);
    this.center = W(new THREE.Vector2(0.8, -0.2)).addScaledVector(f.U, 1.5);
    const segs = [];
    const circle = (O, rad, t0, dur, col, width = 0.05) => {
      const n = 120;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + 1.2, a1 = ((i + 1) / n) * Math.PI * 2 + 1.2;
        segs.push({ a: W(new THREE.Vector2(O.x + Math.cos(a0) * rad, O.y + Math.sin(a0) * rad)), b: W(new THREE.Vector2(O.x + Math.cos(a1) * rad, O.y + Math.sin(a1) * rad)), color: col, width, born: t0 + (i / n) * dur, grow: dur / n + 0.002 });
      }
    };
    const line = (a, b, t0, dur, col, width = 0.045) => segs.push({ a: W(a), b: W(b), color: col, width, born: t0, grow: dur });
    const L = (p, dir, l0, l1) => [p.clone().addScaledVector(dir, l0), p.clone().addScaledVector(dir, l1)];
    circle(g.M, g.r, 14.0, 0.35, WHITE);
    circle(g.N, g.R, 14.1, 0.35, WHITE);
    line(new THREE.Vector2(-1.35, 0), new THREE.Vector2(g.D.x + 0.35, 0), 14.3, 0.2, DIM);
    circle(circumcenter(g.A, g.C, g.D), g.P.distanceTo(g.A), 14.55, 0.3, DIM, 0.035);
    const [a1, a2] = L(g.A, g.v, -0.3, g.A.distanceTo(g.F) + 0.3);
    line(a1, a2, 14.8, 0.15, WHITE);
    line(g.P, g.M, 14.95, 0.08, DIM); line(g.M, g.N, 14.95, 0.08, DIM); line(g.N, g.P, 15.0, 0.08, DIM);
    line(g.P, new THREE.Vector2(g.P.x, 0), 15.1, 0.1, DIM, 0.03);
    line(g.M, g.H.clone().multiplyScalar(1.15), 15.12, 0.1, DIM, 0.03);
    const [h1, h2] = L(g.H, g.v, -2.4, 2.6);
    line(h1, h2, 15.3, 0.2, WHITE, 0.055);
    circle(g.Q, g.rq, 15.45, 0.35, WHITE, 0.055);
    this.lines = makeSegments(segs, { minPx: 1.8, core: 0.8 });
    this.root.add(this.lines);
    const pts = [
      ['M', g.M, 14.35], ['N', g.N, 14.38], ['A', g.A, 14.4], ['B', g.B, 14.43], ['C', g.C, 14.46], ['D', g.D, 14.49],
      ['P', g.P, 14.75], ['E', g.E, 14.9], ['F', g.F, 14.93], ['H', g.H, 15.25],
    ];
    this.dots = makePoints(pts.map(([, p, t]) => ({ p: W(p), color: [1.3, 1.3, 1.35], size: 0.22, born: t, fadeIn: 0.04 })), { minPx: 4, maxPx: 9 });
    this.tangent = makePoints([{ p: W(g.T), color: [2.2, 2.2, 2.3], size: 0.5, born: 15.8, fadeIn: 0.03 }], { minPx: 7, maxPx: 22 });
    this.root.add(this.dots, this.tangent);
    const lab = (txt, p, t, dx = 22, dy = -18) => ({ p: W(p), text: txt, b0: t, b1: 16.1, dx, dy, italic: true, size: 30 });
    this.labels = [
      lab('Ω', new THREE.Vector2(g.M.x - 0.72, g.M.y + 0.72), 14.2), lab('Γ', new THREE.Vector2(g.N.x + 1.1, g.N.y + 1.1), 14.3),
      ...pts.map(([t, p, tt]) => lab(t, p, tt, t === 'C' ? -34 : 16, t === 'B' || t === 'H' ? 34 : -16)),
    ];
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.lines.material.uniforms.uGain.value = this.g;
    this.dots.material.uniforms.uGain.value = this.g;
    const tk = b >= 15.8 ? 0.6 + 1.4 * Math.exp(-(b - 15.8) * 6) : 0;
    this.tangent.material.uniforms.uGain.value = this.g * tk;
  }
}
