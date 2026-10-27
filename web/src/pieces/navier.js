// 2026.09.08 · Navier–Stokes. The forced equations type themselves out; a
// vortex tube of particles tightens and spins up faster and faster (the
// blow-up scenario: vorticity concentrating in finite time) and bursts on the
// brass hit; then the proof's Lean status lands: no goals ■.
import * as THREE from 'three';
import { Piece } from './piece.js';
import { L } from '../layout.js';
import { S_OF } from '../curve.js';
import { WINDOWS } from '../story.js';
import { BAR, clamp, smoothstep, wrap, mulberry32 } from '../time.js';

const N = 26000;
const T_BLOW = 31.5;

export class Navier extends Piece {
  constructor() {
    super('navier', { appearS: S_OF.navier - 40, window: WINDOWS.navier });
    this.center = L.navier.center;
    const rnd = mulberry32(908);
    const seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uSq: { value: 0 }, uBurst: { value: 0 }, uC: { value: this.center.clone() }, uScale: { value: 1 }, uGain: { value: 1 }, uVel: { value: 0 } },
      vertexShader: /* glsl */`
        uniform float uT; uniform float uSq; uniform float uBurst; uniform vec3 uC; uniform float uScale; uniform float uVel;
        attribute vec4 seed; varying float vA;
        void main() {
          // a vortex tube along x made of helical strands; the core tightens and
          // spins up as the flow concentrates toward the blow-up time
          float x = (seed.x - 0.5) * 34.0 * (1.0 - 0.35 * uSq);
          float strand = floor(seed.y * 28.0);
          float r0 = 0.5 + 4.0 * pow(fract(strand * 0.618), 0.8) + 0.25 * (seed.w - 0.5);
          float r = r0 * (1.0 - 0.8 * uSq) * (1.0 + 0.25 * sin(x * 0.35 + uT * 1.3));
          float w = (1.2 + 10.0 * uSq * uSq) / (0.35 + r0 * 0.3);
          float th = strand * 2.39996 + x * (0.18 + 0.25 * uSq) + uT * w + 0.08 * (seed.z - 0.5);
          vec3 p = vec3(x, cos(th) * r, sin(th) * r);
          // burst: everything flies outward along its radius
          vec3 dir = normalize(vec3(x * 0.15, cos(th), sin(th)) + 0.4 * (seed.wzy - 0.5));
          p += dir * uBurst * (20.0 + 45.0 * seed.w);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(uC + p, 1.0);
          gl_PointSize = (1.6 + 1.4 * seed.w) * uScale;
          vA = (0.35 + 0.65 * seed.w) * pow(1.0 - uBurst, 3.0) * (1.0 + 0.8 * uSq * (1.0 - r0 / 4.5));
        }`,
      fragmentShader: /* glsl */`
        uniform float uGain; varying float vA;
        void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 3.0) * vA; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * uGain, 1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.root.add(this.points);
  }

  update(b, ctx) {
    b = wrap(b);
    this.root.visible = this.shown(ctx, this.center, 400) && (b >= 29.4 && b < 33.0);
    if (!this.root.visible) return;
    const u = this.mat.uniforms;
    u.uT.value = (b - 29.5) * BAR;
    u.uSq.value = smoothstep(30.1, T_BLOW, b) ** 1.6;
    u.uBurst.value = b < T_BLOW ? 0 : 1 - Math.exp(-(b - T_BLOW) * 5);
    u.uScale.value = ctx.res.x / 1080;
    u.uGain.value = 0.8 * (1 - 0.75 * u.uSq.value) ** 1.5 * smoothstep(29.45, 29.75, b) * (1 + 0.8 * (b >= T_BLOW ? Math.exp(-(b - T_BLOW) * 14) : 0)) * (1 - smoothstep(32.0, 32.4, b));
  }

  labels(b) {
    b = wrap(b);
    const C = this.center;
    const eqA = smoothstep(29.6, 29.7, b) * (1 - smoothstep(31.3, 31.5, b));
    const chars = Math.floor(clamp((b - 29.6) * BAR * 32, 0, 99));
    const lean = smoothstep(31.55, 31.65, b) * (1 - smoothstep(31.88, 31.95, b));
    return [
      { p: C.clone().add(new THREE.Vector3(0, -9, 0)), text: '∂u/∂t + (u·∇)u = −∇p + νΔu + f', style: 'math', size: 38, align: 'center', alpha: eqA, chars },
      { p: C.clone().add(new THREE.Vector3(0, -9, 0)), text: '∇·u = 0', style: 'math', size: 30, align: 'center', dy: 44, alpha: eqA * smoothstep(30.1, 30.2, b) },
      { p: C.clone().add(new THREE.Vector3(-9, 6, 0)), text: 'proof complete ■', style: 'label', size: 30, alpha: lean, color: 'rgba(245,246,250,1)' },
      { p: C.clone().add(new THREE.Vector3(-9, 6, 0)), text: 'Lean · no goals', style: 'mono', size: 20, dy: 30, alpha: lean * 0.85 },
      { screen: [0.5, 0.9], text: '10,000 agents · 88 hours', style: 'label', size: 20, align: 'center', alpha: smoothstep(30.3, 30.5, b) * (1 - smoothstep(31.3, 31.5, b)) * 0.8, color: 'rgba(200,202,214,1)' },
    ];
  }
}
