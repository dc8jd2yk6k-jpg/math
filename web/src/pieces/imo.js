// 2024 → 2025 · the Olympiad inflection.
// 2024: six problem panels along the climb; P1 P2 P4 P6 light silver (28/42),
// walls of Lean and a 72-hour compute dial make the constraints visible.
// 2025 (gold drop): the Lean walls shatter, five panels re-light gold.
import * as THREE from 'three';
import { Piece } from './common.js';
import { makeSegments, makePoints, textPlane, textTexture } from '../gfx/glow.js';
import { frameAt, spineAt, headAt } from '../curve.js';
import { IMO24, IMO25, LEAN_SNIPPET } from '../data.js';
import { rng, clamp, ease, smoothstep, hexToRgb } from '../util.js';
import { PALETTE } from '../config.js';

function hexSegs(r, color, width = 0.1) {
  const s = [];
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI / 6 + (i * Math.PI) / 3, a1 = Math.PI / 6 + ((i + 1) * Math.PI) / 3;
    s.push({ a: new THREE.Vector3(Math.cos(a0) * r, Math.sin(a0) * r, 0), b: new THREE.Vector3(Math.cos(a1) * r, Math.sin(a1) * r, 0), color, width });
  }
  return s;
}

function hexFill(r) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(shape);
}

const fillMat = () => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color() }, uGain: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 uColor; uniform float uGain; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(uColor * uGain * (0.08 + 0.3 * smoothstep(1.2, 2.5, r)), 1.0); }',
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

export class IMO extends Piece {
  constructor(A) {
    super(9.6, 16.4, 0.3, 0.6);
    const silver = hexToRgb(PALETTE.silver), gold = hexToRgb(PALETTE.gold), red = hexToRgb(PALETTE.red);
    this.panels = [];
    for (let k = 0; k < 6; k++) {
      const bk = 10.35 + k * 0.62;
      const f = frameAt(bk);
      const side = k % 2 === 0 ? 1 : -1;
      const g = new THREE.Group();
      const pos = f.S.clone().addScaledVector(f.Z, side * 6.2).addScaledVector(f.N, (k % 3 - 1) * 1.2);
      // face the spine: panel normal = -side*Z, up = T
      const m = new THREE.Matrix4().makeBasis(f.N.clone().multiplyScalar(-side), f.T, f.Z.clone().multiplyScalar(-side));
      g.matrixAutoUpdate = false;
      g.matrix.copy(m).setPosition(pos);
      const outline = makeSegments(hexSegs(2.4, [1, 1, 1], 0.09), { minPx: 1.6, core: 1 });
      const inner = makeSegments(hexSegs(2.05, [1, 1, 1], 0.04), { minPx: 1, core: 0.5 });
      const fill = new THREE.Mesh(hexFill(2.4), fillMat());
      fill.frustumCulled = false;
      const label = textPlane(`P${k + 1}`, 1.25, [1, 1, 1], { font: 'title', px: 110 });
      label.position.set(0, 0.55, 0.01);
      const score = textPlane('7', 0.9, [1, 1, 1], { font: 'monob', px: 110 });
      score.position.set(0, -0.75, 0.01);
      const x = makeSegments([
        { a: new THREE.Vector3(-1.2, -1.2, 0), b: new THREE.Vector3(1.2, 1.2, 0), color: red.map((c) => c * 1.6), width: 0.16 },
        { a: new THREE.Vector3(-1.2, 1.2, 0), b: new THREE.Vector3(1.2, -1.2, 0), color: red.map((c) => c * 1.6), width: 0.16 },
      ], { minPx: 2, core: 1 });
      [outline, inner, fill, label, score, x].forEach((o) => g.add(o));
      this.root.add(g);
      this.panels.push({ g, outline, inner, fill, label, score, x, bk, k, world: pos });
    }

    // Lean walls (the constraint): code planes left and right of the climb
    const tex = textTexture(LEAN_SNIPPET, { font: 'mono', px: 44, lineHeight: 1.45, pad: 30, color: '#fff' });
    tex.tex.wrapT = THREE.RepeatWrapping;
    this.walls = [];
    for (const side of [1, -1]) {
      const f = frameAt(11.8);
      const hgt = 30, wid = hgt * tex.aspect * 0.55;
      const geo = new THREE.PlaneGeometry(wid, hgt);
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex.tex }, uGain: { value: 0 }, uScroll: { value: 0 }, uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: new THREE.Color(0.55, 1.0, 0.75) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: /* glsl */`
          uniform sampler2D map; uniform float uGain; uniform float uScroll; uniform vec3 uColor; varying vec2 vUv;
          void main() {
            vec2 uv = vec2(vUv.x, fract(vUv.y * 1.6 + uScroll));
            float a = texture2D(map, uv).a;
            float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
            gl_FragColor = vec4(uColor * a * uGain * edge, 1.0);
          }`,
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const w = new THREE.Mesh(geo, mat);
      w.frustumCulled = false;
      const pos = f.S.clone().addScaledVector(f.Z, side * 15).addScaledVector(f.N, -2);
      const m = new THREE.Matrix4().makeBasis(f.N.clone().multiplyScalar(-side), f.T, f.Z.clone().multiplyScalar(-side));
      w.matrixAutoUpdate = false;
      w.matrix.copy(m).setPosition(pos);
      this.root.add(w);
      this.walls.push(w);
    }
    // shatter particles sampled on the walls
    const r = rng(77);
    const shards = [];
    for (const w of this.walls) {
      const hp = w.geometry.parameters;
      for (let i = 0; i < 1400; i++) {
        const lp = new THREE.Vector3((r() - 0.5) * hp.width, (r() - 0.5) * hp.height, 0).applyMatrix4(w.matrix);
        const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        shards.push({ p: lp, color: [0.5, 1.0, 0.7], size: 0.12 + r() * 0.12, born: 14.0, die: 15.4, fadeIn: 0.01, fadeOut: 1.0, motion: [dir.x, dir.y, dir.z, 6 + r() * 14] });
      }
    }
    this.shards = makePoints(shards, {
      minPx: 1.5, maxPx: 8,
      displace: { body: 'float tt = max(uTime - 14.0, 0.0); P += motion.xyz * motion.w * (1.0 - exp(-tt * 2.5));' },
    });
    this.root.add(this.shards);

