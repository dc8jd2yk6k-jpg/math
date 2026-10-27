// Timing gates: gantries across the trajectory, like F1 timing loops. Their
// labels change granularity as time compresses: decades → years → months →
// weeks → days. Flying through them makes the acceleration visible.
import * as THREE from 'three';
import { makeSegments, textPlane } from './gfx/glow.js';
import { calendarAt, frameAt, radiusAtBar } from './curve.js';
import { decimalYear } from './data.js';
import { clamp, envelope, hexToRgb } from './util.js';
import { PALETTE } from './config.js';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function barOfYear(yr) {
  let lo = 0, hi = 26;
  if (yr <= calendarAt(lo) || yr >= calendarAt(hi)) return null;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (calendarAt(m) < yr) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

function schedule() {
  const g = [];
  const add = (yr, label, kind) => { const b = barOfYear(yr); if (b !== null) g.push({ b, yr, label, kind }); };
  for (const y of [1960, 1970, 1980, 1990]) add(y, String(y), 'decade');
  for (const y of [2000, 2005, 2010, 2015]) add(y, String(y), 'lustrum');
  for (let y = 2017; y <= 2024; y++) add(y, String(y), 'year');
  for (let y = 2024; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const yr = decimalYear(y, m, 1);
    if (yr < 2024.6 || yr > decimalYear(2026, 5, 15)) continue;
    add(yr, m === 1 ? `JAN ${y}` : `${MON[m - 1]} ${y}`, 'month');
  }
  for (let d = Date.UTC(2026, 4, 25); d <= Date.UTC(2026, 8, 7); d += 7 * 86400000) {
    const dt = new Date(d);
    add(decimalYear(2026, dt.getUTCMonth() + 1, dt.getUTCDate()), `${MON[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, '0')}`, 'week');
  }
  for (let d = Date.UTC(2026, 8, 10); d <= Date.UTC(2026, 9, 26); d += 86400000) {
    const dt = new Date(d);
    add(decimalYear(2026, dt.getUTCMonth() + 1, dt.getUTCDate()), `${MON[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, '0')}`, 'day');
  }
  return g;
}

const COLORS = {
  decade: hexToRgb(PALETTE.ice), lustrum: hexToRgb(PALETTE.ice), year: hexToRgb(PALETTE.jade),
  month: hexToRgb(PALETTE.gold), week: hexToRgb(PALETTE.purple), day: hexToRgb('#ff5fa8'),
};

export class Gates {
  constructor() {
    this.root = new THREE.Group();
    this.list = schedule();
    const segs = [];
    this.labels = [];
    for (const G of this.list) {
      const f = frameAt(G.b);
      const s = Math.max(3.6, 2 * radiusAtBar(G.b) + 4.5);
      G.size = s;
      const c = COLORS[G.kind].map((v) => v * 0.9);
      const corner = (u, v) => f.S.clone().addScaledVector(f.Z, u * s / 2).addScaledVector(f.N, v * s / 2);
      const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const w = s * 0.012;
      const born = G.b - 2.6, die = G.b + 0.7;
      for (let i = 0; i < 4; i++) segs.push({ a: pts[i], b: pts[(i + 1) % 4], color: c, width: w, alpha: 0.85, born, grow: 0.35, die, fade: 0.4 });
      // tick marks on the top bar (a timing-loop look)
      for (let k = -3; k <= 3; k++) {
        const a = f.S.clone().addScaledVector(f.Z, k * s / 8).addScaledVector(f.N, s / 2);
        segs.push({ a, b: a.clone().addScaledVector(f.N, -s * 0.05), color: c, width: w * 0.8, alpha: 0.7, born, grow: 0.35, die, fade: 0.4 });
      }
      const lab = textPlane(G.label, s * 0.085, c.map((v) => v * 1.4), { font: 'monob', px: 90, anchor: 'left' });
      lab.matrixAutoUpdate = false;
      const m = new THREE.Matrix4().makeBasis(f.Z, f.N, f.T.clone().negate());
      m.setPosition(corner(-1, 1).addScaledVector(f.N, s * 0.07));
      lab.matrix.copy(m);
      lab.userData = G;
      this.labels.push(lab);
      this.root.add(lab);
    }
    this.frames = makeSegments(segs, { minPx: 1.2, core: 0.9 });
    this.root.add(this.frames);
  }

  update(b, wb, gain, pixelScale) {
    this.frames.material.uniforms.uTime.value = wb;
    this.frames.material.uniforms.uPixel.value = pixelScale;
    this.frames.material.uniforms.uGain.value = gain;
    for (const lab of this.labels) {
      const G = lab.userData;
      const e = envelope(wb, G.b - 2.6, G.b + 0.7, 0.4, 0.4);
      lab.visible = e > 0.001 && gain > 0.001;
      if (!lab.visible) continue;
      const flash = wb >= G.b ? Math.exp(-(wb - G.b) * 10) : 0;
      lab.material.uniforms.uGain.value = gain * e * (0.9 + 2.0 * flash);
    }
  }
}

// Speed streaks around the camera, aligned with the direction of travel.
export function makeStreaks(n = 420, seed = 3) {
  let a = seed;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const base = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) base.set([r(), r(), r(), 0.4 + r() * 0.9], i * 4);
  geo.setAttribute('base', new THREE.InstancedBufferAttribute(base, 4));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) }, uLen: { value: 2 }, uBox: { value: 46 },
      uGain: { value: 0 }, uPixel: { value: 1000 }, uColor: { value: new THREE.Color(0.7, 0.8, 1.0) }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      attribute vec2 corner; attribute vec4 base;
      uniform vec3 uCam; uniform vec3 uDir; uniform float uLen; uniform float uBox; uniform float uPixel;
      varying float vSide; varying float vAlong; varying float vA;
      void main() {
        vec3 q = base.xyz * uBox;
        vec3 P0 = uCam + mod(q - uCam + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 P1 = P0 - uDir * uLen * base.w;
        vec4 a = modelViewMatrix * vec4(P0, 1.0), b = modelViewMatrix * vec4(P1, 1.0);
        vec4 vp = mix(a, b, corner.x);
        vec3 dir = b.xyz - a.xyz;
        if (length(dir) < 1e-5) dir = vec3(1.0, 0.0, 0.0);
        vec3 sd = normalize(cross(normalize(dir), normalize(-vp.xyz)));
        float w = max(0.02, 1.2 / (uPixel / max(-vp.z, 0.01)));
        vp.xyz += sd * corner.y * w;
        float d = length(P0 - uCam) / (uBox * 0.5);
        vA = smoothstep(1.0, 0.6, d) * smoothstep(0.08, 0.25, d);
        vSide = corner.y; vAlong = corner.x;
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uGain; uniform vec3 uColor;
      varying float vSide; varying float vAlong; varying float vA;
      void main() {
        float g = exp(-vSide * vSide * 3.0) * (1.0 - vAlong);
        gl_FragColor = vec4(uColor * g * vA * uGain, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
