// 2026.10.06 · 722 manuscripts. Pages stream past the head in a spiral column
// up the wall, faster than they can be read, while a counter runs to 722.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { BAR, clamp, smoothstep, wrap, mulberry32, ease } from '../time.js';

const N = 722;

function pageTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 330;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, 256, 330);
  const rnd = mulberry32(722);
  g.fillStyle = '#26262a'; g.fillRect(40, 30, 176, 9);
  g.fillStyle = '#8a8a90';
  for (let y = 58; y < 300; y += 11) {
    if (rnd() < 0.1) { g.fillRect(70, y + 2, 116, 5); y += 6; continue; }       // a displayed equation
    g.fillRect(28, y, 200 - (rnd() < 0.2 ? rnd() * 90 : 0), 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class Papers extends Piece {
  constructor() {
    super('papers', { appearS: S_OF.papers - 40, window: WINDOWS.papers });
    this.center = L.papers.center;
    const geo = new THREE.PlaneGeometry(2.1, 2.7);
    const mat = new THREE.MeshBasicMaterial({ map: pageTexture(), side: THREE.DoubleSide, transparent: true, color: new THREE.Color(0.32, 0.32, 0.34), depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, N);
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
    this.mat = mat;
    const rnd = mulberry32(1006);
    this.P = Array.from({ length: N }, (_, i) => ({ a: rnd() * Math.PI * 2, r: 9 + 15 * Math.sqrt(rnd()), y: (rnd() - 0.5) * 90, spin: (rnd() - 0.5) * 6, tilt: rnd() * 6.28, t0: i / N, s: 0.7 + 0.6 * rnd() }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 400) && (b >= 31.7 && b < 33.4 || b > 38.3 && b < 41.6 || b > 1 && b < 1.6);
    if (!this.root.visible) return;
    const live = b >= 31.7 && b < 33.4;
    const t = live ? (b - 31.85) * BAR : 4;                     // seconds
    const C = this.center;
    for (let i = 0; i < N; i++) {
      const p = this.P[i];
      const arrive = clamp((b - 31.9 - p.t0 * 0.6) / 0.25);     // pages pour in over the first half bar
      const k = live ? ease.outCubic(arrive) : 1;
      const a = p.a + t * (0.9 + 0.5 * p.s);
      const r = p.r + (1 - k) * 60;
      const y = p.y - t * 18 * p.s + (1 - k) * 40;
      this.v.set(C.x + Math.cos(a) * r, C.y + ((y % 90) + 135) % 90 - 45, C.z + Math.sin(a) * r);
      this.e.set(p.tilt + t * p.spin * 0.3, -a, t * p.spin * 0.2);
      this.q.setFromEuler(this.e);
      this.sc.setScalar(k > 0 ? p.s : 0.0001);
      this.m.compose(this.v, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mat.opacity = live ? smoothstep(31.85, 32.0, b) * (1 - smoothstep(33.0, 33.35, b)) : 0.85;
  }

  labels(b) {
    b = wrap(b);
    const n = Math.round(722 * ease.outCubic(clamp((b - 32.0) / 0.55)));
    const a = smoothstep(32.0, 32.08, b) * (1 - smoothstep(32.85, 32.95, b));
    return [
      { screen: [0.5, 0.62], text: String(n), style: 'monoBold', size: 120, align: 'center', alpha: a },
      { screen: [0.5, 0.62], text: 'manuscripts', style: 'label', size: 24, align: 'center', dy: 44, alpha: a * 0.85, color: 'rgba(210,212,222,1)' },
    ];
  }
}
