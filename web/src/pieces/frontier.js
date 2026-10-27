// Phase III: one white line-art object per frontier result.
import * as THREE from 'three';
import { Piece, WHITE, DIM } from './common.js';
import { makeSegments, makePoints } from '../gfx/glow.js';
import { frameAt, spineAt } from '../curve.js';
import { rng, clamp, ease, smoothstep } from '../util.js';

// a group placed in the screen frame of story position u, centred at local (x, y, z)
function placed(u, x, y, z, yawDeg = 0) {
  const f = frameAt(u);
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  const q = new THREE.Quaternion().setFromAxisAngle(f.U, THREE.MathUtils.degToRad(yawDeg));
  const m = new THREE.Matrix4().makeBasis(f.R.clone().applyQuaternion(q), f.U, f.F.clone().applyQuaternion(q));
  const o = spineAt(u).addScaledVector(f.R, x).addScaledVector(f.U, y).addScaledVector(f.F, z);
  g.matrix.copy(m.setPosition(o));
  return { g, o, f };
}

// ------------------------------------------------------------------ Erdős
// The 7-cube projected to the plane: every edge has length exactly 1.
export class Erdos extends Piece {
  constructor() {
    super(15.9, 18.1, 0.2, 0.3);
    const { g, o, f } = placed(16.9, 0.4, -4.5, -3);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 1.5);
    const k = 7, U = 1.75;
    const dirs = [];
    for (let i = 0; i < k; i++) { const a = (i * Math.PI) / k + 0.22; dirs.push(new THREE.Vector2(Math.cos(a), Math.sin(a))); }
    const c0 = new THREE.Vector2();
    dirs.forEach((d) => c0.addScaledVector(d, 0.5));
    const pts = [];
    for (let m = 0; m < 1 << k; m++) {
      const p = new THREE.Vector2(); let w = 0;
      for (let i = 0; i < k; i++) if (m & (1 << i)) { p.add(dirs[i]); w++; }
      pts.push({ m, w, p: p.sub(c0).multiplyScalar(U) });
    }
    const segs = [];
    for (const a of pts) for (let i = 0; i < k; i++) {
      if (a.m & (1 << i)) continue;
      const q = pts[a.m | (1 << i)];
      segs.push({ a: new THREE.Vector3(a.p.x, a.p.y, 0), b: new THREE.Vector3(q.p.x, q.p.y, 0), color: WHITE, width: 0.03, alpha: 0.8, born: 16.05 + a.w * 0.0625 + i * 0.01, grow: 0.07 });
    }
    this.edges = makeSegments(segs, { minPx: 1.3, core: 0.6 });
    this.nodes = makePoints(pts.map((a) => ({ p: new THREE.Vector3(a.p.x, a.p.y, 0), color: [1.2, 1.2, 1.25], size: 0.12, born: 16.05 + a.w * 0.0625, fadeIn: 0.05 })), { minPx: 2.5, maxPx: 6 });
    const cc = pts[0b0010101].p;
    const ring = [];
    for (let i = 0; i < 120; i++) {
      const a0 = (i / 120) * Math.PI * 2, a1 = ((i + 1) / 120) * Math.PI * 2;
      ring.push({ a: new THREE.Vector3(cc.x + Math.cos(a0) * U, cc.y + Math.sin(a0) * U, 0), b: new THREE.Vector3(cc.x + Math.cos(a1) * U, cc.y + Math.sin(a1) * U, 0), color: WHITE, width: 0.03, born: 16.8 + (i / 120) * 0.25, grow: 0.01 });
    }
    this.ring = makeSegments(ring, { minPx: 1.5, core: 1 });
    [this.edges, this.nodes, this.ring].forEach((x) => g.add(x));
    const cw = new THREE.Vector3(cc.x, cc.y + U, 0).applyMatrix4(g.matrix);
    this.labels = [{ p: cw, text: '|x − y| = 1', b0: 17.0, b1: 18.0, dx: 30, dy: -40, italic: true, size: 30 }];
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    for (const o of [this.edges, this.nodes, this.ring]) o.material.uniforms.uGain.value = this.g;
  }
}

