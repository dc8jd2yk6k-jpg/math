// 2026.08 · critical percolation, and the loop's portal. A floating voxel
// island: a sunlit landmass with lakes, and on it a forest whose trees are
// the clusters of a real site-percolation simulation on Z^3 at the critical
// point p_c ≈ 0.3116 (seeded, union-find). The theorem is the picture: at
// p_c every cluster is finite, so every tree ends. The film opens flying low
// over this island in daylight and ends by diving back into it.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { mulberry32, smoothstep, clamp, wrap, N_BARS, Pchip } from '../time.js';

export const P_C = 0.3116;
const NX = 88, NZ = 88, NY = 44;
const RX = 41, RZ = 41;
const WATER = 13;               // water level (voxels)

function valueNoise(seed) {
  const rnd = mulberry32(seed);
  const G = 64, tab = new Float32Array(G * G).map(() => rnd());
  const at = (i, j) => tab[((i % G) + G) % G * G + ((j % G) + G) % G];
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx, b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

// build the island: occupancy, colours, the cluster statistics
function buildIsland() {
  const n1 = valueNoise(11), n2 = valueNoise(23);
  const fbm = (x, y) => n1(x / 14, y / 14) * 0.6 + n1(x / 6, y / 6) * 0.28 + n2(x / 3, y / 3) * 0.12;
  const occ = new Uint8Array(NX * NY * NZ);          // 0 air, 1 stone, 2 dirt, 3 grass, 4 sand, 5 forest
  const cid = new Int32Array(NX * NY * NZ).fill(-1);
  const I = (x, y, z) => (y * NZ + z) * NX + x;
  const top = new Int16Array(NX * NZ).fill(-1);
  const cx = (NX - 1) / 2, cz = (NZ - 1) / 2;
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const dx = (x - cx) / RX, dz = (z - cz) / RZ;
    const ang = Math.atan2(dz, dx);
    const edge = 0.86 + 0.14 * n2(Math.cos(ang) * 3 + 7, Math.sin(ang) * 3 + 7);
    const r = Math.hypot(dx, dz) / edge;
    if (r >= 1) continue;
    const h = Math.round(10 + 13 * fbm(x, z) + 3 * (1 - r * r) - 2 * r * r);
    const bottom = Math.round(13 - 13 * Math.pow(1 - r, 0.55) * (0.85 + 0.3 * n2(x / 5, z / 5)));
    for (let y = Math.max(0, bottom); y <= h; y++) occ[I(x, y, z)] = y === h ? (h <= WATER + 1 ? 4 : 3) : y > h - 3 ? 2 : 1;
    top[z * NX + x] = h;
  }
  // the forest: site percolation at p_c in a slab above the ground, inside an inner disc
  const rnd = mulberry32(1950);
  const parent = new Int32Array(NX * NY * NZ).fill(-1);
  const thr = new Float32Array(NX * NY * NZ);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const SLAB = 16;
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const h = top[z * NX + x];
    const r = Math.hypot((x - cx) / RX, (z - cz) / RZ);
    if (h < 0 || h <= WATER + 1 || r > 0.8) continue;
    for (let y = h + 1; y <= Math.min(NY - 1, h + SLAB); y++) {
      const u = rnd();
      if (u < P_C) { const i = I(x, y, z); occ[i] = 5; parent[i] = i; thr[i] = u; }
    }
  }
  const nb = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const i = I(x, y, z);
    if (occ[i] !== 5) continue;
    for (const [a, b, c] of nb) {
      const X = x + a, Y = y + b, Z = z + c;
      if (X < NX && Y < NY && Z < NZ && occ[I(X, Y, Z)] === 5) unite(i, I(X, Y, Z));
    }
  }
  // keep clusters rooted on the ground; record sizes
  const size = new Map(), rooted = new Set();
  for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const i = I(x, y, z);
    if (occ[i] !== 5) continue;
    const r = find(i);
    size.set(r, (size.get(r) || 0) + 1);
    if (y > 0 && occ[I(x, y - 1, z)] && occ[I(x, y - 1, z)] !== 5) rooted.add(r);
  }
  let largest = -1, lsz = 0;
  for (const r of rooted) if (size.get(r) > lsz) { lsz = size.get(r); largest = r; }
  let kept = 0, clusters = 0;
  const seen = new Set();
  for (let i = 0; i < occ.length; i++) {
    if (occ[i] !== 5) continue;
    const r = find(i);
    if (!rooted.has(r) || size.get(r) < 3) { occ[i] = 0; continue; }
    cid[i] = r === largest ? 0 : 1 + (r % 7);
    kept++;
    if (!seen.has(r)) { seen.add(r); clusters++; }
  }
  return { occ, cid, thr, top, I, kept, clusters, largest: lsz, cx, cz };
}

