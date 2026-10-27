// 1997 · Deep Blue. A lit, glossy board with the final position of Game 6
// (after 19.c4, Kasparov resigned). The line runs in low over the black
// pieces; on the downbeat the black king tips over.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { CHESS_FEN } from '../data.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, ease, smoothstep, wrap } from '../time.js';

const SQ = 1.25;
const P = (pts) => pts.map(([r, h]) => new THREE.Vector2(r * SQ, h * SQ));
const BASE = [[0, 0], [0.4, 0], [0.4, 0.07], [0.35, 0.11], [0.37, 0.15], [0.3, 0.2]];
const PROFILES = {
  p: [...BASE, [0.21, 0.28], [0.15, 0.48], [0.24, 0.54], [0.24, 0.58], [0.13, 0.6], [0.19, 0.67], [0.21, 0.75], [0.19, 0.83], [0.13, 0.89], [0.05, 0.92], [0, 0.93]],
  r: [...BASE, [0.27, 0.28], [0.25, 0.68], [0.32, 0.74], [0.34, 1.0], [0.27, 1.0], [0.27, 0.93], [0, 0.93]],
  b: [...BASE, [0.22, 0.3], [0.15, 0.72], [0.26, 0.78], [0.26, 0.82], [0.15, 0.85], [0.2, 0.95], [0.22, 1.06], [0.19, 1.17], [0.12, 1.26], [0.07, 1.3], [0.08, 1.34], [0.05, 1.38], [0, 1.39]],
  q: [...BASE, [0.24, 0.3], [0.15, 0.9], [0.28, 0.98], [0.28, 1.02], [0.16, 1.06], [0.22, 1.22], [0.29, 1.34], [0.2, 1.36], [0.12, 1.42], [0.08, 1.5], [0.06, 1.53], [0, 1.54]],
  k: [...BASE, [0.24, 0.3], [0.16, 0.95], [0.29, 1.03], [0.29, 1.07], [0.17, 1.11], [0.23, 1.28], [0.26, 1.38], [0.12, 1.42], [0.0, 1.43]],
};

function knightGeometry() {
  const s = new THREE.Shape();
  const pts = [[-0.22, 0.25], [0.24, 0.25], [0.26, 0.55], [0.22, 0.85], [0.12, 1.08], [0.02, 1.2], [-0.04, 1.14], [-0.14, 1.12],
    [-0.28, 0.98], [-0.36, 0.86], [-0.34, 0.78], [-0.22, 0.78], [-0.1, 0.82], [-0.14, 0.66], [-0.24, 0.5]];
  s.moveTo(pts[0][0] * SQ, pts[0][1] * SQ);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0] * SQ, pts[i][1] * SQ);
  s.closePath();
  const head = new THREE.ExtrudeGeometry(s, { depth: 0.22 * SQ, bevelEnabled: true, bevelThickness: 0.05 * SQ, bevelSize: 0.05 * SQ, bevelSegments: 3, steps: 1, curveSegments: 4 });
  head.translate(0, 0, -0.11 * SQ);
  const base = new THREE.LatheGeometry(P([...BASE, [0.24, 0.28], [0, 0.29]]), 40);
  const merged = mergeGeoms([base.toNonIndexed(), head.toNonIndexed()]);
  merged.computeVertexNormals();
  return merged;
}