// ------------------------------------------------------------------ Jacobian
// A polynomial warp with constant Jacobian determinant that still sends three
// distinct points to one (the warp itself is illustrative).
export class Jacobian extends Piece {
  constructor() {
    super(17.9, 20.1, 0.2, 0.3);
    const { g, o, f } = placed(18.9, 0, -4.8, -3, 28);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 1.5);
    const n = 6, sp = 1.4, sub = 12, half = (n - 1) / 2;
    const segs = [];
    for (let ax = 0; ax < 3; ax++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      for (let s = 0; s < sub; s++) {
        const pt = (t) => { const c = [0, 0, 0]; c[ax] = (t / sub * (n - 1) - half) * sp; c[(ax + 1) % 3] = (i - half) * sp; c[(ax + 2) % 3] = (j - half) * sp; return new THREE.Vector3(...c); };
        segs.push({ a: pt(s), b: pt(s + 1), color: WHITE, width: 0.025, alpha: 0.45, born: 18.0 + ((i + j) % 6) * 0.03, grow: 0.12 });
      }
    }
    this.grid = makeSegments(segs, { minPx: 1.0, core: 0.4 });
    g.add(this.grid);
    this.p0 = this.grid.geometry.attributes.p0.array.slice();
    this.p1 = this.grid.geometry.attributes.p1.array.slice();
    this.starts = [new THREE.Vector3(-3.0, 2.4, -2.0), new THREE.Vector3(3.0, -2.0, 2.2), new THREE.Vector3(-2.0, -2.8, 2.6)];
    this.target = new THREE.Vector3(0.5, 0.6, -0.3);
    this.dots = makePoints(this.starts.map((p) => ({ p, color: [1.5, 1.5, 1.55], size: 0.35, born: 18.2, fadeIn: 0.1 })), { minPx: 5, maxPx: 14 });
    g.add(this.dots);
    this.g0 = g;
    this.labels = ['a', 'b', 'c'].map((t, i) => ({ p: this.starts[i].clone().applyMatrix4(g.matrix), text: t, b0: 18.3, b1: 18.9, dx: 18, dy: -14, italic: true, size: 30 }));
    this.labels.push({ p: this.target.clone().applyMatrix4(g.matrix), text: 'F(a) = F(b) = F(c)', b0: 19.05, b1: 20.0, dx: 40, dy: -50, italic: true, size: 30 });
  }
  warp(p, s, out) {
    const x = p.x, y = p.y, z = p.z;
    return out.set(x + s * 0.1 * (y * y - 2), y + s * 0.08 * (z * z - x * 0.5 * z), z + s * 0.06 * x * y);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const s = ease.inOutCubic(clamp((b - 18.15) / 0.8));
    const a0 = this.grid.geometry.attributes.p0, a1 = this.grid.geometry.attributes.p1;
    const v = new THREE.Vector3(), o = new THREE.Vector3();
    for (let i = 0; i < a0.count; i++) {
      v.fromArray(this.p0, i * 3); this.warp(v, s, o); a0.setXYZ(i, o.x, o.y, o.z);
      v.fromArray(this.p1, i * 3); this.warp(v, s, o); a1.setXYZ(i, o.x, o.y, o.z);
    }
    a0.needsUpdate = true; a1.needsUpdate = true;
    const m = ease.inOutQuart(clamp((b - 18.35) / 0.65));
    const pos = this.dots.geometry.attributes.position;
    this.starts.forEach((p, i) => {
      const q = p.clone().lerp(this.target, m).addScaledVector(new THREE.Vector3(Math.sin(i * 2.1), Math.cos(i * 1.3), Math.sin(i + 1)), Math.sin(m * Math.PI) * 1.4);
      pos.setXYZ(i, q.x, q.y, q.z);
    });
    pos.needsUpdate = true;
    this.grid.material.uniforms.uGain.value = this.g;
    this.dots.material.uniforms.uGain.value = this.g * (1 + (b >= 19 ? 1.5 * Math.exp(-(b - 19) * 6) : 0));
  }
}

// ------------------------------------------------------------------ Percolation
// Bond percolation on Z^3 at p_c ≈ 0.2488; the largest cluster is lit.
export class Percolation extends Piece {
  constructor() {
    super(19.9, 22.1, 0.2, 0.3);
    const { g, o, f } = placed(20.9, 0, -4.6, -4, 20);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 1.5);
    this.spin = g.matrix.clone();
    const L = 10, sp = 1.1, p = 0.2488;
    const r = rng(2026);
    const id = (x, y, z) => (x * L + y) * L + z;
    const parent = new Int32Array(L * L * L).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const bonds = [];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) {
      for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const X = x + dx, Y = y + dy, Zc = z + dz;
        if (X >= L || Y >= L || Zc >= L || r() >= p) continue;
        bonds.push([id(x, y, z), [x, y, z], [X, Y, Zc]]);
        const ra = find(id(x, y, z)), rb = find(id(X, Y, Zc));
        if (ra !== rb) parent[ra] = rb;
      }
    }
    const size = new Map();
    for (const bd of bonds) { const c = find(bd[0]); size.set(c, (size.get(c) || 0) + 1); }
    const big = [...size.entries()].sort((a, c) => c[1] - a[1])[0][0];
    const h = (L - 1) / 2;
    const P = (c) => new THREE.Vector3((c[0] - h) * sp, (c[1] - h) * sp, (c[2] - h) * sp);
    const segs = bonds.map((bd) => {
      const lit = find(bd[0]) === big;
      return { a: P(bd[1]), b: P(bd[2]), color: lit ? [1.4, 1.4, 1.45] : DIM, width: lit ? 0.06 : 0.03, alpha: lit ? 1 : 0.55, born: lit ? 20.55 + r() * 0.3 : 20.0 + r() * 0.45, grow: 0.06 };
    });
    this.bonds = makeSegments(segs, { minPx: 1.1, core: 0.6 });
    g.add(this.bonds);
    this.labels = [{ p: P([L - 1, L - 1, 0]).applyMatrix4(g.matrix), text: 'p = p꜀', b0: 20.6, b1: 21.9, dx: 30, dy: -30, italic: true, size: 30 }];
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.local.matrix.copy(this.spin).multiply(new THREE.Matrix4().makeRotationY((b - 20) * 0.25));
    this.bonds.material.uniforms.uGain.value = this.g;
  }
}

