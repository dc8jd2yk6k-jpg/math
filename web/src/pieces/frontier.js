// Phase III set pieces — one per frontier result, each beat-locked.
import * as THREE from 'three';
import { Piece, frameMatrix } from './common.js';
import { makeSegments, makePoints, textPlane } from '../gfx/glow.js';
import { rng, clamp, ease, smoothstep, hexToRgb, lerp } from '../util.js';
import { frameAt } from '../curve.js';
import { PALETTE } from '../config.js';

function localGroup(b, anchor) {
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.copy(frameMatrix(b, anchor));
  return g;
}

// ------------------------------------------------------------------ Erdős
// The 7-cube projected to the plane with unit edges: every edge has length
// exactly 1 — a unit-distance graph with many coincidences of distance.
export class Erdos extends Piece {
  constructor(A) {
    super(15.9, 18.3, 0.1, 0.4);
    this.local = localGroup(16.6, A.erdos);
    this.root.add(this.local);
    const k = 7, U = 2.15;
    const dirs = [];
    for (let i = 0; i < k; i++) { const a = (i * Math.PI) / k + 0.1; dirs.push(new THREE.Vector2(Math.cos(a), Math.sin(a))); }
    const pts = [];
    const center = new THREE.Vector2();
    dirs.forEach((d) => center.addScaledVector(d, 0.5));
    for (let m = 0; m < 1 << k; m++) {
      const p = new THREE.Vector2();
      let w = 0;
      for (let i = 0; i < k; i++) if (m & (1 << i)) { p.add(dirs[i]); w++; }
      p.sub(center).multiplyScalar(U);
      pts.push({ m, w, p });
    }
    const cyan = hexToRgb('#7fe8ff');
    const segs = [];
    for (const a of pts) for (let i = 0; i < k; i++) {
      if (a.m & (1 << i)) continue;
      const bq = pts[a.m | (1 << i)];
      const born = 16.0 + (a.w + 1) * 0.0625;
      segs.push({ a: new THREE.Vector3(a.p.x, a.p.y, 0), b: new THREE.Vector3(bq.p.x, bq.p.y, 0), color: cyan.map((c) => c * (0.7 + 0.1 * i)), width: 0.07, born, grow: 0.06, alpha: 0.9 });
    }
    this.edges = makeSegments(segs, { minPx: 1.3, core: 0.9 });
    this.nodes = makePoints(pts.map((a) => ({ p: new THREE.Vector3(a.p.x, a.p.y, 0), color: [1.4, 1.6, 1.8], size: 0.32, born: 16.0 + a.w * 0.0625, fadeIn: 0.04 })), { minPx: 2.5, maxPx: 14 });
    // unit circle around the central vertex, through its neighbours
    const c0 = pts[0b0010101].p;
    const ring = [];
    for (let i = 0; i < 120; i++) {
      const a0 = (i / 120) * Math.PI * 2, a1 = ((i + 1) / 120) * Math.PI * 2;
      ring.push({ a: new THREE.Vector3(c0.x + Math.cos(a0) * U, c0.y + Math.sin(a0) * U, 0), b: new THREE.Vector3(c0.x + Math.cos(a1) * U, c0.y + Math.sin(a1) * U, 0), color: [1.8, 1.4, 0.6], width: 0.06, born: 16.75 + i / 120 * 0.2, grow: 0.01 });
    }
    this.ring = makeSegments(ring, { minPx: 1.6, core: 1.2 });
    this.label = textPlane('|x − y| = 1', 1.1, [1.6, 1.3, 0.6], { font: 'math', px: 110 });
    this.label.position.set(c0.x, c0.y + U + 1.0, 0);
    [this.edges, this.nodes, this.ring, this.label].forEach((o) => this.local.add(o));
    this.center = new THREE.Vector3(c0.x, c0.y, 0).applyMatrix4(this.local.matrix);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    this.local.matrix.copy(this.baseM || (this.baseM = this.local.matrix.clone()));
    const spin = new THREE.Matrix4().makeRotationZ((b - 16) * 0.18);
    this.local.matrix.multiply(spin);
    this.edges.material.uniforms.uGain.value = g * (1 + 0.3 * ctx.beat);
    this.nodes.material.uniforms.uGain.value = g;
    this.ring.material.uniforms.uGain.value = g;
    this.label.material.uniforms.uGain.value = g * smoothstep(16.8, 17.0, b);
  }
}