    // 72-hour compute dial
    const fd = frameAt(11.0);
    this.dial = new THREE.Group();
    const dpos = fd.S.clone().addScaledVector(fd.Z, -10).addScaledVector(fd.N, 6.5);
    const dm = new THREE.Matrix4().makeBasis(fd.N.clone().negate(), fd.T, fd.Z.clone().negate());
    this.dial.matrixAutoUpdate = false; this.dial.matrix.copy(dm).setPosition(dpos);
    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = Math.PI / 2 - (i / 72) * Math.PI * 2;
      const r0 = i % 6 === 0 ? 3.6 : 3.9;
      ticks.push({ a: new THREE.Vector3(Math.cos(a) * r0, Math.sin(a) * r0, 0), b: new THREE.Vector3(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0), color: [1, 0.45, 0.4], width: 0.07, born: 10.3 + (i / 72) * 3.4, grow: 0.02 });
    }
    this.ticks = makeSegments(ticks, { minPx: 1.4, core: 1 });
    this.hand = makeSegments([{ a: new THREE.Vector3(0, 0, 0), b: new THREE.Vector3(0, 3.3, 0), color: [1.5, 0.7, 0.6], width: 0.14 }], { minPx: 2, core: 1 });
    this.dialLabel = textPlane('72 H', 1.2, [1, 0.55, 0.5], { font: 'monob', px: 100 });
    this.dialLabel.position.set(0, -1.6, 0);
    this.dial.add(this.ticks); this.dial.add(this.hand); this.dial.add(this.dialLabel);
    this.root.add(this.dial);
    this.dialWorld = dpos;

    // gold burst at the drop
    const burst = [];
    const o = headAt(14);
    for (let i = 0; i < 2600; i++) {
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const sp = 4 + Math.pow(r(), 0.6) * 26;
      burst.push({ p: o, color: [1.6, 1.0, 0.35].map((c) => c * (0.6 + r() * 0.8)), size: 0.1 + r() * 0.18, born: 14.0, die: 15.8, fadeIn: 0.01, fadeOut: 1.2, motion: [dir.x, dir.y, dir.z, sp] });
    }
    this.burst = makePoints(burst, {
      minPx: 1.5, maxPx: 10,
      displace: { body: 'float tt = max(uTime - 14.0, 0.0); P += motion.xyz * motion.w * (1.0 - exp(-tt * 3.0));' },
    });
    this.root.add(this.burst);
    this.silver = silver; this.gold = gold; this.red = red;
  }

  update(b, ctx) {
    if (!super.update(b, ctx)) return;
    const g = this.g;
    const isGold = b >= 14;
    for (const P of this.panels) {
      const appear = ease.outBack(clamp((b - (10.05 + P.k * 0.1)) / 0.15));
      const sc = Math.max(0.001, appear);
      [P.outline, P.inner, P.fill, P.label, P.score, P.x].forEach((o) => o.scale.setScalar(sc));
      const solved24 = IMO24[P.k] > 0, solved25 = IMO25[P.k] > 0;
      const tHit24 = 10.5 + [0, 0.25, 0, 0.5, 0, 0.75][P.k];
      const lit24 = solved24 && b >= tHit24;
      const tHit25 = 14.0 + P.k * 0.0625;
      const lit25 = solved25 && b >= tHit25;
      let col = [0.35, 0.4, 0.5];
      let fillG = 0;
      if (isGold) {
        col = lit25 ? this.gold.map((c) => c * 1.6) : [0.35, 0.3, 0.3];
        fillG = lit25 ? 0.9 + 1.5 * Math.exp(-(b - tHit25) * 4) : 0;
      } else if (lit24) {
        col = this.silver.map((c) => c * 1.4);
        fillG = 0.6 + 1.2 * Math.exp(-(b - tHit24) * 5);
      } else if (!solved24 && b > 11.4) col = this.red.map((c) => c * 0.9);
      P.outline.material.uniforms.uGain.value = g * appear;
      P.outline.material.uniforms.uTime.value = b;
      P.inner.material.uniforms.uGain.value = g * appear * 0.6;
      for (const o of [P.outline, P.inner]) {
        const cAttr = o.geometry.attributes.color;
        for (let i = 0; i < cAttr.count; i++) cAttr.setXYZ(i, col[0], col[1], col[2]);
        cAttr.needsUpdate = true;
      }
      P.fill.material.uniforms.uColor.value.setRGB(...(isGold ? this.gold : this.silver));
      P.fill.material.uniforms.uGain.value = g * fillG;
      P.label.material.uniforms.uGain.value = g * appear * 1.2;
      const showScore = isGold ? b >= tHit25 : b >= Math.min(tHit24, 11.4);
      P.score.visible = showScore && (isGold ? solved25 : solved24);
      P.score.material.uniforms.uGain.value = g * 1.4;
      P.score.material.uniforms.uColor.value.setRGB(...(isGold ? this.gold.map((c) => c * 1.3) : [1.2, 1.25, 1.35]));
      const showX = isGold ? !solved25 && b >= tHit25 : !solved24 && b > 11.4;
      P.x.visible = showX;
      P.x.material.uniforms.uGain.value = g * (0.8 + 0.2 * ctx.beat);
    }
    const wallG = g * smoothstep(10.0, 10.6, b) * (1 - smoothstep(13.97, 14.05, b));
    for (const w of this.walls) {
      w.material.uniforms.uGain.value = wallG * 0.55;
      w.material.uniforms.uScroll.value = b * 0.06;
    }
    this.shards.material.uniforms.uGain.value = g;
    const dg = g * smoothstep(10.2, 10.6, b) * (1 - smoothstep(13.9, 14.1, b));
    this.dial.visible = dg > 0.001;
    this.ticks.material.uniforms.uGain.value = dg;
    this.hand.material.uniforms.uGain.value = dg;
    this.hand.rotation.z = -((b - 10.3) / 3.4) * Math.PI * 2;
    this.dialLabel.material.uniforms.uGain.value = dg;
    this.burst.material.uniforms.uGain.value = g * 1.2;
  }
}