function mergeGeoms(list) {
  const pos = [], nrm = [];
  for (const g of list) {
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nrm.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const s = 1024 / 8;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const light = (r + f) % 2 === 0;
    g.fillStyle = light ? '#d9d4c8' : '#17171a';
    g.fillRect(f * s, r * s, s, s);
  }
  // faint polish streaks
  const img = g.getImageData(0, 0, 1024, 1024);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 6;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Chess extends Piece {
  constructor() {
    super('deepblue', { appearS: S_OF.deepblue - 60, window: WINDOWS.deepblue });
    const C = L.deepblue.center;
    this.center = C;
    const board = new THREE.Group();
    board.position.copy(C);
    this.root.add(board);
    const span = SQ * 8;

    // board top: semi-transparent so the mirrored pieces underneath read as reflections
    const top = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshStandardMaterial({
      map: boardTexture(), roughness: 0.18, metalness: 0, transparent: true, opacity: 0.84, envMapIntensity: 0.28,
    }));
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    top.renderOrder = 2;
    board.add(top);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b120c, roughness: 0.35, envMapIntensity: 0.3 });
    const fw = 0.55, fh = 0.5;
    for (const [w, d, x, z] of [[span + 2 * fw, fw, 0, span / 2 + fw / 2], [span + 2 * fw, fw, 0, -span / 2 - fw / 2], [fw, span, span / 2 + fw / 2, 0], [fw, span, -span / 2 - fw / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), frameMat);
      m.position.set(x, -fh / 2 + 0.01, z);
      m.receiveShadow = true;
      board.add(m);
    }

    const white = new THREE.MeshStandardMaterial({ color: 0xcfc9be, roughness: 0.24, envMapIntensity: 0.35 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.14, envMapIntensity: 0.6 });
    const geo = {};
    for (const k of Object.keys(PROFILES)) geo[k] = new THREE.LatheGeometry(P(PROFILES[k]), 40);
    geo.n = knightGeometry();
    const pieces = new THREE.Group(), mirror = new THREE.Group();
    board.add(pieces, mirror);
    mirror.scale.y = -1;
    const rows = CHESS_FEN.split('/');
    rows.forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += Number(ch); continue; }
        const isW = ch === ch.toUpperCase();
        const k = ch.toLowerCase();
        const mat = isW ? white : black;
        const x = (f - 3.5) * SQ, z = (r - 3.5) * SQ;    // rank 8 at the far side (-z)
        const m = new THREE.Mesh(geo[k], mat);
        if (k === 'n') m.rotation.y = isW ? Math.PI / 2 : -Math.PI / 2;
        m.castShadow = true;
        const mm = new THREE.Mesh(geo[k], mat);
        mm.rotation.copy(m.rotation);
        if (ch === 'k') {
          // the king tips about the edge of its base, toward +x
          const piv = new THREE.Group(), pivM = new THREE.Group();
          piv.position.set(x + 0.4 * SQ, 0, z); pivM.position.copy(piv.position);
          m.position.set(-0.4 * SQ, 0, 0); mm.position.copy(m.position);
          piv.add(m); pivM.add(mm);
          pieces.add(piv); mirror.add(pivM);
          this.king = piv; this.kingMirror = pivM;
        } else {
          m.position.set(x, 0, z); mm.position.copy(m.position);
          pieces.add(m); mirror.add(mm);
        }
        f++;
      }
    });

    // light: a warm key from front-left with soft shadows, plus a cool rim
    const key = new THREE.DirectionalLight(0xfff1df, 1.7);
    key.position.set(C.x - 9, C.y + 16, C.z + 12);
    key.target.position.copy(C);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 50 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const rim = new THREE.DirectionalLight(0xbcd2ff, 1.1);
    rim.position.set(C.x + 10, C.y + 6, C.z - 14);
    rim.target.position.copy(C);
    this.root.add(key, key.target, rim, rim.target);
    this.key = key;
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 300);
    if (!this.root.visible) return;
    this.key.castShadow = ctx.camera.position.distanceTo(this.center) < 80;
    // the resignation: the king tips over on bar 5 (and stays down)
    const t = ease.outBack(clamp((b - 5.0) / 0.3)) * (b >= 5.0 && b < 41.9 ? 1 : 0);
    this.king.rotation.z = -1.42 * t;
    this.kingMirror.rotation.z = -1.42 * t;
  }

  labels(b) {
    b = wrap(b);
    const a = smoothstep(4.25, 4.5, b) * (1 - smoothstep(5.85, 6.0, b));
    const C = this.center;
    return [
      { p: C.clone().add(new THREE.Vector3(-5.8, 0, 5.6)), text: 'Game 6 · 19.c4  1–0', style: 'serif', size: 30, alpha: a },
      { p: C.clone().add(new THREE.Vector3(-5.8, 0, 5.6)), text: 'Kasparov resigns', style: 'label', size: 18, alpha: a * smoothstep(5.0, 5.2, b) * 0.85, dy: 26, color: 'rgba(200,202,214,1)' },
    ];
  }
}
