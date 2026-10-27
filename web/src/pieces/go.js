// 2016 · AlphaGo. A thick wooden board; Game 2's first 36 moves land on the
// sixteenth notes of the theme, faster and faster, and Move 37 (the fifth-line
// shoulder hit) lands on the downbeat of bar 8 inside a ring of light.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { GO_MOVES } from '../data.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { clamp, ease, smoothstep, wrap, mulberry32 } from '../time.js';
import { Lines } from '../gfx/lines.js';

const STEP = 0.62;              // grid spacing
const N = 19;
const HALF = (N - 1) / 2 * STEP;
const SIZE = HALF * 2 + 1.1;    // board edge
const THICK = 1.6;

// bar at which move i (0-based) lands: 1-28 on sixteenths from bar 6, 29-36
// on thirty-seconds (a fill), 37 on the downbeat of bar 8
export function moveBar(i) {
  if (i < 28) return 6.0 + i / 16;
  if (i < 36) return 7.6875 + (i - 28) / 32;
  return 8.0;
}

function woodTexture(grid) {
  const c = document.createElement('canvas');
  c.width = c.height = 2048;
  const g = c.getContext('2d');
  const rnd = mulberry32(19);
  g.fillStyle = '#b8874b';
  g.fillRect(0, 0, 2048, 2048);
  // grain: long wavy strands
  for (let i = 0; i < 420; i++) {
    const y0 = rnd() * 2048, amp = 6 + rnd() * 22, f = 0.0015 + rnd() * 0.003, ph = rnd() * 6.28;
    g.strokeStyle = `rgba(${120 + rnd() * 40},${70 + rnd() * 30},${20 + rnd() * 20},${0.05 + rnd() * 0.12})`;
    g.lineWidth = 1 + rnd() * 4;
    g.beginPath();
    for (let x = 0; x <= 2048; x += 16) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25);
    g.stroke();
  }
  if (grid) {
    const px = 2048 / SIZE;
    const o = (SIZE / 2 - HALF) * px;
    g.strokeStyle = 'rgba(25,16,8,0.85)';
    g.lineWidth = 3;
    for (let i = 0; i < N; i++) {
      const p = o + i * STEP * px;
      g.beginPath(); g.moveTo(o, p); g.lineTo(2048 - o, p); g.stroke();
      g.beginPath(); g.moveTo(p, o); g.lineTo(p, 2048 - o); g.stroke();
    }
    g.fillStyle = 'rgba(25,16,8,0.9)';
    for (const a of [3, 9, 15]) for (const bb of [3, 9, 15]) {
      g.beginPath(); g.arc(o + a * STEP * px, o + bb * STEP * px, 9, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Go extends Piece {
  constructor() {
    super('alphago', { appearS: S_OF.alphago - 60, window: WINDOWS.alphago });
    const C = L.alphago.center;
    this.center = C;
    const board = new THREE.Group();
    board.position.copy(C);
    this.root.add(board);
    this.board = board;

    const side = new THREE.MeshStandardMaterial({ map: woodTexture(false), roughness: 0.6, envMapIntensity: 0.2 });
    const top = new THREE.MeshStandardMaterial({ map: woodTexture(true), roughness: 0.45, envMapIntensity: 0.22 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(SIZE, THICK, SIZE), [side, side, top, side, side, side]);
    box.position.y = -THICK / 2;
    box.receiveShadow = true;
    board.add(box);

    const geo = new THREE.SphereGeometry(0.29, 32, 16);
    geo.scale(1, 0.42, 1);
    geo.translate(0, 0.12, 0);
    const blackM = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.32, envMapIntensity: 0.45 });
    const whiteM = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.22, envMapIntensity: 0.4 });
    this.stones = GO_MOVES.map(([c, col, row], i) => {
      const m = new THREE.Mesh(geo, c === 'B' ? blackM : whiteM);
      m.castShadow = true;
      m.userData = { x: -HALF + col * STEP, z: -HALF + row * STEP, bar: moveBar(i) };
      board.add(m);
      return m;
    });
    const m37 = this.stones[36].userData;
    this.move37 = new THREE.Vector3(C.x + m37.x, C.y, C.z + m37.z);
    // ring around Move 37
    const segs = [];
    for (let k = 0; k < 64; k++) {
      const a0 = k / 64 * Math.PI * 2, a1 = (k + 1) / 64 * Math.PI * 2;
      segs.push({ a: new THREE.Vector3(Math.cos(a0), 0, Math.sin(a0)), b: new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), color: [1, 1, 1], width: 2.2 });
    }
    this.ring = new Lines(segs, { blending: THREE.AdditiveBlending });
    this.ring.mesh.position.set(m37.x, 0.05, m37.z);
    board.add(this.ring.mesh);

    const key = new THREE.DirectionalLight(0xfff0dc, 1.3);
    key.position.set(C.x - 10, C.y + 18, C.z + 8);
    key.target.position.copy(C);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);
    fill.position.set(C.x + 12, C.y + 5, C.z - 10);
    fill.target.position.copy(C);
    this.root.add(key, key.target, fill, fill.target);
    this.key = key;
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 300);
    if (!this.root.visible) return;
    this.key.castShadow = ctx.camera.position.distanceTo(this.center) < 80;
    // before its time in this lap (the rewind and the opening) the board is complete
    const live = b >= 5.5 && b < 10;
    for (const s of this.stones) {
      const u = s.userData;
      const t = live ? clamp((b - u.bar + 0.06) / 0.06) : (b >= 10 || b < 5.5 ? 1 : 0);
      s.visible = t > 0;
      const drop = 1 - ease.outCubic(t);
      s.position.set(u.x, drop * 1.2, u.z);
      const sq = 1 + 0.18 * Math.exp(-Math.max(0, b - u.bar) * 40) * (b >= u.bar ? 1 : 0);
      s.scale.set(sq, 1 / sq, sq);
    }
    const r = clamp((b - 8.0) / 0.5);
    const ringOn = b >= 8.0 && b < 10 ? 1 - smoothstep(9.2, 9.8, b) * 0.7 : b >= 10 || b < 5.5 ? 0.3 : 0;
    this.ring.mesh.scale.setScalar(0.4 + 0.55 * ease.outCubic(r) + 0.04 * Math.sin(b * 12));
    this.ring.set({ res: ctx.res, opacity: ringOn, gain: 1.6 + 2.0 * Math.exp(-Math.max(0, b - 8) * 6) });
  }

  labels(b) {
    b = wrap(b);
    const a = smoothstep(8.05, 8.25, b) * (1 - smoothstep(8.95, 9.1, b));
    return [
      { p: this.move37.clone().add(new THREE.Vector3(0.9, 0.3, 0)), text: 'Move 37', style: 'serif', size: 40, alpha: a },
      { p: this.move37.clone().add(new THREE.Vector3(0.9, 0.3, 0)), text: 'a 1-in-10,000 move', style: 'label', size: 18, alpha: a * 0.85, dy: 26, color: 'rgba(205,206,216,1)' },
    ];
  }
}
