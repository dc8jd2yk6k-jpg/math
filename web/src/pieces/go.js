// 2016 · AlphaGo. The board replays the real first 37 moves of Game 2 on the
// 16th-note grid; Move 37, the fifth-line shoulder hit, lands on the downbeat.
import * as THREE from 'three';
import { Piece, frameMatrix } from './common.js';
import { boardMaterial } from './chess.js';
import { makeSegments, makePoints } from '../gfx/glow.js';
import { GO_MOVES } from '../data.js';
import { rng, clamp, ease, hexToRgb, smoothstep } from '../util.js';
import { PALETTE } from '../config.js';

const SP = 1.6;     // grid spacing
const MOVE37_BAR = 8;

export function moveBar(i) {   // i = 0..36
  if (i === 36) return MOVE37_BAR;
  return 6.05 + i * (1.88 / 36);
}

export class Go extends Piece {
  constructor(A) {
    super(5.6, 10.2, 0.4, 0.8);
    this.local = new THREE.Group();
    this.local.matrixAutoUpdate = false;
    this.local.matrix.copy(frameMatrix(6.0, A.go));
    this.root.add(this.local);
    const jade = hexToRgb(PALETTE.jade);
    const size = 18 * SP;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(size, size), boardMaterial(19, jade.map((c) => c * 0.75), { lines: 1, star: 1, checker: 0 }));
    board.rotation.x = -Math.PI / 2;
    board.frustumCulled = false;
    this.board = board;
    this.local.add(board);

    // stones: soft discs lying on the board
    const disc = new THREE.CircleGeometry(SP * 0.46, 40);
    disc.rotateX(-Math.PI / 2);
    this.stones = GO_MOVES.map(([c, x, y], i) => {
      const white = c === 'W';
      const mat = new THREE.ShaderMaterial({
        uniforms: { uGain: { value: 1 }, uWhite: { value: white ? 1 : 0 }, uHi: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */`
          uniform float uGain; uniform float uWhite; uniform float uHi;
          varying vec2 vP;
          void main() {
            float r = length(vP) / ${(SP * 0.46).toFixed(3)};
            float rim = exp(-pow((r - 0.92) * 9.0, 2.0));
            vec3 col = uWhite > 0.5 ? vec3(1.0, 1.0, 0.97) * (0.9 + 0.6 * (1.0 - r * r)) + vec3(0.6, 1.0, 0.9) * rim
                                   : vec3(0.25, 1.0, 0.8) * rim * 1.6 + vec3(0.02, 0.06, 0.05);
            col += vec3(1.0, 0.9, 0.6) * uHi * (1.5 + rim * 3.0);
            gl_FragColor = vec4(col * uGain, 1.0);
          }`,
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(disc, mat);
      m.position.set((x - 9) * SP, 0.05, (y - 9) * SP);
      m.frustumCulled = false;
      m.userData = { bar: moveBar(i) };
      this.local.add(m);
      return m;
    });
    const s37 = this.stones[36];
    this.move37Local = s37.position.clone();

    // Move 37: shockwave rings + light beam
    const ring = [];
    for (let k = 0; k < 3; k++) {
      const n = 96;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        ring.push({ a: new THREE.Vector3(Math.cos(a0), 0, Math.sin(a0)), b: new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1)), color: [1.4, 1.2, 0.7], width: 0.05, alpha: 1 });
      }
    }
    this.rings = [0, 1, 2].map((k) => {
      const m = makeSegments(ring.slice(0, 96), { minPx: 1.5, core: 1 });
      m.position.copy(this.move37Local);
      this.local.add(m);
      return m;
    });
    this.beam = makeSegments([{ a: new THREE.Vector3(0, 0, 0), b: new THREE.Vector3(0, 40, 0), color: [1.6, 1.4, 0.9], width: 0.25 }], { minPx: 2, core: 1.5 });
    this.beam.position.copy(this.move37Local);
    this.local.add(this.beam);

