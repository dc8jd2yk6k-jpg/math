// 2016 · AlphaGo. A wooden board replays the real first 37 moves of Game 2 on
// the 16th-note grid; Move 37, the fifth-line shoulder hit, lands on bar 8
// and gets a white ring.
import * as THREE from 'three';
import { Piece, setOpacity } from './common.js';
import { tiltedBasis } from './chess.js';
import { makeSegments } from '../gfx/glow.js';
import { spineAt } from '../curve.js';
import { GO_MOVES } from '../data.js';
import { rng, clamp, ease } from '../util.js';

const SP = 0.62;    // grid spacing

export function moveBar(i) {   // i = 0..36
  if (i === 36) return 8;
  return 6.05 + i * (1.85 / 36);
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 2048;
  const ctx = c.getContext('2d');
  const r = rng(2016);
  const g = ctx.createLinearGradient(0, 0, 2048, 2048);
  g.addColorStop(0, '#b98f52'); g.addColorStop(1, '#a87b40');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 900; i++) {   // grain
    const y = r() * 2048;
    ctx.strokeStyle = `rgba(120,72,30,${0.03 + r() * 0.07})`;
    ctx.lineWidth = 1 + r() * 4;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 2048; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.004 + i) * 10 + (r() - 0.5) * 3);
    ctx.stroke();
  }
  // 19x19 grid, 1 cell margin
  const m = 2048 / 20, step = (2048 - 2 * m) / 18;
  ctx.strokeStyle = 'rgba(30,18,8,0.85)'; ctx.lineWidth = 3;
  for (let i = 0; i < 19; i++) {
    ctx.beginPath(); ctx.moveTo(m, m + i * step); ctx.lineTo(2048 - m, m + i * step); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m + i * step, m); ctx.lineTo(m + i * step, 2048 - m); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,18,8,0.95)';
  for (const a of [3, 9, 15]) for (const b of [3, 9, 15]) { ctx.beginPath(); ctx.arc(m + a * step, m + b * step, 9, 0, Math.PI * 2); ctx.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Go extends Piece {
  constructor() {
    super(5.6, 10.1, 0.35, 0.5);
    const { bx, by, bz, f } = tiltedBasis(7.0, 34);
    this.local = new THREE.Group();
    this.local.matrixAutoUpdate = false;
    const c = spineAt(7.4).addScaledVector(f.U, -3.4).addScaledVector(f.F, -3.5).addScaledVector(f.R, 0.2);
    this.local.matrix.makeBasis(bx, by, bz).setPosition(c);
    this.root.add(this.local);
    this.center = c.clone().addScaledVector(by, 0.6).addScaledVector(f.U, 1.2);

    const size = 20 * SP;
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62 });
    const side = new THREE.MeshStandardMaterial({ color: 0xb98848, roughness: 0.7 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(size, 1.0, size), [side, side, wood, side, side, side]);
    board.position.y = -0.5;
    board.receiveShadow = true;
    this.local.add(board);

    const geo = new THREE.SphereGeometry(SP * 0.47, 40, 20);
    geo.scale(1, 0.42, 1);
    geo.translate(0, SP * 0.47 * 0.42, 0);
    const wMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.3 });
    const bMat = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.22 });
    this.stones = GO_MOVES.map(([col, x, y], i) => {
      const m = new THREE.Mesh(geo, (col === 'W' ? wMat : bMat).clone());
      m.position.set((x - 9) * SP, 0, (y - 9) * SP);
      m.castShadow = true;
      m.userData = { t: moveBar(i) };
      this.local.add(m);
      return m;
    });
    const s37 = this.stones[36].position;
    // white ring around Move 37
    const ring = [];
    const n = 96, R = SP * 0.85;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      ring.push({ a: new THREE.Vector3(Math.cos(a0) * R, 0.02, Math.sin(a0) * R), b: new THREE.Vector3(Math.cos(a1) * R, 0.02, Math.sin(a1) * R), color: [1, 1, 1], width: 0.04, born: 8.0 + (i / n) * 0.25, grow: 0.01 });
    }
    this.ring = makeSegments(ring, { minPx: 2.0, core: 1.0 });
    this.ring.position.copy(s37);
    this.local.add(this.ring);
    this.move37 = s37.clone().applyMatrix4(this.local.matrix);
    this.labels = [{ p: this.move37, text: 'Move 37', b0: 8.15, b1: 9.8, dx: 70, dy: -70 }];
    this.lightTarget = c.clone();
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    setOpacity(this.root, this.g);
    this.stones.forEach((m, i) => {
      const k = clamp((b - m.userData.t) / 0.06);
      m.visible = b >= m.userData.t;
      m.position.y = (1 - ease.outCubic(k)) * (i === 36 ? 1.8 : 0.9);
    });
    this.ring.material.uniforms.uGain.value = this.g * 1.4;
  }
}