// ------------------------------------------------------------------ Jacobian
// A polynomial warp of 3-space with constant Jacobian determinant... that
// still sends three distinct points to one.
export class Jacobian extends Piece {
  constructor(A) {
    super(17.9, 20.3, 0.1, 0.4);
    this.local = localGroup(18.6, A.jacobian);
    this.root.add(this.local);
    const n = 6, sp = 1.55, sub = 14;
    this.lines = [];
    const half = (n - 1) / 2;
    for (let ax = 0; ax < 3; ax++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const pts = [];
      for (let s = 0; s <= sub; s++) {
        const u = (s / sub) * (n - 1) - half;
        const c = [0, 0, 0];
        c[ax] = u * sp; c[(ax + 1) % 3] = (i - half) * sp; c[(ax + 2) % 3] = (j - half) * sp;
        pts.push(new THREE.Vector3(...c));
      }
      this.lines.push(pts);
    }
    const segs = [];
    const orange = hexToRgb(PALETTE.gold);
    this.lines.forEach((L, li) => {
      for (let s = 0; s < L.length - 1; s++) segs.push({ a: L[s], b: L[s + 1], color: [0.95, 0.55, 0.3], width: 0.05, alpha: 0.75, born: 18.0 + (li % 12) * 0.02, grow: 0.12 });
    });
    this.grid = makeSegments(segs, { minPx: 1.1, core: 0.6 });
    this.local.add(this.grid);
    this.p0 = this.grid.geometry.attributes.p0.array.slice();
    this.p1 = this.grid.geometry.attributes.p1.array.slice();
    // three colliding points
    this.starts = [new THREE.Vector3(-3.4, 2.6, -2.2), new THREE.Vector3(3.2, -2.4, 2.6), new THREE.Vector3(-2.2, -3.0, 3.0)];
    this.target = new THREE.Vector3(0.6, 0.8, -0.4);
    this.dots = makePoints(this.starts.map((p, i) => ({ p, color: [[2, 0.7, 0.35], [0.4, 1.4, 2], [1.8, 0.5, 1.8]][i], size: 0.7, born: 18.2, fadeIn: 0.1 })), { minPx: 4, maxPx: 30 });
    this.flash = makePoints([{ p: this.target, color: [3, 2.8, 2.6], size: 3.5 }], { minPx: 4, maxPx: 300 });
    this.local.add(this.dots); this.local.add(this.flash);
    this.dotTrails = makeSegments(Array.from({ length: 3 * 24 }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), color: [1.2, 1, 1], width: 0.08 })), { minPx: 1.5, core: 1 });
    this.local.add(this.dotTrails);
    this.targetWorld = this.target.clone().applyMatrix4(this.local.matrix);
  }
  warp(p, s, out) {
    // F_s(x, y, z): a smooth polynomial shear (illustrative)
    const x = p.x, y = p.y, z = p.z;
    return out.set(x + s * 0.11 * (y * y - 2), y + s * 0.09 * (z * z - x * 0.5 * z), z + s * 0.07 * x * y);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    const s = ease.inOutCubic(clamp((b - 18.15) / 0.8));
    const a0 = this.grid.geometry.attributes.p0, a1 = this.grid.geometry.attributes.p1;
    const v = new THREE.Vector3(), o = new THREE.Vector3();
    for (let i = 0; i < a0.count; i++) {
      v.fromArray(this.p0, i * 3); this.warp(v, s, o); a0.setXYZ(i, o.x, o.y, o.z);
      v.fromArray(this.p1, i * 3); this.warp(v, s, o); a1.setXYZ(i, o.x, o.y, o.z);
    }
    a0.needsUpdate = true; a1.needsUpdate = true;
    this.grid.material.uniforms.uGain.value = g * (0.9 + 0.3 * ctx.beat);
    // collision at b = 19 (downbeat of the 2nd bar)
    const m = ease.inOutQuart(clamp((b - 18.35) / 0.65));
    const pos = this.dots.geometry.attributes.position;
    const ta = this.dotTrails.geometry.attributes;
    this.starts.forEach((p, i) => {
      const at = (mm) => {
        const q = p.clone().lerp(this.target, mm);
        q.addScaledVector(new THREE.Vector3(Math.sin(i * 2.1), Math.cos(i * 1.3), Math.sin(i + 1)), Math.sin(mm * Math.PI) * 1.8);
        return q;
      };
      const q = at(m);
      pos.setXYZ(i, q.x, q.y, q.z);
      for (let k = 0; k < 24; k++) {
        const m0 = Math.max(0, m - (k + 1) * 0.02), m1 = Math.max(0, m - k * 0.02);
        const qa = at(m0), qb = at(m1);
        ta.p0.setXYZ(i * 24 + k, qa.x, qa.y, qa.z); ta.p1.setXYZ(i * 24 + k, qb.x, qb.y, qb.z);
        ta.wa.setXY(i * 24 + k, 0.08, (1 - k / 24) * 0.8);
      }
    });
    pos.needsUpdate = true; ta.p0.needsUpdate = true; ta.p1.needsUpdate = true; ta.wa.needsUpdate = true;
    this.dots.material.uniforms.uGain.value = g * smoothstep(18.15, 18.3, b);
    this.dotTrails.material.uniforms.uGain.value = g * smoothstep(18.35, 18.5, b) * (1 - smoothstep(19.0, 19.3, b));
    const f = b >= 19 ? Math.exp(-(b - 19) * 5) : 0;
    this.flash.material.uniforms.uGain.value = g * f * 2;
    this.flash.material.uniforms.uSize.value = 0.5 + f;
  }
}

