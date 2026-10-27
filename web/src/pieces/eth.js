// The climax. Brute force (2^n) has been the wall since the chess tree;
// the exponential search tree grows one more time, two comets — two rival
// labs — cross the finish line in a dead heat, and the exponential collapses.
import * as THREE from 'three';
import { Piece } from './common.js';
import { makeSegments, makePoints } from '../gfx/glow.js';
import { boardMaterial } from './chess.js';
import { frameAt, headAt, spineAt } from '../curve.js';
import { rng, clamp, ease, smoothstep, hexToRgb } from '../util.js';
import { TEAM } from '../config.js';

export class ETH extends Piece {
  constructor(A) {
    super(24.85, 30.4, 0.1, 0.6);
    const f = frameAt(25.4);
    const r = rng(1999);
    // ---- exponential tree: depth 10, doubling every level, growing on 16ths
    const root = spineAt(26.0).clone().addScaledVector(f.T, -2);
    this.root0 = root.clone();
    this.axisT = f.T.clone();
    const segs = [];
    const depth = 10;
    const grow = (p, level, dirA, dirB) => {
      if (level >= depth) return;
      for (const s of [-1, 1]) {
        const spread = 9.5 * Math.pow(0.78, level);
        const ang = dirA + s * (0.9 * Math.pow(0.82, level)) + (r() - 0.5) * 0.25;
        const q = p.clone()
          .addScaledVector(f.T, -2.6 - level * 0.35)
          .addScaledVector(f.N, Math.cos(ang) * spread * 0.32)
          .addScaledVector(f.Z, Math.sin(ang) * spread * 0.32);
        const born = 25.0 + level * 0.0625;
        segs.push({ a: p, b: q, color: [1.2, 0.5 + 0.05 * level, 0.6 + 0.08 * level].map((c) => c * (1.1 - level * 0.04)), width: 0.12 * Math.pow(0.86, level), born, grow: 0.06, alpha: 0.95 });
        grow(q, level + 1, ang, dirB);
      }
    };
    grow(root, 0, 0, 0);
    this.tree = makeSegments(segs, { minPx: 1.1, core: 0.8 });
    this.root.add(this.tree);
    this.t0 = this.tree.geometry.attributes.p0.array.slice();
    this.t1 = this.tree.geometry.attributes.p1.array.slice();

    // ---- finish line: a checkered disc of bits around the spine at b = 26
    const fl = frameAt(26);
    const disc = new THREE.Mesh(new THREE.RingGeometry(3.2, 8.5, 128, 1), this.finishMaterial());
    const m = new THREE.Matrix4().makeBasis(fl.N, fl.Z, fl.T);
    disc.matrixAutoUpdate = false;
    disc.matrix.copy(m).setPosition(spineAt(26));
    disc.frustumCulled = false;
    this.disc = disc;
    this.root.add(disc);

    // ---- two comets
    this.cometColors = [hexToRgb(TEAM.OAI.color).map((c) => c * 1.4), hexToRgb(TEAM.ANT.color).map((c) => c * 1.8)];
    this.comets = this.cometColors.map((col) => {
      const head = makePoints([{ p: new THREE.Vector3(), color: col, size: 1.0 }], { minPx: 6, maxPx: 90 });
      const trail = makeSegments(Array.from({ length: 40 }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), color: col, width: 0.2 })), { minPx: 2, core: 1.4 });
      this.root.add(head); this.root.add(trail);
      return { head, trail };
    });

    // ---- the collapse: a single thin bright line (subexponential)
    this.line = makeSegments([{ a: root.clone().addScaledVector(f.T, -30), b: root.clone().addScaledVector(f.T, 2), color: [1.5, 1.5, 1.6], width: 0.12 }], { minPx: 2, core: 1.5 });
    this.root.add(this.line);

    // ---- shock ring at the finish
    const ring = [];
    for (let i = 0; i < 128; i++) {
      const a0 = (i / 128) * Math.PI * 2, a1 = ((i + 1) / 128) * Math.PI * 2;
      ring.push({ a: new THREE.Vector3(Math.cos(a0), Math.sin(a0), 0), b: new THREE.Vector3(Math.cos(a1), Math.sin(a1), 0), color: [1.6, 1.5, 1.4], width: 0.03 });
    }
    this.ring = makeSegments(ring, { minPx: 1.5, core: 1.2 });
    this.ring.matrixAutoUpdate = false;
    this.ringBase = new THREE.Matrix4().makeBasis(fl.N, fl.Z, fl.T).setPosition(spineAt(26));
    this.root.add(this.ring);
    this.finish = spineAt(26).clone();
  }

  finishMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uGain: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform float uGain; uniform float uTime; uniform float uFlash;
        varying vec2 vP;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          // checkered band in polar cells: a finish-line gantry ring
          float rr = length(vP);
          float an = atan(vP.y, vP.x);
          vec2 g = vec2(an / 6.28318 * 48.0, (rr - 3.2) / 5.3 * 4.0);
          vec2 c = floor(g);
          float chk = mod(c.x + c.y, 2.0);
          vec2 f = abs(fract(g) - 0.5);
          float cell = smoothstep(0.5, 0.42, max(f.x, f.y));
          float bit = step(0.5, h(c + floor(uTime * 8.0)));
          float edge = exp(-abs(rr - 8.45) * 18.0) * 2.0 + exp(-abs(rr - 3.25) * 18.0) * 2.0;
          float v = (chk * 0.5 + 0.04 + bit * 0.15 * (1.0 - chk)) * cell + edge;
          gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * v * uGain * (1.0 + uFlash * 3.0), 1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }

  // comet positions (wb = warped bar for world motion)
  cometPos(wb, i) {
    const f = frameAt(wb);
    const sep = smoothstep(25.05, 25.45, wb) * (1 - smoothstep(26.6, 27.6, wb)) * 1.9;
    const wob = Math.sin(wb * 9 + i * 2) * 0.12;
    return headAt(wb).addScaledVector(f.Z, (i ? 1 : -1) * (sep + wob)).addScaledVector(f.N, (i ? -0.25 : 0.25) * sep);
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    const wb = ctx.wb;
    // tree: grows 25.0 → 25.6, collapses 26.25 → 27.2 toward the axis
    const c = ease.inOutCubic(clamp((b - 26.25) / 0.95));
    const at = this.tree.geometry.attributes;
    const v = new THREE.Vector3(), d = new THREE.Vector3();
    const collapse = (src, attr) => {
      for (let i = 0; i < attr.count; i++) {
        v.fromArray(src, i * 3);
        d.copy(v).sub(this.root0);
        const along = d.dot(this.axisT);
        const axisPt = this.root0.clone().addScaledVector(this.axisT, along);
        v.lerp(axisPt, c);
        attr.setXYZ(i, v.x, v.y, v.z);
      }
      attr.needsUpdate = true;
    };
    collapse(this.t0, at.p0); collapse(this.t1, at.p1);
    this.tree.material.uniforms.uGain.value = g * (1 - smoothstep(27.0, 27.6, b)) * (1 + 0.4 * ctx.beat);
    this.line.material.uniforms.uGain.value = g * smoothstep(26.9, 27.3, b) * (1 - smoothstep(29.4, 30.2, b));

    const flash = b >= 26 ? Math.exp(-(b - 26) * 3) : 0;
    this.disc.material.uniforms.uGain.value = g * smoothstep(25.0, 25.4, b) * (1 - smoothstep(28.5, 29.8, b)) * 0.4;
    this.disc.material.uniforms.uFlash.value = flash;
    // comets
    const cg = smoothstep(25.0, 25.1, b) * (1 - smoothstep(27.4, 27.9, wb > 26.7 ? b : 0));
    this.comets.forEach((C, i) => {
      const p = this.cometPos(wb, i);
      const hp = C.head.geometry.attributes.position;
      hp.setXYZ(0, p.x, p.y, p.z); hp.needsUpdate = true;
      C.head.material.uniforms.uGain.value = g * cg * 2.2;
      const ta = C.trail.geometry.attributes;
      for (let k = 0; k < 40; k++) {
        const qa = this.cometPos(wb - (k + 1) * 0.012, i), qb = this.cometPos(wb - k * 0.012, i);
        ta.p0.setXYZ(k, qa.x, qa.y, qa.z); ta.p1.setXYZ(k, qb.x, qb.y, qb.z);
        ta.wa.setXY(k, 0.22 * (1 - k / 40), 1 - k / 40);
      }
      ta.p0.needsUpdate = true; ta.p1.needsUpdate = true; ta.wa.needsUpdate = true;
      C.trail.material.uniforms.uGain.value = g * cg;
    });
    this.cometWorld = [this.cometPos(wb, 0), this.cometPos(wb, 1)];
    // ring
    const rt = b - 26;
    this.ring.visible = rt > 0 && rt < 2;
    if (this.ring.visible) {
      const s = 1 + rt * 24;
      this.ring.matrix.copy(this.ringBase).multiply(new THREE.Matrix4().makeScale(s, s, s));
      this.ring.material.uniforms.uGain.value = g * Math.exp(-rt * 2.2) * 2.5;
    }
  }
}
