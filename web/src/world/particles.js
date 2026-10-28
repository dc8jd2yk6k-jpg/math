// Space particles, in two systems.
//
//   Dust: three world-anchored layers (near, mid, far) tiled around the camera,
//   so a moving camera gets true parallax at three depths. Size and brightness
//   follow perspective depth; a mote right in front of the lens spreads into a
//   faint bokeh disc. Shock fronts (the Navier-Stokes blow-up, the ETH arrival)
//   ripple outward through it.
//
//   Swarm: ~4k particles shed by the head. While the head flies they trail it
//   as a wake (born at the head, kicked along by its motion, swirling out and
//   fading). When it parks on a milestone they fly in on curved, staggered paths
//   and assemble that milestone's figure, then stream after the head when it
//   leaves. Percolation rain, the Navier-Stokes vortex and blow-up, and the ETH
//   convergence are time-dependent modes of their own.
//
// Every position is a pure function of the bar, periodic over the loop. Each
// particle is drawn as a streak from where it is at the start of the current
// motion-blur sub-interval to where it is at the end, each end projected with
// the camera of its own instant: the trail is the true relative motion of that
// particle, whatever the camera or the particle is doing, and its brightness is
// spread along the trail so energy is conserved.
import * as THREE from 'three';
import { mulberry32, N_BARS, wrap, smoothstep, clamp } from '../time.js';
import { posAtS } from '../curve.js';
import { L } from '../layout.js';
import { construct, imo25World } from '../pieces/imo25.js';
import { islandGeom, NX, NY, NZ } from '../pieces/percolation.js';

const HEAD_RATE = 128;                      // head samples per bar
const HEAD_N = N_BARS * HEAD_RATE;
const HEAD_W = 1024;
const SWARM_SIDE = 64, SWARM_N = SWARM_SIDE * SWARM_SIDE;

// ---- shared GLSL: the streak quad and its soft capsule profile
const STREAK = /* glsl */`
  uniform mat4 uVP0; uniform mat4 uVP1; uniform vec2 uRes; uniform float uProj;
  attribute vec2 corner;
  varying vec2 vQ; varying float vLen; varying vec3 vCol;
  // place this corner of the quad spanning the particle's two projected ends
  vec4 streak(vec4 c0, vec4 c1, float rPx, out float lenPx) {
    if (c0.w <= 0.05 || c1.w <= 0.05) { lenPx = -1.0; vQ = vec2(0.0); vLen = 0.0; return vec4(0.0, 0.0, -2.0, 1.0); }
    vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 v = s1 - s0;
    float Lp = length(v);
    vec2 dir = Lp > 1e-4 ? v / Lp : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 c = corner.x < 0.5 ? c0 : c1;
    c.xy += (nrm * corner.y * rPx + dir * (corner.x * 2.0 - 1.0) * rPx) / (uRes * 0.5) * c.w;
    lenPx = Lp;
    vLen = Lp / rPx;
    vQ = vec2(mix(-1.0, vLen + 1.0, corner.x), corner.y);
    return c;
  }
  // brightness along a trail: dimmer as it stretches, but not by the full
  // length ratio, so fast streaks stay visible (warp lines, not vanishing dust)
  float energy(float lenPx, float rPx) {
    if (lenPx < 0.0) return 0.0;
    return pow(1.0 + lenPx / rPx, -0.35) * (1.0 - smoothstep(0.7 * uRes.y, 1.2 * uRes.y, lenPx));
  }
  // sizes are measured in pixels of a 1920-line frame, so previews match the final
  float refPx(float worldR, float depth) { return worldR * uProj / max(depth, 0.01) * 960.0; }`;

const FRAG = /* glsl */`
  varying vec2 vQ; varying float vLen; varying vec3 vCol;
  void main() {
    float ax = max(0.0, max(-vQ.x, vQ.x - vLen));
    float a = exp(-(ax * ax + vQ.y * vQ.y) * 3.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vCol * a, 1.0);
  }`;