// ------------------------------------------------------------------ Percolation
// Bond percolation on Z^3 at the critical point p_c ≈ 0.2488. Clusters are
// coloured by size: big, tenuous, and — as the theorem says — finite.
export class Percolation extends Piece {
  constructor(A) {
    super(19.9, 22.3, 0.1, 0.4);
    this.local = localGroup(20.55, A.percolation);
    this.root.add(this.local);
    const L = 11, sp = 1.45, p = 0.2488;
    const r = rng(2026);
    const id = (x, y, z) => (x * L + y) * L + z;
    const parent = new Int32Array(L * L * L).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const bonds = [];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) {
      for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        if (X >= L || Y >= L || Z >= L) continue;
        if (r() < p) {
          bonds.push([id(x, y, z), id(X, Y, Z), [x, y, z], [X, Y, Z]]);
          const ra = find(id(x, y, z)), rb = find(id(X, Y, Z));
          if (ra !== rb) parent[ra] = rb;
        }
      }
    }
    const size = new Map();
    for (const bd of bonds) { const c = find(bd[0]); size.set(c, (size.get(c) || 0) + 1); }
    const ranked = [...size.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const palette = [[2.0, 0.55, 0.3], [1.9, 1.1, 0.25], [1.7, 0.35, 1.2], [0.4, 1.3, 1.8], [0.5, 1.6, 0.8]];
    const h = (L - 1) / 2;
    const P = (c) => new THREE.Vector3((c[0] - h) * sp, (c[1] - h) * sp, (c[2] - h) * sp);
    const plain = [], colored = [];
    for (const bd of bonds) {
      const c = find(bd[0]);
      const rank = ranked.indexOf(c);
      const born = 20.0 + r() * 0.5;
      plain.push({ a: P(bd[2]), b: P(bd[3]), color: [0.6, 0.75, 1.0], width: 0.07, alpha: 0.7, born, grow: 0.05, die: 20.85, fade: 0.2 });
      const col = rank < palette.length ? palette[rank] : [0.25, 0.32, 0.5];
      colored.push({ a: P(bd[2]), b: P(bd[3]), color: col, width: rank < 5 ? 0.11 : 0.05, alpha: rank < 5 ? 1 : 0.5, born: 20.7 + (rank < 5 ? rank * 0.03 : 0.2), grow: 0.08 });
    }
    // faint lattice sites
    const sites = [];
    for (let x = 0; x < L; x += 1) for (let y = 0; y < L; y += 1) for (let z = 0; z < L; z += 1) sites.push({ p: P([x, y, z]), color: [0.25, 0.32, 0.45], size: 0.08, born: 19.95 + (x + y + z) * 0.004, fadeIn: 0.05 });
    this.plain = makeSegments(plain, { minPx: 1.1, core: 0.6 });
    this.colored = makeSegments(colored, { minPx: 1.2, core: 0.9 });
    this.sites = makePoints(sites, { minPx: 1.2, maxPx: 4 });
    [this.sites, this.plain, this.colored].forEach((o) => this.local.add(o));
    this.stats = { bonds: bonds.length, largest: size.get(ranked[0]) };
    this.cornerWorld = P([L - 1, L - 1, 0]).applyMatrix4(this.local.matrix);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    this.plain.material.uniforms.uGain.value = g;
    this.colored.material.uniforms.uGain.value = g * (1 + 0.35 * ctx.beat);
    this.sites.material.uniforms.uGain.value = g * 0.8;
  }
}