// ------------------------------------------------------------------ Navier–Stokes
// The equation types in; a vortex spirals inward and stretches like spaghetti
// until it blows up in finite time.
export class Navier extends Piece {
  constructor() {
    super(21.9, 23.05, 0.12, 0.2);
    const { g, o, f } = placed(22.6, 0, -3.2, -3, 0);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 2.0);
    const r = rng(9);
    const pts = [];
    for (let i = 0; i < 3600; i++) {
      const th = r() * Math.PI * 2, u = r() * 2 - 1, rho = 0.25 + Math.pow(r(), 0.7) * 0.9;
      const w = 0.6 + 0.6 * Math.exp(-rho * 2);
      pts.push({ p: new THREE.Vector3(), color: [w, w, w * 1.05], size: 0.05 + r() * 0.04, born: 22.1 + r() * 0.1, fadeIn: 0.12, motion: [th, u, rho, r()] });
    }
    this.vortex = makePoints(pts, {
      minPx: 1.2, maxPx: 5,
      uniforms: { uS: { value: 0 } },
      displace: {
        header: 'uniform float uS;',
        body: `
          float s = uS;
          float R = 2.4 * sqrt(max(1.0 - 0.985 * s, 0.0004));
          float Lh = 2.0 / pow(max(1.0 - 0.9 * s, 0.1), 0.5);
          float th = motion.x + uTime * (4.0 / (motion.z * R + 0.25)) + motion.y * 2.5 * (0.5 + s);
          float rr = motion.z * R;
          P = vec3(cos(th) * rr, motion.y * Lh, sin(th) * rr);   // vortex axis along screen-up
          alpha = smoothstep(1.0, 0.75, abs(motion.y)) * (0.55 + 0.45 * motion.w);`,
      },
    });
    this.core = makePoints([{ p: new THREE.Vector3(), color: [2.4, 2.4, 2.5], size: 1.4 }], { minPx: 3, maxPx: 160 });
    g.add(this.vortex, this.core);
    this.labels = [
      { p: o.clone().addScaledVector(f.U, -7.4), text: '∂ₜu + (u·∇)u = −∇p + νΔu', b0: 21.95, b1: 23.0, dx: 0, dy: 0, italic: true, size: 34, center: true, type: 1.6 },
      { p: o.clone().addScaledVector(f.U, -8.8), text: 'Lean · no goals ■', b0: 22.9, b1: 23.05, dx: 0, dy: 0, size: 24, center: true, mono: true },
    ];
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const s = clamp((b - 22.1) / 0.78);
    this.vortex.material.uniforms.uS.value = ease.inQuad(s);
    this.vortex.material.uniforms.uGain.value = this.g * (1 - smoothstep(22.88, 22.98, b) * 0.85);
    const blow = b >= 22.88 ? Math.exp(-(b - 22.88) * 7) : 0;
    this.core.material.uniforms.uGain.value = this.g * (0.25 * s * s + blow * 2.5);
    this.core.material.uniforms.uSize.value = 0.3 + blow * 1.8;
  }
}