    // policy / value network layers hovering above the board
    const r = rng(19);
    const layerPts = [], conn = [];
    const layers = [{ h: 7, n: 9, s: 2.6 }, { h: 11.5, n: 7, s: 2.6 }, { h: 16, n: 5, s: 2.6 }, { h: 20, n: 1, s: 1 }];
    const nodes = layers.map((L, li) => {
      const arr = [];
      for (let i = 0; i < L.n; i++) for (let j = 0; j < L.n; j++) {
        const p = new THREE.Vector3((i - (L.n - 1) / 2) * L.s, L.h, (j - (L.n - 1) / 2) * L.s);
        arr.push(p);
        layerPts.push({ p, color: li === 3 ? [2, 1.8, 1.2] : [0.4, 1.4, 1.1], size: li === 3 ? 0.9 : 0.35, born: 6.4 + li * 0.25, fadeIn: 0.1 });
      }
      return arr;
    });
    for (let li = 0; li < layers.length - 1; li++) {
      const A0 = nodes[li], A1 = nodes[li + 1];
      for (let k = 0; k < (li === 2 ? 25 : 70); k++) {
        const a = A0[Math.floor(r() * A0.length)], b2 = A1[Math.floor(r() * A1.length)];
        conn.push({ a, b: b2, color: [0.2, 0.8, 0.65], width: 0.04, alpha: 0.6, born: 6.5 + li * 0.25 + r() * 0.2, grow: 0.15 });
      }
    }
    // board -> first layer (input planes)
    for (let k = 0; k < 60; k++) {
      const a = new THREE.Vector3((Math.floor(r() * 19) - 9) * SP, 0.1, (Math.floor(r() * 19) - 9) * SP);
      conn.push({ a, b: nodes[0][Math.floor(r() * nodes[0].length)], color: [0.2, 0.7, 0.6], width: 0.03, alpha: 0.4, born: 6.3 + r() * 0.3, grow: 0.15 });
    }
    this.net = makePoints(layerPts, { minPx: 2, maxPx: 12 });
    this.conn = makeSegments(conn, { minPx: 1, core: 0.5 });
    this.local.add(this.net); this.local.add(this.conn);
    this.move37World = this.move37Local.clone().applyMatrix4(this.local.matrix);
    this.netTop = new THREE.Vector3(0, 20, 0).applyMatrix4(this.local.matrix);
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    this.board.material.uniforms.uReveal.value = ease.outCubic(clamp((b - 5.8) / 0.45)) * 1.1;
    this.board.material.uniforms.uGain.value = g * (0.9 + 0.3 * ctx.beat);
    this.stones.forEach((m, i) => {
      const t = b - m.userData.bar;
      const k = ease.outBack(clamp(t / (i === 36 ? 0.08 : 0.06)));
      m.scale.setScalar(Math.max(0.001, k));
      m.position.y = 0.05 + (1 - clamp(t / 0.06)) * (i === 36 ? 6 : 2);
      m.material.uniforms.uGain.value = g * clamp(t / 0.02);
      m.material.uniforms.uHi.value = i === 36 ? Math.exp(-Math.max(0, t) * 1.2) * (t >= 0 ? 1 : 0) + (t >= 0 ? 0.25 : 0) : 0;
    });
    const t37 = b - MOVE37_BAR;
    this.rings.forEach((m, k) => {
      const tt = t37 - k * 0.12;
      const vis = tt > 0 && tt < 1.2;
      m.visible = vis;
      if (vis) {
        m.scale.setScalar(0.5 + tt * 22);
        m.material.uniforms.uGain.value = g * Math.exp(-tt * 3.2) * 2;
      }
    });
    this.beam.visible = t37 > 0;
    this.beam.material.uniforms.uGain.value = g * (t37 > 0 ? Math.exp(-t37 * 1.5) * 2.5 + 0.3 : 0);
    this.net.material.uniforms.uGain.value = g * smoothstep(6.3, 6.6, b) * (1 - smoothstep(8.6, 9.4, b) * 0.6);
    this.conn.material.uniforms.uGain.value = g * (1 - smoothstep(8.6, 9.4, b) * 0.7);
  }
}