// ------------------------------------------------------------------ Navier–Stokes
// A vortex that spirals inward and stretches like spaghetti until the
// velocity blows up in finite time (t → T*).
export class Navier extends Piece {
  constructor(A) {
    super(21.9, 23.25, 0.08, 0.3);
    this.local = localGroup(22.45, A.navier);
    this.root.add(this.local);
    const r = rng(9);
    const pts = [];
    for (let i = 0; i < 4200; i++) {
      const th = r() * Math.PI * 2, u = r() * 2 - 1, rho = 0.25 + Math.pow(r(), 0.7) * 0.9;
      const hot = Math.exp(-rho * 2.5);
      pts.push({ p: new THREE.Vector3(0, 0, 0), color: [0.5 + 1.5 * hot, 0.75 + 1.0 * hot, 1.6], size: 0.07 + r() * 0.06, born: 21.95 + r() * 0.08, fadeIn: 0.1, motion: [th, u, rho, r()] });
    }
    this.vortex = makePoints(pts, {
      minPx: 1.3, maxPx: 7,
      uniforms: { uS: { value: 0 } },
      displace: {
        header: 'uniform float uS;',
        body: `
          float s = uS;
          float R = 3.4 * sqrt(max(1.0 - 0.985 * s, 0.0004));
          float Lh = 4.2 / pow(max(1.0 - 0.92 * s, 0.02), 0.55);
          float th = motion.x + uTime * (5.0 / (motion.z * R + 0.25)) + motion.y * 3.0 * (0.5 + s);
          float rr = motion.z * R * (1.0 + 0.25 * sin(motion.y * 9.0 + uTime * 6.0));
          P = vec3(cos(th) * rr, motion.y * Lh, sin(th) * rr);
          alpha = smoothstep(1.0, 0.7, abs(motion.y)) * (0.6 + 0.4 * motion.w);
        `,
      },
    });
    this.core = makePoints([{ p: new THREE.Vector3(), color: [3, 2.6, 2.2], size: 3 }], { minPx: 4, maxPx: 420 });
    this.local.add(this.vortex); this.local.add(this.core);
    this.coreWorld = new THREE.Vector3().applyMatrix4(this.local.matrix);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    const s = clamp((b - 22.0) / 0.88);
    this.vortex.material.uniforms.uS.value = ease.inQuad(s);
    this.vortex.material.uniforms.uGain.value = g * (1 + 0.6 * s);
    const blow = b >= 22.88 ? Math.exp(-(b - 22.88) * 6) : 0;
    this.core.material.uniforms.uGain.value = g * (0.3 * s * s + blow * 3);
    this.core.material.uniforms.uSize.value = 0.4 + blow * 2.5;
  }
}