// ------------------------------------------------------------------ 722 manuscripts
// 722 pages fly in and settle into a 38 × 19 wall.
export class Papers extends Piece {
  constructor() {
    super(22.95, 24.05, 0.06, 0.25);
    const { g, o, f } = placed(23.45, 0, -3.8, -4, 0);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 1.5);
    const cols = 38, rows = 19, cw = 0.17, ch = 0.23, gap = 0.05;
    const n = cols * rows;
    const r = rng(722);
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(cw, ch);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const from = new Float32Array(n * 3), to = new Float32Array(n * 3), prm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const cx = i % cols, cy = Math.floor(i / cols);
      to.set([(cx - (cols - 1) / 2) * (cw + gap), (cy - (rows - 1) / 2) * (ch + gap), 0], i * 3);
      const a = r() * Math.PI * 2, d = 6 + r() * 9;
      from.set([Math.cos(a) * d, Math.sin(a) * d, 6 + r() * 14], i * 3);
      prm.set([23.0 + r() * 0.4, r()], i * 2);
    }
    geo.setAttribute('from', new THREE.InstancedBufferAttribute(from, 3));
    geo.setAttribute('to', new THREE.InstancedBufferAttribute(to, 3));
    geo.setAttribute('prm', new THREE.InstancedBufferAttribute(prm, 2));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGain: { value: 0 }, uPixel: { value: 1 } },
      vertexShader: /* glsl */`
        attribute vec3 from; attribute vec3 to; attribute vec2 prm;
        uniform float uTime;
        varying vec2 vUv; varying float vSeed; varying float vA;
        void main() {
          float t = clamp((uTime - prm.x) / 0.22, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - t, 3.0);
          vec3 P = mix(from, to, e) + position * (0.6 + 0.4 * e);
          vUv = uv; vSeed = prm.y; vA = smoothstep(0.0, 0.15, t);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain; varying vec2 vUv; varying float vSeed; varying float vA;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          float border = 1.0 - smoothstep(0.0, 0.06, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          float row = floor(vUv.y * 9.0);
          float lines = step(vUv.y, 0.82) * step(0.12, vUv.y) * step(0.16, vUv.x) * step(vUv.x, 0.2 + 0.6 * h(row + vSeed * 31.0)) * step(0.45, fract(vUv.y * 9.0));
          float v = 0.07 + border * 0.55 + lines * 0.3;
          gl_FragColor = vec4(vec3(0.92, 0.93, 0.96) * v * uGain * vA, 1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    g.add(this.mesh);
    this.labels = [{ p: o.clone().addScaledVector(f.U, -(rows * (ch + gap)) / 2 - 1.2), text: '722', b0: 23.45, b1: 24.0, dx: 0, dy: 0, size: 34, center: true, mono: true }];
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.mesh.material.uniforms.uGain.value = this.g;
  }
}

// ------------------------------------------------------------------ Yang–Mills
// A 4D hypercubic lattice rotating through the fourth dimension.
export class YangMills extends Piece {
  constructor() {
    super(23.95, 25.1, 0.12, 0.25);
    const { g, o, f } = placed(24.45, 0, -3.8, -3, 0);
    this.local = g; this.root.add(g);
    this.center = o.clone().addScaledVector(f.U, 1.5);
    const L = 3;
    this.verts = [];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) for (let w = 0; w < L; w++) this.verts.push([x - 1, y - 1, z - 1, w - 1]);
    const idx = (x, y, z, w) => (((x * L + y) * L + z) * L + w);
    this.edges = [];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) for (let w = 0; w < L; w++) {
      const c = [x, y, z, w];
      for (let d = 0; d < 4; d++) { const nb = c.slice(); nb[d]++; if (nb[d] < L) this.edges.push([idx(...c), idx(...nb), d]); }
    }
    const r = rng(4);
    this.seg = makeSegments(this.edges.map((e) => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), color: e[2] === 3 ? WHITE : DIM.map((v) => v * 1.6), width: 0.035, alpha: 0.9, born: 24.0 + r() * 0.15, grow: 0.08 })), { minPx: 1.3, core: 0.7 });
    g.add(this.seg);
    this.labels = [{ p: o.clone().addScaledVector(f.U, 4.6).addScaledVector(f.R, 3.4), text: 'd = 4', b0: 24.2, b1: 25.0, dx: 0, dy: 0, italic: true, size: 30 }];
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const a = (b - 24) * 1.4, c = (b - 24) * 0.6, S = 2.2, D = 3.2;
    const proj = this.verts.map(([x, y, z, w]) => {
      const x1 = x * Math.cos(a) - w * Math.sin(a), w1 = x * Math.sin(a) + w * Math.cos(a);
      const y1 = y * Math.cos(c) - z * Math.sin(c), z1 = y * Math.sin(c) + z * Math.cos(c);
      const k = D / (D - w1 * 0.8);
      return [x1 * k * S, y1 * k * S, z1 * k * S];
    });
    const at = this.seg.geometry.attributes;
    this.edges.forEach((e, i) => { at.p0.setXYZ(i, ...proj[e[0]]); at.p1.setXYZ(i, ...proj[e[1]]); });
    at.p0.needsUpdate = true; at.p1.needsUpdate = true;
    this.seg.material.uniforms.uGain.value = this.g;
  }
}
