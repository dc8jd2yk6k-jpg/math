// 1997 · Deep Blue. A lit, realistic board showing the real final position of
// Game 6 (Kasparov resigned after 19.c4). Pieces settle on the 16th notes; the
// black king tips over on bar 4.5.
import * as THREE from 'three';
import { Piece, setOpacity, contactShadow } from './common.js';
import { frameAt, spineAt } from '../curve.js';
import { CHESS_FEN } from '../data.js';
import { rng, clamp, ease } from '../util.js';

const SQ = 1.2;

function lathe(profile, s) {
  return new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r * s, h * s)), 48);
}

function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; parts.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((g) => { pos.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export function pieceGeometry(type, s) {
  switch (type) {
    case 'p': return lathe([[0, 0], [0.34, 0], [0.34, 0.07], [0.27, 0.13], [0.18, 0.2], [0.13, 0.42], [0.22, 0.46], [0.14, 0.5], [0.19, 0.6], [0.2, 0.7], [0.15, 0.79], [0.06, 0.83], [0, 0.84]], s);
    case 'r': return lathe([[0, 0], [0.37, 0], [0.37, 0.08], [0.29, 0.15], [0.23, 0.22], [0.2, 0.7], [0.27, 0.76], [0.29, 0.98], [0.21, 0.98], [0.21, 0.9], [0, 0.9]], s);
    case 'b': return lathe([[0, 0], [0.36, 0], [0.36, 0.08], [0.27, 0.14], [0.17, 0.24], [0.13, 0.62], [0.23, 0.66], [0.14, 0.7], [0.2, 0.86], [0.17, 1.0], [0.08, 1.1], [0.05, 1.16], [0.07, 1.2], [0, 1.24]], s);
    case 'q': return lathe([[0, 0], [0.4, 0], [0.4, 0.08], [0.3, 0.15], [0.19, 0.27], [0.14, 0.82], [0.27, 0.86], [0.15, 0.92], [0.27, 1.16], [0.2, 1.2], [0.08, 1.24], [0.1, 1.3], [0, 1.36]], s);
    case 'k': {
      const g = lathe([[0, 0], [0.4, 0], [0.4, 0.08], [0.3, 0.15], [0.2, 0.27], [0.15, 0.88], [0.28, 0.92], [0.16, 0.98], [0.26, 1.18], [0.12, 1.26], [0, 1.27]], s);
      const c1 = new THREE.BoxGeometry(0.07 * s, 0.3 * s, 0.07 * s); c1.translate(0, 1.4 * s, 0);
      const c2 = new THREE.BoxGeometry(0.22 * s, 0.07 * s, 0.07 * s); c2.translate(0, 1.45 * s, 0);
      return mergeGeos([g, c1, c2]);
    }
    case 'n': {
      const base = lathe([[0, 0], [0.37, 0], [0.37, 0.08], [0.27, 0.15], [0.2, 0.25], [0, 0.25]], s);
      const sh = new THREE.Shape();
      const P = [[-0.18, 0.2], [0.2, 0.2], [0.17, 0.5], [0.24, 0.8], [0.12, 1.02], [-0.04, 1.08], [-0.1, 1.02], [-0.3, 0.86], [-0.32, 0.74], [-0.22, 0.72], [-0.06, 0.78], [-0.2, 0.5]];
      sh.moveTo(P[0][0] * s, P[0][1] * s);
      P.slice(1).forEach(([x, y]) => sh.lineTo(x * s, y * s));
      const head = new THREE.ExtrudeGeometry(sh, { depth: 0.22 * s, bevelEnabled: true, bevelSize: 0.03 * s, bevelThickness: 0.03 * s, bevelSegments: 2 });
      head.translate(0, 0, -0.11 * s);
      return mergeGeos([base, head]);
    }
  }
  return null;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const r = rng(97);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const light = (i + j) % 2 === 0;
    ctx.fillStyle = light ? '#d8d3c8' : '#33312e';
    ctx.fillRect(i * 128, j * 128, 128, 128);
    for (let k = 0; k < 220; k++) {   // fine grain
      ctx.fillStyle = light ? `rgba(120,110,95,${r() * 0.06})` : `rgba(255,255,255,${r() * 0.025})`;
      ctx.fillRect(i * 128 + r() * 128, j * 128 + r() * 128, 1 + r() * 30, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// a board lying "below" the head on screen, seen from `elevationDeg` above its plane
export function tiltedBasis(u, elevationDeg) {
  const f = frameAt(u);
  const th = THREE.MathUtils.degToRad(90 - elevationDeg);
  const by = f.U.clone().multiplyScalar(Math.sin(th)).addScaledVector(f.F, Math.cos(th)).normalize();
  const bx = f.R.clone();
  const bz = new THREE.Vector3().crossVectors(bx, by);
  return { bx, by, bz, f };
}

export class Chess extends Piece {
  constructor() {
    super(1.75, 6.0, 0.3, 0.5);
    const { bx, by, bz, f } = tiltedBasis(3.0, 30);
    this.local = new THREE.Group();
    this.local.matrixAutoUpdate = false;
    const c = spineAt(3.4).addScaledVector(f.U, -3.6).addScaledVector(f.F, -3.5).addScaledVector(f.R, 0.3);
    this.local.matrix.makeBasis(bx, by, bz).setPosition(c);
    this.root.add(this.local);
    this.center = c.clone().addScaledVector(by, 1.0).addScaledVector(f.U, 1.2);

    const top = new THREE.Mesh(new THREE.PlaneGeometry(8 * SQ, 8 * SQ), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.55, metalness: 0 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.001;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8 * SQ + 1.0, 0.4, 8 * SQ + 1.0), new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: 0.6 }));
    frame.position.y = -0.26;   // top sits below the playing surface (no z-fighting)
    this.local.add(top, frame);

    const white = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.32, metalness: 0 });
    const black = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.28, metalness: 0 });
    this.pieces = [];
    const r = rng(3);
    CHESS_FEN.split('/').forEach((row, ri) => {
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { file += Number(ch); continue; }
        const isWhite = ch === ch.toUpperCase();
        const m = new THREE.Mesh(pieceGeometry(ch.toLowerCase(), SQ * 0.92), (isWhite ? white : black).clone());
        m.position.set((file - 3.5) * SQ, 0, (ri - 3.5) * SQ);
        if (!isWhite && ch.toLowerCase() === 'n') m.rotation.y = Math.PI;
        m.userData = { t: 2.0 + Math.floor(r() * 8) * 0.0625, x: m.position.x };
        if (ch === 'k') this.king = m;
        const blob = contactShadow(SQ * 0.5);
        blob.position.x = m.position.x; blob.position.z = m.position.z;
        m.userData.blob = blob;
        this.local.add(m, blob);
        this.pieces.push(m);
        file++;
      }
    });
    this.lightTarget = c.clone();
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    setOpacity(this.root, this.g);
    for (const m of this.pieces) {
      const k = clamp((b - m.userData.t) / 0.12);
      m.position.y = (1 - ease.outCubic(k)) * 2.2;
      m.visible = m.userData.blob.visible = b >= m.userData.t - 0.01;
    }
    // resignation: the black king tips over
    const tip = ease.outQuad(clamp((b - 4.5) / 0.35));
    this.king.rotation.set(0, 0, tip * 1.35);
    this.king.position.x = this.king.userData.x + tip * 0.3;
  }
}
