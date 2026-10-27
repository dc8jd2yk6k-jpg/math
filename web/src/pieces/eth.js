// 1950 · Shannon: thin orbit rings around the head at the origin.
// 2026 · ETH: the exponential search tree (2^n) grows one last time; two red
// dots, one per lab, climb separate paths and reach the top on the same beat;
// then the tree folds into the line.
import * as THREE from 'three';
import { Piece, WHITE, DIM } from './common.js';
import { makeSegments, makePoints } from '../gfx/glow.js';
import { frameAt, spineAt } from '../curve.js';
import { rng, clamp, ease, smoothstep, hexToRgb } from '../util.js';
import { PALETTE } from '../config.js';

const RED = hexToRgb(PALETTE.head);

export class Shannon extends Piece {
  constructor() {
    super(0.85, 1.95, 0.15, 0.35);
    const f = frameAt(1.0);
    const o = spineAt(1.0);
    this.center = o.clone();
    const segs = [];
    const tilt = new THREE.Quaternion().setFromAxisAngle(f.R, -0.5);
    for (let k = 0; k < 7; k++) {
      const rad = 1.1 + k * 0.26, n = 160;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        const P = (a) => o.clone().add(f.R.clone().multiplyScalar(Math.cos(a) * rad).addScaledVector(f.F, Math.sin(a) * rad).applyQuaternion(tilt));
        segs.push({ a: P(a0), b: P(a1), color: RED.map((c) => c * (0.55 - k * 0.05)), width: 0.03, born: 0.9 + k * 0.04 + (i / n) * 0.3, grow: 0.01 });
      }
    }
    this.rings = makeSegments(segs, { minPx: 1.4, core: 0.8 });
    this.root.add(this.rings);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.rings.material.uniforms.uGain.value = this.g;
  }
}

export class ETH extends Piece {
  constructor() {
    super(24.9, 29.7, 0.12, 0.3);
    const f = frameAt(25.5);
    const root = spineAt(24.95);
    const top = spineAt(26.0);
    const height = top.distanceTo(root);
    this.f = f; this.root0 = root.clone();
    this.center = root.clone().lerp(top, 0.55);
    const r = rng(1999);
    const depth = 8, dz = height / depth;
    const segs = [];
    const nodes = [];
    const grow = (p, level, x, spread) => {
      nodes.push({ p, level });
      if (level >= depth) return;
      for (const s of [-1, 1]) {
        const nx = x + s * spread * (0.8 + r() * 0.4);
        const q = root.clone().addScaledVector(f.U, (level + 1) * dz).addScaledVector(f.R, nx).addScaledVector(f.F, (r() - 0.5) * 1.2);
        segs.push({ a: p, b: q, color: WHITE, width: 0.03, alpha: 0.5, born: 25.0 + level * 0.0625, grow: 0.06, lvl: level, side: s, x: nx });
        grow(q, level + 1, nx, spread * 0.56);
      }
    };
    grow(root, 0, 0, 3.3);
    // two lit paths (left-ish and right-ish), the labs' searches
    const pathOf = (choose) => {
      const pts = [root.clone()];
      let x = 0, spread = 3.3;
      const rr = rng(choose);
      for (let l = 0; l < depth; l++) {
        const s = (l === 0 ? (choose === 1 ? -1 : 1) : (rr() < 0.5 ? -1 : 1));
        x += s * spread * 0.95; spread *= 0.56;
        pts.push(root.clone().addScaledVector(f.U, (l + 1) * dz).addScaledVector(f.R, x));
      }
      return pts;
    };
    this.paths = [pathOf(1), pathOf(7)];
    const lit = [];
    this.paths.forEach((P) => { for (let i = 0; i < P.length - 1; i++) lit.push({ a: P[i], b: P[i + 1], color: [1.5, 1.5, 1.55], width: 0.06, born: 25.3 + i * 0.085, grow: 0.085 }); });
    this.tree = makeSegments(segs, { minPx: 1.1, core: 0.5 });
    this.lit = makeSegments(lit, { minPx: 1.8, core: 1.0 });
    this.root.add(this.tree, this.lit);
    this.t0 = this.tree.geometry.attributes.p0.array.slice();
    this.t1 = this.tree.geometry.attributes.p1.array.slice();
    this.l0 = this.lit.geometry.attributes.p0.array.slice();
    this.l1 = this.lit.geometry.attributes.p1.array.slice();
    this.dots = makePoints([{ p: root, color: RED.map((c) => c * 2.2), size: 0.5 }, { p: root, color: RED.map((c) => c * 2.2), size: 0.5 }], { minPx: 6, maxPx: 22 });
    this.root.add(this.dots);
    this.dotPos = [root.clone(), root.clone()];
    this.labels = [
      { p: top.clone().addScaledVector(f.U, 1.2).addScaledVector(f.R, -5.2), text: '2ⁿ', b0: 25.45, b1: 26.3, dx: 0, dy: 0, italic: true, size: 40, center: true },
    ];
    this.labPos = [new THREE.Vector3(), new THREE.Vector3()];
    this.labels.push({ p: this.labPos[0], text: 'OpenAI', b0: 25.35, b1: 27.3, dx: -26, dy: 0, size: 26, sans: true, right: true });
    this.labels.push({ p: this.labPos[1], text: 'Anthropic', b0: 25.35, b1: 27.3, dx: 26, dy: 0, size: 26, sans: true });
    this.labels.push({ p: top.clone().addScaledVector(f.U, 3.5), text: '3-SAT  ∈  TIME(2^{o(n)})', b0: 27.1, b1: 29.6, dx: 0, dy: 0, italic: true, size: 36, center: true });
  }

  along(P, t) {   // position along a polyline, t in [0,1]
    const n = P.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x));
    return P[i].clone().lerp(P[i + 1], x - i);
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    // the tree folds into the line (the exponential collapses)
    const c = ease.inOutCubic(clamp((b - 26.3) / 0.9));
    const fold = (src, attr) => {
      const v = new THREE.Vector3();
      for (let i = 0; i < attr.count; i++) {
        v.fromArray(src, i * 3);
        const d = v.clone().sub(this.root0);
        const axis = this.root0.clone().addScaledVector(this.f.U, d.dot(this.f.U));
        v.lerp(axis, c);
        attr.setXYZ(i, v.x, v.y, v.z);
      }
      attr.needsUpdate = true;
    };
    const ta = this.tree.geometry.attributes, la = this.lit.geometry.attributes;
    fold(this.t0, ta.p0); fold(this.t1, ta.p1); fold(this.l0, la.p0); fold(this.l1, la.p1);
    const fade = 1 - smoothstep(26.9, 27.4, b);
    this.tree.material.uniforms.uGain.value = this.g * fade;
    this.lit.material.uniforms.uGain.value = this.g * fade;
    // two dots climb their paths and arrive together on the bar-26 downbeat
    const t = ease.inOutSine(clamp((b - 25.3) / 0.7));
    const pos = this.dots.geometry.attributes.position;
    this.paths.forEach((P, i) => {
      const p = this.along(P, t);
      const axis = this.root0.clone().addScaledVector(this.f.U, p.clone().sub(this.root0).dot(this.f.U));
      p.lerp(axis, c);
      pos.setXYZ(i, p.x, p.y, p.z);
      this.labPos[i].copy(p);
    });
    pos.needsUpdate = true;
    const arrive = b >= 26 ? Math.exp(-(b - 26) * 5) : 0;
    this.dots.material.uniforms.uGain.value = this.g * smoothstep(25.25, 25.35, b) * (1 + arrive * 1.5) * (1 - smoothstep(26.6, 27.2, b));
  }
}