// quads: 4 corners per particle, per-particle attributes repeated per corner
function quads(n, attrs) {
  const g = new THREE.BufferGeometry();
  const corner = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) corner.set([k >> 1, (k & 1) ? 1 : -1], (i * 4 + k) * 2);
    const a = i * 4;
    idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
  g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  for (const [name, size, fill] of attrs) {
    const arr = new Float32Array(n * 4 * size);
    for (let i = 0; i < n; i++) { const v = fill(i); for (let k = 0; k < 4; k++) arr.set(v, (i * 4 + k) * size); }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// ---- dust layers
const LAYERS = [
  { name: 'near', n: 4000, tile: 60, r: [0.004, 0.012], gain: 0.9, tint: [0.86, 0.89, 0.96], seed: 101 },
  { name: 'mid', n: 3000, tile: 260, r: [0.03, 0.08], gain: 0.75, tint: [0.8, 0.86, 1.0], seed: 202 },
  { name: 'far', n: 2500, tile: 1400, r: [0.25, 0.6], gain: 0.55, tint: [0.78, 0.82, 0.95], seed: 303 },
];

const DUST_VS = STREAK + /* glsl */`
  uniform vec3 uCam; uniform float uTile; uniform vec2 uR; uniform float uGain; uniform vec3 uTint;
  uniform vec4 uShock0; uniform vec4 uShock1; uniform vec3 uShockC; uniform vec2 uShockAW;
  attribute vec4 seed;
  // a spherical shock front of radius f pushes the dust outward as it passes
  vec3 push(vec3 p, float f) {
    if (f <= 0.0) return p;
    vec3 d = p - uShockC; float r = length(d);
    float amp = uShockAW.x * smoothstep(0.0, 12.0, f) * (1.0 - smoothstep(150.0, 320.0, f));
    return p + d / max(r, 1e-3) * amp * exp(-pow((r - f) / uShockAW.y, 2.0));
  }
  void main() {
    vec3 rel = mod(seed.xyz * uTile - uCam + 0.5 * uTile, uTile) - 0.5 * uTile;
    vec3 wp = uCam + rel;
    vec4 c0 = uVP0 * vec4(push(wp, uShock0.w), 1.0), c1 = uVP1 * vec4(push(wp, uShock1.w), 1.0);
    float depth = max(0.5 * (c0.w + c1.w), 0.01);
    float rRef = refPx(mix(uR.x, uR.y, seed.w * seed.w), depth);
    float sub = clamp(rRef / 1.4, 0.0, 1.0);                  // below 1.4 px: fade, don't shrink
    float bokeh = min(1.0, pow(8.0 / max(rRef, 1e-3), 1.5));  // a big close mote is a faint disc
    float rPx = max(rRef, 1.4) * uRes.y / 1920.0;
    float lenPx;
    gl_Position = streak(c0, c1, rPx, lenPx);
    float dist = length(rel);
    float fade = (1.0 - smoothstep(0.32 * uTile, 0.5 * uTile, dist)) * smoothstep(0.3, 1.5, dist);
    float I = uGain * (0.25 + 0.75 * fract(seed.w * 7.31 + seed.x)) * sub * sub * fade * bokeh;
    vCol = uTint * I * energy(lenPx, rPx);
  }`;

// ---- the swarm
const SWARM_VS = STREAK + /* glsl */`
  uniform sampler2D tHead; uniform sampler2D tForm;
  uniform float uB; uniform float uDT; uniform float uGain;
  // two formation slots (the one dissolving, the one forming): row, mode, in, out
  uniform vec4 uFA; uniform vec4 uFB; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uPA; uniform vec3 uPB;
  uniform vec3 uNS; uniform vec3 uTop; uniform float uWakeIn;
  attribute vec4 seed; attribute vec4 life; attribute vec3 dir; attribute float idx;

  vec3 headAt(float b) {
    float x = mod(b, ${N_BARS.toFixed(1)}) * ${HEAD_RATE.toFixed(1)};
    float i0 = floor(x), f = x - i0, i1 = mod(i0 + 1.0, ${HEAD_N.toFixed(1)});
    vec3 a = texelFetch(tHead, ivec2(int(mod(i0, ${HEAD_W.toFixed(1)})), int(i0 / ${HEAD_W.toFixed(1)})), 0).xyz;
    vec3 c = texelFetch(tHead, ivec2(int(mod(i1, ${HEAD_W.toFixed(1)})), int(i1 / ${HEAD_W.toFixed(1)})), 0).xyz;
    return mix(a, c, f);
  }

  const vec3 WARM = vec3(1.0, 0.42, 0.32), COOL = vec3(0.8, 0.86, 1.0);
  const vec3 OAI = vec3(0.75, 0.85, 1.0), ANT = vec3(1.0, 0.55, 0.3);

  // blend this particle from p toward formation slot F at bar t
  void formation(vec4 F, vec3 fcol, vec3 P, float t, inout vec3 p, inout float a, inout vec3 col, inout float sz) {
    if (F.x < 0.0 || life.z >= P.x) return;          // only part of the swarm joins each figure
    fcol *= P.y;
    vec4 T = texelFetch(tForm, ivec2(int(mod(idx, ${SWARM_SIDE.toFixed(1)})), int(F.x) * ${SWARM_SIDE} + int(idx / ${SWARM_SIDE.toFixed(1)})), 0);
    float st = seed.w, mode = F.y, tin = F.z, tout = F.w;
    vec3 side = normalize(cross(dir, vec3(0.31, 1.0, 0.17)));
    if (mode < 0.5) {
      // a figure: fly in on a curved path, staggered; shimmer; dissolve after the head
      float w = smoothstep(tin + 0.3 * st, tin + 0.3 * st + 0.35, t) * (1.0 - smoothstep(tout - 0.1 + 0.2 * st, tout + 0.15 + 0.2 * st, t));
      vec3 q = T.xyz + dir * 0.06 * sin(6.2831853 * (2.0 * t + seed.x));
      p = mix(p, q, w) + side * sin(3.14159265 * w) * (1.5 + 5.0 * seed.y);
      a = mix(a, 1.0, w);
      col = mix(col, fcol, w);
      sz = mix(sz, P.z, w);
    } else if (mode < 1.5) {
      // rain: one drop per opening site, landing as the site opens (T.w)
      float t0 = T.w - 0.35, f = clamp((t - t0) / 0.35, 0.0, 1.0);
      bool falling = t >= t0 && t < T.w + 0.2;
      float spent = step(T.w + 0.2, t) * (1.0 - smoothstep(tout, tout + 0.6, t));
      if (falling) {
        p = T.xyz + vec3(0.0, 50.0 * (1.0 - f * f), 0.0);
        a = smoothstep(t0, t0 + 0.05, t) * (1.0 - smoothstep(T.w, T.w + 0.2, t)) * 1.4;
        col = fcol;
        sz = P.z;
      } else a *= 1.0 - spent;
    } else if (mode < 2.5) {
      // the vortex: spiral in and spin up toward the blow-up at 31.5, then thrown out
      float q = clamp((t - tin) / (31.5 - tin), 0.0, 1.0);
      float rr = mix(T.y, 1.2 + 0.15 * T.y, pow(q, 1.4));
      float th = T.z + (1.5 + T.w) * (2.0 * q + 6.0 * q * q * q * q);
      vec3 v = uNS + vec3(T.x * (1.0 - 0.3 * q), cos(th) * rr, sin(th) * rr);
      v += normalize(vec3(T.x * 0.1, cos(th), sin(th))) * max(0.0, t - 31.5) * (60.0 + 80.0 * T.w);
      float w = smoothstep(tin + 0.25 * st, tin + 0.25 * st + 0.4, t);
      p = mix(p, v, w) + side * sin(3.14159265 * w) * 4.0;
      a = mix(a, 1.1, w) * (1.0 - smoothstep(31.55, 31.95, t) * w);
      col = mix(col, fcol, w);
      sz = mix(sz, P.z, w);
    } else {
      // ETH: light up each lab's path as its head passes, converge into the top, burst
      float tp = abs(T.w);
      float w = smoothstep(tp - 0.05, tp + 0.25, t);
      vec3 v = T.xyz + dir * 0.3 * sin(6.2831853 * (2.0 * t + seed.x));
      v = mix(v, uTop, smoothstep(35.95 + 0.25 * st, 36.25, t));
      v += dir * max(0.0, t - 36.25) * (90.0 + 120.0 * seed.x);
      p = mix(p, v, w) + side * sin(3.14159265 * w) * 2.5;
      a = mix(a, 1.3 * (1.0 - smoothstep(36.4, 36.9, t)), w);
      col = mix(col, (T.w > 0.0 ? OAI : ANT) * P.y, w);
      sz = mix(sz, P.z, w);
    }
  }

  vec3 state(float t, out float a, out vec3 col, out float sz) {
    // the wake: born at the head, kicked along by its motion, swirling out, fading
    float Lf = life.x;
    float age = mod(t + life.y * Lf, Lf);
    float ts = t - age;
    vec3 h = headAt(ts);
    vec3 hv = (headAt(ts + 0.01) - headAt(ts - 0.01)) * 50.0;          // units per bar
    float r = (0.8 + 3.2 * seed.x) * (1.0 - exp(-age * 2.5));
    float sw = (1.5 + 3.0 * seed.y) * age * (seed.z < 0.5 ? -1.0 : 1.0);
    float cs = cos(sw), sn = sin(sw);
    vec3 d = vec3(dir.x * cs - dir.z * sn, dir.y, dir.x * sn + dir.z * cs);
    vec3 p = h + d * r + hv * 0.03 * (1.0 - exp(-age * 4.0)) + vec3(0.0, 0.5 * age, 0.0);
    a = smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(0.45 * Lf, Lf, age)) * 0.45 * uWakeIn;
    // shedding follows the head's motion: a parked head keeps a sparse halo,
    // a flying one sheds its whole wake
    float shed = mix(0.2, 1.05, smoothstep(30.0, 400.0, length(hv)));
    a *= 1.0 - smoothstep(shed - 0.1, shed, life.w);
    col = mix(WARM * 1.6, COOL, smoothstep(0.0, 0.35, age));
    sz = 1.0;
    formation(uFA, uColA, uPA, t, p, a, col, sz);
    formation(uFB, uColB, uPB, t, p, a, col, sz);
    return p;
  }

  void main() {
    float t0 = uB - uDT, t1 = uB + uDT;
    float a0, a1, sz0, sz1; vec3 col0, col1;
    vec3 p0 = state(t0, a0, col0, sz0), p1 = state(t1, a1, col1, sz1);
    // reborn inside this sub-interval: draw only the new particle
    if (mod(t0 + life.y * life.x, life.x) > mod(t1 + life.y * life.x, life.x)) p0 = p1;
    vec4 c0 = uVP0 * vec4(p0, 1.0), c1 = uVP1 * vec4(p1, 1.0);
    float depth = max(0.5 * (c0.w + c1.w), 0.01);
    float rRef = refPx(mix(0.012, 0.024, seed.x) * 0.5 * (sz0 + sz1), depth);
    float sub = clamp(rRef / 1.4, 0.0, 1.0);
    float rPx = clamp(rRef, 1.4, 3.6) * uRes.y / 1920.0;
    float lenPx;
    gl_Position = streak(c0, c1, rPx, lenPx);
    float nearLens = smoothstep(2.0, 5.0, depth);         // nothing smears across the lens
    vCol = 0.5 * (col0 + col1) * uGain * 0.5 * (a0 + a1) * sub * sub * nearLens * energy(lenPx, rPx) * 1.3;
  }`;

// formations, in story order: [piece id, mode, in, out, colour, share of the swarm,
// gain, particle size (x the wake's: each figure is framed from its own distance)]
// mode 0 a figure, 1 rain, 2 vortex, 3 ETH paths
const FORMS = [
  ['shannon', 0, 2.0, 2.5, [1.0, 0.42, 0.34], 0.5, 0.8, 1],
  ['deepblue', 0, 4.05, 5.75, [0.8, 0.88, 1.0], 0.4, 0.8, 1.4],
  ['alphago', 0, 7.95, 8.875, [1.0, 0.92, 0.72], 0.22, 0.75, 1],
  ['imo24', 0, 10.0, 13.75, [0.9, 0.94, 1.0], 0.3, 0.6, 1.6],
  ['imo25', 0, 14.0, 17.75, [0.85, 0.92, 1.0], 0.6, 1.0, 2.5],
  ['erdos', 0, 18.0, 19.75, [0.95, 0.95, 1.0], 0.6, 1.0, 2],
  ['jacobian', 0, 20.2, 21.75, [1.0, 0.62, 0.5], 0.5, 0.8, 1.6],
  ['percolation', 1, 21.9, 25.9, [1.0, 0.82, 0.45], 1.0, 1.0, 7],
  ['navier', 2, 29.5, 31.95, [0.86, 0.8, 1.0], 0.4, 0.8, 2.0],
  ['papers', 0, 32.0, 32.75, [0.92, 0.92, 0.96], 0.5, 0.8, 2],
  ['yangmills', 0, 33.0, 33.75, [0.8, 0.9, 1.0], 0.5, 0.9, 2.5],
  ['eth', 3, 34.4, 36.9, [1, 1, 1], 1.0, 1.0, 10],
];
const TAIL = 0.6;           // a slot stays live this long after its out time

export class Particles {
  constructor(film) {
    this.root = new THREE.Group();
    this.film = film;
    // ---- dust
    this.layers = LAYERS.map((ly) => {
      const rnd = mulberry32(ly.seed);
      const g = quads(ly.n, [['seed', 4, () => [rnd(), rnd(), rnd(), rnd()]]]);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: this.common({
          uCam: { value: new THREE.Vector3() }, uTile: { value: ly.tile }, uR: { value: new THREE.Vector2(...ly.r) },
          uGain: { value: ly.gain }, uTint: { value: new THREE.Vector3(...ly.tint) },
          uShock0: { value: new THREE.Vector4() }, uShock1: { value: new THREE.Vector4() },
          uShockC: { value: new THREE.Vector3() }, uShockAW: { value: new THREE.Vector2(3, 8) },
        }),
        vertexShader: DUST_VS, fragmentShader: FRAG,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -5;
      this.root.add(mesh);
      return { ...ly, mesh, mat };
    });

    // ---- swarm: head path texture, formation texture, per-particle life
    const head = new Float32Array(HEAD_W * Math.ceil(HEAD_N / HEAD_W) * 4);
    for (let i = 0; i < HEAD_N; i++) { const p = film.headAt(i / HEAD_RATE); head.set([p.x, p.y, p.z, 1], i * 4); }
    this.tHead = new THREE.DataTexture(head, HEAD_W, Math.ceil(HEAD_N / HEAD_W), THREE.RGBAFormat, THREE.FloatType);
    this.tHead.needsUpdate = true;
    const form = new Float32Array(SWARM_SIDE * SWARM_SIDE * FORMS.length * 4);
    FORMS.forEach(([id], k) => {
      const pts = this.shape(id, film);
      for (let i = 0; i < SWARM_N; i++) form.set(pts[i], (k * SWARM_N + i) * 4);
    });
    this.tForm = new THREE.DataTexture(form, SWARM_SIDE, SWARM_SIDE * FORMS.length, THREE.RGBAFormat, THREE.FloatType);
    this.tForm.needsUpdate = true;
    const rnd = mulberry32(4242);
    const g = quads(SWARM_N, [
      ['seed', 4, () => [rnd(), rnd(), rnd(), rnd()]],
      // lifetimes divide the loop exactly, so births line up across the seam
      ['life', 4, () => { const want = 0.55 + 1.0 * rnd(); return [N_BARS / Math.round(N_BARS / want), rnd(), rnd(), rnd()]; }],
      ['dir', 3, () => { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u); return [q * Math.cos(th), u, q * Math.sin(th)]; }],
      ['idx', 1, (i) => [i]],
    ]);
    this.swarmMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: this.common({
        tHead: { value: this.tHead }, tForm: { value: this.tForm },
        uB: { value: 0 }, uDT: { value: 0 }, uGain: { value: 1 }, uWakeIn: { value: 1 },
        uFA: { value: new THREE.Vector4(-1, 0, 0, 0) }, uFB: { value: new THREE.Vector4(-1, 0, 0, 0) },
        uColA: { value: new THREE.Vector3(1, 1, 1) }, uColB: { value: new THREE.Vector3(1, 1, 1) },
        uPA: { value: new THREE.Vector3(1, 1, 1) }, uPB: { value: new THREE.Vector3(1, 1, 1) },
        uNS: { value: L.navier.center.clone() }, uTop: { value: L.eth.top.clone() },
      }),
      vertexShader: SWARM_VS, fragmentShader: FRAG,
    });
    this.swarm = new THREE.Mesh(g, this.swarmMat);
    this.swarm.frustumCulled = false;
    this.swarm.renderOrder = 5;
    this.root.add(this.swarm);
  }

  common(extra) {
    return { uVP0: { value: new THREE.Matrix4() }, uVP1: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(1080, 1920) }, uProj: { value: 2.7 }, ...extra };
  }

  // ---- formation shapes: SWARM_N points [x, y, z, data] per milestone
  shape(id, film) {
    const rnd = mulberry32(7000 + id.length * 31 + id.charCodeAt(0));
    const out = [];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const push = (p, w = 0) => out.push([p.x, p.y, p.z, w]);
    const piece = (pid) => film.pieces.find((p) => p.id === pid);
    const jit = (s) => V((rnd() - 0.5) * s, (rnd() - 0.5) * s, (rnd() - 0.5) * s);
    if (id === 'shannon') {
      // a shell of possibilities around the head
      const C = posAtS(0);
      for (let i = 0; i < SWARM_N; i++) {
        const u = 1 - 2 * (i + 0.5) / SWARM_N, th = i * 2.399963, q = Math.sqrt(1 - u * u), r = 2.6 + 0.9 * rnd();
        push(V(C.x + q * Math.cos(th) * r, C.y + u * r, C.z + q * Math.sin(th) * r));
      }
    } else if (id === 'deepblue') {
      // brute force: a burst of search rays from the king, up and away from the
      // camera (which works the front of the board), thinning with depth
      const K = L.deepblue.king.clone().add(V(0, 2.0, -0.4));
      const axis = V(0, 1, -0.55).normalize(), ref = V(1, 0, 0);
      const u1 = ref.clone().cross(axis).normalize(), u2 = axis.clone().cross(u1);
      const rays = Array.from({ length: 56 }, () => {
        const ang = 0.62 * Math.sqrt(rnd()), ph = rnd() * Math.PI * 2;
        return axis.clone().multiplyScalar(Math.cos(ang)).addScaledVector(u1, Math.sin(ang) * Math.cos(ph)).addScaledVector(u2, Math.sin(ang) * Math.sin(ph));
      });
      for (let i = 0; i < SWARM_N; i++) {
        const d = rays[i % rays.length], s = 0.4 + 9 * Math.pow(rnd(), 1.6);
        push(K.clone().addScaledVector(d, s).add(jit(0.05)));
      }
    } else if (id === 'alphago') {
      // a ring of light at Move 37, and a faint column rising from it
      const M = L.alphago.move37;
      for (let i = 0; i < SWARM_N; i++) {
        const th = rnd() * Math.PI * 2;
        if (rnd() < 0.78) { const r = 1.0 + 0.45 * rnd(); push(V(M.x + Math.cos(th) * r, M.y + 0.32 + 0.05 * rnd(), M.z + Math.sin(th) * r)); }
        else { const y = -3 * Math.log(1 - 0.95 * rnd()), r = 0.35 * rnd(); push(V(M.x + Math.cos(th) * r, M.y + 0.5 + y, M.z + Math.sin(th) * r)); }
      }
    } else if (id === 'imo24') {
      // rows of glyph points settling onto the Lean card
      const C = L.imo24.center, W = 13, H = W * 940 / 720, ROWS = 30;
      const len = Array.from({ length: ROWS }, () => 0.25 + 0.7 * rnd());
      for (let i = 0; i < SWARM_N; i++) {
        const row = Math.floor(rnd() * ROWS);
        push(V(C.x - W * 0.42 + rnd() * len[row] * W * 0.84, C.y + H / 2 - (row + 1.5) * H / (ROWS + 2), C.z + 0.3));
      }
    } else if (id === 'imo25') {
      // the three circles of the figure: Omega, Gamma and the circle through B, E, F
      const G = construct();
      const circles = [[G.M, G.r], [G.N, G.R], [G.O, G.rO]];
      for (let i = 0; i < SWARM_N; i++) {
        const [o, r] = circles[i % 3], th = rnd() * Math.PI * 2, rr = r * (1 + 0.012 * (rnd() - 0.5));
        push(imo25World({ x: o.x + Math.cos(th) * rr, y: o.y + Math.sin(th) * rr }, 0.05));
      }
    } else if (id === 'erdos') {
      const C = L.erdos.center, K = 15, A = 1.05;
      for (let i = 0; i < SWARM_N; i++) {
        const n = i % (K * K), a = n % K, c = Math.floor(n / K);
        push(V(C.x + (a - (K - 1) / 2) * A, C.y + 0.12, C.z + (c - (K - 1) / 2) * A).add(jit(0.12)));
      }
    } else if (id === 'jacobian') {
      // three streams, one from each preimage, converging on their common image
      const J = piece('jacobian');
      for (let i = 0; i < SWARM_N; i++) {
        const { p, F } = J.three[i % 3], s = Math.sqrt(rnd());
        push(J.world(p.map((v, k) => v + (F[k] - v) * s)).add(jit(0.35 * (1 - s) + 0.03)));
      }
    } else if (id === 'percolation') {
      // rain: random forest sites, each landing at the bar its site opens
      const geo = islandGeom(), isl = geo.isl, P = piece('percolation');
      const sites = [];
      for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
        const i = isl.I(x, y, z);
        if (isl.occ[i] === 5 && !(y + 1 < NY && isl.occ[isl.I(x, y + 1, z)] === 5)) sites.push([x, y, z, isl.thr[i]]);
      }
      const openAt = (thr) => {         // first bar at which pAt(b) >= thr
        let lo = 22.0, hi = 25.6;
        for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (P.pAt(m) >= thr) hi = m; else lo = m; }
        return hi;
      };
      for (let i = 0; i < SWARM_N; i++) {
        const [x, y, z, thr] = sites[Math.floor(rnd() * sites.length)];
        push(V(geo.origin.x + x + 0.5, geo.origin.y + y + 1.05, geo.origin.z + z + 0.5), openAt(thr));
      }
    } else if (id === 'navier') {
      // [axial offset, start radius, start angle, speed]
      for (let i = 0; i < SWARM_N; i++) out.push([(rnd() - 0.5) * 36, 5 + 10 * Math.sqrt(rnd()), rnd() * Math.PI * 2, rnd()]);
    } else if (id === 'papers') {
      const C = L.papers.center;
      for (let i = 0; i < SWARM_N; i++) {
        const y = (rnd() - 0.5) * 28, th = y * 0.4 + rnd() * Math.PI * 2, r = 4 + 5 * Math.sqrt(rnd());
        push(V(C.x + Math.cos(th) * r, C.y + y, C.z + Math.sin(th) * r));
      }
    } else if (id === 'yangmills') {
      // a 7x7x7 lattice of spacetime points around the spinning 4D lattice
      const C = L.yangmills.center, S = 3.2;
      for (let i = 0; i < SWARM_N; i++) {
        const n = i % 343, a = n % 7, c = Math.floor(n / 7) % 7, e = Math.floor(n / 49);
        push(V(C.x + (a - 3) * S, C.y + (c - 3) * S, C.z + (e - 3) * S).add(jit(0.1)));
      }
    } else if (id === 'eth') {
      // the two labs' paths, each point lit as its lab's head passes (sign = lab)
      const E = piece('eth'), END = { oai: 36.0, ant: 36.25 };
      for (let i = 0; i < SWARM_N; i++) {
        const lab = i % 2 ? 'ant' : 'oai', u = rnd();
        const tp = 34.45 + (END[lab] - 34.45) * Math.sqrt(u);
        push(E.paths[lab].getPointAt(u).add(jit(0.9)), lab === 'oai' ? tp : -tp);
      }
    }
    return out;
  }

  // formation slots live at bar b: the latest started one and the next one
  slots(b) {
    const live = FORMS.map((f, k) => ({ f, k })).filter(({ f }) => b >= f[2] - 0.1 && b <= f[3] + TAIL);
    const v = (s) => (s ? [s.k, s.f[1], s.f[2], s.f[3]] : [-1, 0, 0, 0]);
    const c = (s) => (s ? s.f[4] : [1, 1, 1]), pg = (s) => (s ? [s.f[5], s.f[6], s.f[7]] : [0, 1, 1]);
    return [v(live[0]), v(live[1]), c(live[0]), c(live[1]), pg(live[0]), pg(live[1])];
  }

  // per motion-blur sub-sample: b its centre, dt its half-width (bars)
  update({ b, dt, camera, vp0, vp1, res, world }) {
    b = wrap(b);
    const vis = 1 - world;
    const proj = camera.projectionMatrix.elements[5];
    for (const ly of this.layers) {
      const u = ly.mat.uniforms;
      u.uVP0.value.copy(vp0); u.uVP1.value.copy(vp1); u.uRes.value.copy(res); u.uProj.value = proj;
      u.uCam.value.copy(camera.position);
      u.uGain.value = ly.gain * vis;
      // shock fronts: the Navier-Stokes blow-up and the ETH arrival
      const shock = (t) => {
        if (t >= 31.5 && t < 33.0) return { c: L.navier.center, f: (t - 31.5) * 140 };
        if (t >= 36.25 && t < 37.75) return { c: L.eth.top, f: (t - 36.25) * 220 };
        return null;
      };
      const s0 = shock(wrap(b - dt)), s1 = shock(wrap(b + dt)), s = s1 || s0;
      if (s) u.uShockC.value.copy(s.c);
      u.uShock0.value.w = s0 && (!s1 || s0.c === s1.c) ? s0.f : 0;
      u.uShock1.value.w = s1 ? s1.f : 0;
      ly.mesh.visible = vis > 0.001;
    }
    const u = this.swarmMat.uniforms;
    u.uVP0.value.copy(vp0); u.uVP1.value.copy(vp1); u.uRes.value.copy(res); u.uProj.value = proj;
    u.uB.value = b; u.uDT.value = dt;
    u.uGain.value = vis;
    const [A, B, cA, cB, pA, pB] = this.slots(b);
    u.uFA.value.set(...A); u.uFB.value.set(...B);
    u.uColA.value.set(...cA); u.uColB.value.set(...cB);
    u.uPA.value.set(...pA); u.uPB.value.set(...pB);
    // after a consuming formation (rain, vortex, ETH) the wake grows back
    const after = FORMS.filter((f) => f[1] > 0).map((f) => smoothstep(f[3], f[3] + 0.8, b) + (b < f[3] ? 1 : 0)).reduce((m, x) => Math.min(m, clamp(x)), 1);
    u.uWakeIn.value = after;
    this.swarm.visible = vis > 0.001;
  }
}