const COL = {
  1: [0.36, 0.42, 0.52], 2: [0.47, 0.34, 0.22], 3: [0.33, 0.6, 0.2], 4: [0.86, 0.8, 0.58],
};
const LEAF = [[0.2, 0.46, 0.16], [0.25, 0.52, 0.18], [0.17, 0.4, 0.15], [0.3, 0.55, 0.2], [0.22, 0.5, 0.24], [0.27, 0.45, 0.14], [0.19, 0.42, 0.2]];
const AO = [0.42, 0.6, 0.8, 1.0];

function meshIsland(isl) {
  const { occ, cid, thr, I } = isl;
  const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < NX && y < NY && z < NZ && occ[I(x, y, z)] !== 0;
  const ground = (x, y, z) => solid(x, y, z) && occ[I(x, y, z)] !== 5;
  const pos = [], nrm = [], col = [], idx = [], th = [];
  const FACES = [
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  ];
  const rnd = mulberry32(5);
  for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const i = I(x, y, z), t = occ[i];
    if (!t) continue;
    const jitter = 0.92 + 0.16 * rnd();
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      if (t === 5 ? ground(x + nx, y + ny, z + nz) : solid(x + nx, y + ny, z + nz)) continue;
      let c;
      if (t === 5) c = cid[i] === 0 ? [1.9, 1.15, 0.3] : LEAF[cid[i] - 1];
      else if (t === 3 && ny !== 1) c = COL[2];
      else c = COL[t];
      if (ny === -1) c = c.map((v) => v * 0.7);
      const base = pos.length / 3;
      const ao = [];
      for (const corner of f.c) {
        pos.push(x + corner[0], y + corner[1], z + corner[2]);
        nrm.push(nx, ny, nz);
        // ambient occlusion from the three voxels around this corner, in the layer in front of the face
        const d = corner.map((v, k) => (f.n[k] !== 0 ? f.n[k] : v * 2 - 1));
        const u = f.n.map((v) => v === 0), axes = [0, 1, 2].filter((k) => u[k]);
        const s1 = [...f.n], s2 = [...f.n], cc = [...f.n];
        s1[axes[0]] = d[axes[0]]; s2[axes[1]] = d[axes[1]]; cc[axes[0]] = d[axes[0]]; cc[axes[1]] = d[axes[1]];
        const a = solid(x + s1[0], y + s1[1], z + s1[2]), b = solid(x + s2[0], y + s2[1], z + s2[2]), k = solid(x + cc[0], y + cc[1], z + cc[2]);
        const lvl = a && b ? 0 : 3 - (a + b + k);
        ao.push(lvl);
        const g = AO[lvl] * jitter;
        col.push(c[0] * g, c[1] * g, c[2] * g);
        th.push(t === 5 ? thr[i] : -1);
      }
      if (ao[0] + ao[2] < ao[1] + ao[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('thr', new THREE.Float32BufferAttribute(th, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Catmull-Rom through keyed points [bar, Vector3] (b may run past N_BARS for
// the wrap). Bars map to the curve parameter through a monotone cubic, so the
// camera's speed is continuous through every key, including the loop seam.
function keyedSpline(keys) {
  const pts = keys.map((k) => k[1]);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);   // uniform: C1 in u
  const map = new Pchip(keys.map((k) => k[0]), keys.map((_, i) => i / (keys.length - 1)));
  return (b) => {
    const u = clamp(map.at(b));
    return { p: curve.getPoint(u), u };
  };
}

export class Percolation extends Piece {
  constructor() {
    super('percolation', { appearS: S_OF.percolation - 120, window: WINDOWS.percolation });
    const isl = this.isl = buildIsland();
    // world placement: the line passes through the island's centre column
    const C = L.percolation.center;
    const groundH = isl.top[Math.round(isl.cz) * NX + Math.round(isl.cx)];
    this.origin = new THREE.Vector3(C.x - isl.cx - 0.5, C.y - groundH + 2, C.z - isl.cz - 0.5);
    this.center = C.clone();
    const geo = meshIsland(isl);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // sites open as p rises: a voxel shows only once its own uniform draw is below p
    this.uP = { value: P_C };
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uP = this.uP;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float thr;\nvarying float vThr;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvThr = thr;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uP;\nvarying float vThr;')
        .replace('void main() {', 'void main() {\n  if (vThr > uP) discard;');
    };
    this.mat.customProgramCacheKey = () => 'percolation-p';
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.copy(this.origin);
    this.root.add(this.mesh);
    // water: one sheet at the water line, clipped to the island footprint by its own alpha map
    const wc = document.createElement('canvas'); wc.width = wc.height = NX;
    const wg = wc.getContext('2d'), wd = wg.createImageData(NX, NZ);
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
      const h = isl.top[z * NX + x], k = (z * NX + x) * 4;
      const v = h >= 0 && h <= WATER ? 255 : 0;
      wd.data[k] = wd.data[k + 1] = wd.data[k + 2] = 255; wd.data[k + 3] = v;
    }
    wg.putImageData(wd, 0, 0);
    const wt = new THREE.CanvasTexture(wc); wt.magFilter = THREE.NearestFilter; wt.flipY = false;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(NX, NZ), new THREE.MeshStandardMaterial({
      color: 0x2f6fa8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, alphaMap: wt, depthWrite: false,
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(this.origin.x + NX / 2, this.origin.y + WATER + 0.82, this.origin.z + NZ / 2);
    this.root.add(water);
    // sunlight
    const sunDir = new THREE.Vector3(0.4, 0.55, -0.73).normalize();
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.9);
    this.sun.position.copy(C).addScaledVector(sunDir, 200);
    this.sun.target.position.copy(C);
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x4a3c2a, 0.85);
    this.root.add(this.sun, this.sun.target, this.hemi);

    this.heightAt = (wx, wz) => {    // highest solid voxel top near a world xz
      const x = Math.round(wx - this.origin.x), z = Math.round(wz - this.origin.z);
      let h = -1e9;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const X = x + dx, Z = z + dz;
        if (X < 0 || Z < 0 || X >= NX || Z >= NZ) continue;
        for (let y = NY - 1; y >= 0; y--) if (isl.occ[isl.I(X, y, Z)]) { h = Math.max(h, y + 1); break; }
      }
      return h === -1e9 ? null : this.origin.y + h;
    };
    this.buildPaths();
    console.log(`percolation island: ${isl.kept} forest voxels in ${isl.clusters} clusters (largest ${isl.largest}), ${geo.index.count / 6} faces`);
  }

  // flight paths low over the island; heights follow the terrain and the forest
  buildPaths() {
    const C = this.center;
    const low = (dx, dz, clear, b) => {
      const h = this.heightAt(C.x + dx, C.z + dz);
      return [b, new THREE.Vector3(C.x + dx, (h ?? C.y) + clear, C.z + dz)];
    };
    const rel = (dx, dy, dz, b) => [b, new THREE.Vector3(C.x + dx, C.y + dy, C.z + dz)];
    // the loop: dive in at the end, keep flying after the seam, whip out at 0.75
    this.loopPath = keyedSpline([
      rel(30, 34, 52, 41.55), low(20, 26, 8, 41.8), low(10, 10, 6.5, 42.0), low(1, -1, 6, 42.25),
      low(-6, -10, 6.5, 42.5), rel(-10, 40, -16, 42.78), rel(-12, 90, -20, 43.0),
    ]);
    // the climax drop: swoop up over the rim at bar 26, low across, rise out at 29
    this.dropPath = keyedSpline([
      rel(66, 52, 46, 25.55), rel(48, 34, 34, 25.8), rel(32, 22, 26, 25.95), low(24, 22, 8, 26.15), low(12, 4, 6.5, 26.7), low(0, -12, 6.5, 27.3),
      low(-14, -16, 6.5, 27.9), low(-20, 2, 7.5, 28.5), rel(-18, 38, 20, 28.95), rel(-6, 72, 22, 29.15),
    ]);
    // look along the horizontal direction of travel, tilted down by `down` radians
    const pose = (path, b, db = 0.02, down = 0.78) => {
      const { p } = path(b);
      const q = path(b + db).p;
      const fwd = q.clone().sub(p);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
      fwd.normalize().multiplyScalar(Math.cos(down));
      const look = p.clone().add(fwd).add(new THREE.Vector3(0, -Math.sin(down), 0));
      const m = new THREE.Matrix4().lookAt(p, look, new THREE.Vector3(0, 1, 0));
      return { pos: p, quat: new THREE.Quaternion().setFromRotationMatrix(m), fov: 52 };
    };
    const unwrap = (b) => (b < N_BARS / 2 ? b + N_BARS : b);   // 0..21 -> 42..63
    this.cameraPath = {
      weight: (b) => {
        b = wrap(b);
        const u = unwrap(b);
        const loopW = smoothstep(41.48, 41.72, u) * (1 - smoothstep(42.6, 42.8, u));
        const dropW = smoothstep(25.5, 25.66, b) * (1 - smoothstep(28.9, 29.12, b));
        return Math.max(loopW, dropW);
      },
      pose: (b) => {
        b = wrap(b);
        const u = unwrap(b);
        if (u > 41.3 && u < 43.2) return pose(this.loopPath, u);
        return pose(this.dropPath, b, 0.02, 0.8);
      },
    };
  }

  // daylight: inside the world the sky and fog take over
  worldWeight(b) {
    b = wrap(b);
    const u = b < N_BARS / 2 ? b + N_BARS : b;
    const loop = smoothstep(41.6, 41.78, u) * (1 - smoothstep(42.56, 42.7, u));
    const drop = smoothstep(25.92, 26.05, b) * (1 - smoothstep(28.85, 29.02, b));
    return Math.max(loop, drop);
  }

  pAt(b) {
    b = wrap(b);
    if (b >= 25.6 || b < 3) return P_C;
    return P_C * smoothstep(22.3, 25.6, b) ** 1.2;
  }

  update(b, ctx) {
    b = wrap(b);
    this.uP.value = this.pAt(b);
    const near = ctx.camera.position.distanceTo(this.center) < 900;
    this.root.visible = this.presence(ctx, 40) > 0 && (near || (b > 38.3 && b < 41.9));
  }

  labels(b) {
    b = wrap(b);
    const a = smoothstep(26.6, 26.8, b) * (1 - smoothstep(28.5, 28.7, b));
    const C = this.center;
    const pa = smoothstep(22.4, 22.6, b) * (1 - smoothstep(25.5, 25.7, b));
    const p = this.pAt(b);
    return [
      { screen: [0.5, 0.84], text: p >= P_C - 1e-6 ? `p = p_{c} ≈ ${P_C}` : `p = ${p.toFixed(4)}`, style: 'monoBold', size: 46, align: 'center', alpha: pa },
      { screen: [0.5, 0.84], text: 'each site of ℤ³ open with probability p', style: 'label', size: 20, align: 'center', dy: 40, alpha: pa * 0.85, color: 'rgba(205,207,218,1)' },
      { screen: [0.5, 0.86], text: `trees: clusters of site percolation on ℤ³ at p_{c} ≈ ${P_C}`, style: 'label', size: 22, align: 'center', alpha: a * 0.95 },
      { screen: [0.5, 0.886], text: 'every one of them ends', style: 'serif', size: 30, align: 'center', alpha: a, dy: 22 },
    ];
  }
}