// ------------------------------------------------------------------ 722 manuscripts
export class Papers extends Piece {
  constructor(A) {
    super(22.95, 24.3, 0.05, 0.4);
    const f = frameAt(23.2);
    const r = rng(722);
    const n = 722;
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(0.6, 0.78);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const dir = new Float32Array(n * 3), axis = new Float32Array(n * 3), prm = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // directions biased outward from the climb axis
      const a = r() * Math.PI * 2, el = (r() - 0.5) * 1.3;
      const d = f.N.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.Z, Math.sin(a)).addScaledVector(f.T, el).normalize();
      dir.set([d.x, d.y, d.z], i * 3);
      const ax = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      axis.set([ax.x, ax.y, ax.z], i * 3);
      prm.set([23.0 + (i / n) * 0.18, 3 + Math.pow(r(), 0.8) * 16, (r() - 0.5) * 12, r()], i * 4);
    }
    geo.setAttribute('dir', new THREE.InstancedBufferAttribute(dir, 3));
    geo.setAttribute('axis', new THREE.InstancedBufferAttribute(axis, 3));
    geo.setAttribute('prm', new THREE.InstancedBufferAttribute(prm, 4));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uGain: { value: 0 }, uOrigin: { value: A.papers.clone() }, uPixel: { value: 1 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */`
        attribute vec3 dir; attribute vec3 axis; attribute vec4 prm;
        uniform float uTime; uniform vec3 uOrigin;
        varying vec2 vUv; varying float vA; varying float vSeed;
        uniform vec3 uCam;
        vec3 rot(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
        void main() {
          float t = uTime - prm.x;
          vA = step(0.0, t);
          float d = prm.y * (1.0 - exp(-max(t, 0.0) * 2.2)) + max(t, 0.0) * 1.5;
          vec3 p = rot(position, axis, prm.z * max(t, 0.0) + prm.w * 6.28);
          vec3 P = uOrigin + dir * d + p;
          vUv = uv; vSeed = prm.w;
          float dc = length(P - uCam);
          vA *= smoothstep(1.2, 5.0, dc) * smoothstep(60.0, 25.0, dc);
          gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain; varying vec2 vUv; varying float vA; varying float vSeed;
        float h(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          float border = 1.0 - smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
          float title = step(0.84, uv.y) * step(uv.y, 0.9) * step(0.15, uv.x) * step(uv.x, 0.85);
          float row = floor(uv.y * 22.0);
          float len = 0.55 + 0.35 * h(row + vSeed * 91.0);
          float lines = step(uv.y, 0.78) * step(0.08, uv.y) * step(0.1, uv.x) * step(uv.x, 0.1 + len * 0.8) * step(0.35, fract(uv.y * 22.0));
          float eq = step(0.38, uv.y) * step(uv.y, 0.46) * step(0.3, uv.x) * step(uv.x, 0.7) * step(0.5, h(vSeed * 13.0));
          float v = 0.16 + border * 0.9 + title * 0.9 + lines * 0.45 + eq * 0.6;
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * v * uGain * vA, 1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    this.mesh.material.uniforms.uGain.value = this.g * 0.13;
    this.mesh.material.uniforms.uCam.value.copy(ctx.camera.position);
  }
}

// ------------------------------------------------------------------ Yang–Mills
// A 4D hypercubic gauge lattice, rotating through the fourth dimension;
// links coloured by direction, plaquettes flashing with flux.
export class YangMills extends Piece {
  constructor(A) {
    super(23.9, 25.3, 0.08, 0.35);
    this.local = localGroup(24.4, A.yangmills);
    this.root.add(this.local);
    const L = 3;
    this.verts = [];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) for (let w = 0; w < L; w++) this.verts.push([x - 1, y - 1, z - 1, w - 1]);
    const idx = (x, y, z, w) => (((x * L + y) * L + z) * L + w);
    this.edges = [];
    const cols = [[2.0, 0.35, 0.4], [0.4, 1.8, 0.5], [0.45, 0.6, 2.2], [1.6, 1.4, 1.0]];
    for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (let z = 0; z < L; z++) for (let w = 0; w < L; w++) {
      const c = [x, y, z, w];
      for (let d = 0; d < 4; d++) {
        const n = c.slice(); n[d]++;
        if (n[d] >= L) continue;
        this.edges.push([idx(...c), idx(...n), d]);
      }
    }
    const r = rng(4);
    this.seg = makeSegments(this.edges.map((e) => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), color: cols[e[2]], width: 0.06, alpha: 0.85, born: 24.0 + r() * 0.15, grow: 0.08 })), { minPx: 1.3, core: 0.9 });
    this.local.add(this.seg);
    this.nodes = makePoints(this.verts.map(() => ({ p: new THREE.Vector3(), color: [1.2, 1.2, 1.4], size: 0.16, born: 24.0, fadeIn: 0.1 })), { minPx: 1.5, maxPx: 8 });
    this.local.add(this.nodes);
    this.label = textPlane('d = 4', 0.9, [1.4, 1.4, 1.6], { font: 'math', px: 110 });
    this.label.position.set(0, 5.2, 0);
    this.local.add(this.label);
  }
  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    const a = (b - 24) * 1.4, c = (b - 24) * 0.7;
    const S = 2.6, D = 3.2;
    const proj = this.verts.map(([x, y, z, w]) => {
      const x1 = x * Math.cos(a) - w * Math.sin(a), w1 = x * Math.sin(a) + w * Math.cos(a);
      const y1 = y * Math.cos(c) - z * Math.sin(c), z1 = y * Math.sin(c) + z * Math.cos(c);
      const k = D / (D - w1 * 0.8);
      return new THREE.Vector3(x1 * k * S, y1 * k * S, z1 * k * S);
    });
    const at = this.seg.geometry.attributes;
    this.edges.forEach((e, i) => { const p = proj[e[0]], q = proj[e[1]]; at.p0.setXYZ(i, p.x, p.y, p.z); at.p1.setXYZ(i, q.x, q.y, q.z); });
    at.p0.needsUpdate = true; at.p1.needsUpdate = true;
    const np = this.nodes.geometry.attributes.position;
    proj.forEach((p, i) => np.setXYZ(i, p.x, p.y, p.z));
    np.needsUpdate = true;
    this.seg.material.uniforms.uGain.value = g * (1 + 0.4 * ctx.beat);
    this.nodes.material.uniforms.uGain.value = g;
    this.label.material.uniforms.uGain.value = g * smoothstep(24.2, 24.4, b);
  }
}
