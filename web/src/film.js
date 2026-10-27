// The director: owns renderer, world, set pieces, camera, HUD and post, and
// turns a time t into a frame. Every value is a pure function of t, so frames
// can be rendered in any order, in parallel, deterministically.
import * as THREE from 'three';
import { W, H, FPS, BAR, BEAT, DURATION, LOOP_BARS, N_BARS, toBar } from './config.js';
import { World, trailColorAt } from './world.js';
import { CameraRig } from './camera.js';
import { Post } from './gfx/post.js';
import { HUD } from './hud/hud.js';
import { computeAnchors } from './pieces/common.js';
import { Chess } from './pieces/chess.js';
import { Go } from './pieces/go.js';
import { IMO } from './pieces/imo.js';
import { Erdos, Jacobian, Percolation, Navier, Papers, YangMills } from './pieces/frontier.js';
import { ETH } from './pieces/eth.js';
import { headAt, calendarAt, headSpeed } from './curve.js';
import { setUniforms } from './gfx/glow.js';
import { clamp, smoothstep, envelope, keys, fract, Pchip, ease, lerp } from './util.js';
import { PALETTE } from './config.js';

// bullet-time around the ETH photo finish: world motion slows, camera doesn't
const WARP = new Pchip([-2, 25.6, 26.0, 27.0, 28.5, 30.5, 33.2, 34.2, 35, 40], [-2, 25.6, 25.97, 26.12, 26.45, 27.6, 32.9, 34.2, 35, 40]);   // identity from bar 35 (loop seam)
export const warp = (b) => WARP.at(b);

const HITS = [   // [bar, strength] impulses for flash / CA / glitch / FOV punch
  [0, 1.0], [2, 0.5], [5, 0.4], [6, 0.6], [8, 0.8], [10, 0.8], [12, 0.3], [14, 1.0], [16, 0.8],
  [18, 0.6], [19, 0.5], [20, 0.6], [22, 0.7], [22.88, 0.6], [23, 0.6], [24, 0.6], [26, 1.3], [30, 0.6],
];
const impulse = (b, k = 8) => {
  let v = 0;
  for (const [hb, s] of HITS) if (b >= hb && b - hb < 1.5) v = Math.max(v, s * Math.exp(-(b - hb) * k));
  return v;
};

export class Film {
  constructor(canvas, features) {
    this.features = features;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.A = computeAnchors();
    this.world = new World();
    this.scene.add(this.world.root);
    this.pieces = {
      chess: new Chess(this.A), go: new Go(this.A), imo: new IMO(this.A),
      erdos: new Erdos(this.A), jacobian: new Jacobian(this.A), percolation: new Percolation(this.A),
      navier: new Navier(this.A), papers: new Papers(this.A), yangmills: new YangMills(this.A), eth: new ETH(this.A),
    };
    this.A.move37 = this.pieces.go.move37World;
    for (const p of Object.values(this.pieces)) this.scene.add(p.root);
    this.rig = new CameraRig(this.A);
    this.post = new Post(this.renderer, W, H);
    this.hud = new HUD();
    this.seamRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.mixPass = null;
    this.frame = 0;
    this.stats = {};
  }

  feature(name, t) {
    const f = this.features;
    if (!f) return 0;
    const arr = f[name];
    const x = ((t * FPS) % arr.length + arr.length) % arr.length;
    const i = Math.floor(x), k = x - i;
    return arr[i] * (1 - k) + arr[(i + 1) % arr.length] * k;
  }

  // ---------------------------------------------------------------- direction
  params(b, t) {
    const low = this.feature('low', t), rms = this.feature('rms', t), onset = this.feature('onset', t);
    const beat = Math.exp(-fract(b * 4) * 7);          // quarter-note pulse
    const hit = impulse(b);
    const seamOut = 1 - smoothstep(34.9, 35.85, b);     // world fades for the loop
    const ign = b >= 0 ? (1 - Math.exp(-b * 45)) * Math.exp(-b * 4.5) : 0;   // ignition: rises over ~4 frames
    const phase = b < 10 ? 0 : b < 16 ? 1 : b < 26 ? 2 : b < 30 ? 3 : 4;
    const P = {
      beat, low, rms, onset, hit,
      headPx: (150 + 60 * beat + 170 * ign + 40 * hit) * (b > 30 && b < 34 ? 0.6 : 1),
      headGain: (1 + 1.6 * ign) * (1 - envelope(b, 25.05, 27.8, 0.08, 0.4)),
      headColor: trailColorAt(Math.max(0, b)).map((c) => c * 0.9 + 0.25),
      streak: 1 + 0.6 * hit,
      trailTail: b > 29.5 ? 2000 : 7,
      trailGain: (b > 29.5 ? 1.25 : 1) * seamOut * (0.9 + 0.2 * beat),
      trailWidth: b > 29.5 ? 1.1 : 0.6,
      spineGain: smoothstep(29.8, 31.0, b) * seamOut * 1.2 + envelope(b, 14, 26.2, 1, 0.3) * 0.1,
      spineWidth: b > 29.5 ? 1.0 : 0.35,
      stationGain: envelope(b, 30.4, 35.4, 0.5, 0.5) * 1.2,
      gridGain: smoothstep(0.0, 0.7, b) * seamOut * (b > 29.5 ? 0.9 : 0.75),
      axisGain: (envelope(b, 9, 30, 1.5, 0.5) * 0.45 + envelope(b, 29.8, 35.2, 0.8, 0.6) * 0.9),
      starGain: 0.55 + 0.25 * envelope(b, 2, 34, 2, 2),
      dustGain: (b > 30 && b < 34 ? 0.25 : 1),
      pieceGain: 1,
      gateGain: (1 - smoothstep(26.0, 26.6, b)) * 0.9,
      yearLabelGain: envelope(b, 30.2, 35.3, 0.6, 0.5) * 0.9,   // floor years only in the reveal (gates carry them before)
      streakGain: 0, streakLen: 0,
    };
    {
      const v = headSpeed(warp(b)) / BAR;     // world units per second
      const windows = envelope(b, 0.15, 1.9, 0.2, 0.3) + envelope(b, 4.85, 6.1, 0.15, 0.3) + envelope(b, 9.0, 10.2, 0.3, 0.3)
        + envelope(b, 14.9, 25.9, 0.3, 0.1) * 0.8;
      P.streakGain = clamp(windows) * 0.9;
      P.streakLen = clamp(v * 0.07, 0.3, 7);
    }
    // post FX
    const spike = (b0, a, k) => (b >= b0 ? a * (1 - Math.exp(-(b - b0) * 60)) * Math.exp(-(b - b0) * k) : 0);
    const flash = Math.max(
      spike(0, 0.6, 7), spike(14, 0.8, 6), spike(26, 1.0, 4.5), spike(22.88, 0.7, 9),
      spike(19, 0.5, 9), spike(10, 0.5, 8), spike(16, 0.5, 8), spike(8, 0.5, 7), spike(30, 0.4, 5),
    );
    const flashColor = b >= 14 && b < 15 ? [1.0, 0.85, 0.55] : [1, 1, 1];
    const glitchHits = [1.6, 4.75, 5.75, 7.75, 9.85, 13.9, 15.9, 17.9, 19.9, 21.9, 22.95, 23.9, 25.0, 26.0, 29.6];
    let glitch = 0;
    for (const g of glitchHits) if (b >= g && b - g < 0.09) glitch = Math.max(glitch, 1 - (b - g) / 0.09);
    const hudGlitch = glitch * 0.45;
    const shakeBase = [0.25, 0.6, 0.9, 1.3, 0.12][phase];
    P.fx = {
      uExposure: 1.0 + 0.12 * hit,
      uBloom: 0.85 + 0.25 * low + 0.3 * hit,
      uCA: hit > 0.05 || glitch > 0 ? 0.25 + 1.8 * hit + 2.0 * glitch : 0.0,
      uGlitch: glitch * (b > 25 && b < 26.2 ? 1.0 : 0.6),
      uGlitchSeed: Math.floor(b * 32),
      uGrain: 0.028,
      uVignette: 0.6,
      uFlash: flash,
      uFlashColor: flashColor,
      uHudAlpha: 1,
      uHudGlitch: hudGlitch,
      uFade: 1,
      uScan: glitch,
      uSat: 1.0,
    };
    P.shake = shakeBase * (0.4 + 1.2 * low) + 1.6 * hit;
    P.punch = 10 * impulse(b, 6) + (phase === 2 ? 1.2 * beat : 0);
    P.bloomThreshold = 0.8;
    return P;
  }

  hudState(b, P) {
    const A = this.A, pc = this.pieces;
    const headPos = headAt(warp(b));
    const callouts = [
      { p: pc.chess.treeTop, text: '200,000,000 POSITIONS / S', sub: 'BRUTE-FORCE ALPHA-BETA SEARCH', b0: 2.55, b1: 4.6, dx: 80, dy: -70 },
      { p: pc.chess.kingWorld, text: 'KASPAROV RESIGNS', sub: 'GAME 6 · AFTER 19.c4', b0: 4.05, b1: 4.85, dx: -90, dy: -80, color: '#ff9a9a' },
      { p: pc.go.netTop, text: 'POLICY + VALUE NETWORKS', sub: 'TRAINED BY SELF-PLAY', b0: 6.5, b1: 7.8, dx: 90, dy: -40 },
      { p: pc.go.move37World, text: 'MOVE 37', sub: 'ALPHAGO\'S ESTIMATE: 1 IN 10,000 HUMANS WOULD PLAY IT', b0: 8.05, b1: 9.5, dx: 110, dy: -110, size: 22, color: '#ffe3a0' },
      { p: pc.imo.dialWorld, text: 'UP TO 72 H OF COMPUTE', sub: 'PER PROBLEM · HUMANS GET 4.5 H', b0: 10.9, b1: 13.6, dx: -80, dy: -90, color: '#ff8a8a' },
      { p: pc.erdos.center, text: 'EVERY EDGE: LENGTH EXACTLY 1', b0: 16.35, b1: 17.7, dx: 90, dy: -90 },
      { p: pc.jacobian.targetWorld, text: 'THREE POINTS → ONE', sub: 'NOT INJECTIVE ⇒ NOT INVERTIBLE', b0: 19.0, b1: 19.85, dx: 90, dy: -80, color: '#ffd0a0' },
      { p: pc.percolation.cornerWorld, text: 'p = p꜀ ≈ 0.2488', sub: 'CLUSTERS LARGE, BUT ALL FINITE', b0: 20.55, b1: 21.8, dx: 70, dy: -60 },
      { p: pc.navier.coreWorld, text: '|u| → ∞  AS  t → T*', b0: 22.45, b1: 22.98, dx: 90, dy: -80, color: '#bfe0ff' },
    ];
    if (pc.eth.cometWorld) {
      callouts.push({ p: pc.eth.cometWorld[0], text: 'OPENAI', sub: 'FOUND OCT 16', b0: 25.15, b1: 27.5, dx: -110, dy: -70, color: '#ffffff' });
      callouts.push({ p: pc.eth.cometWorld[1], text: 'ANTHROPIC', sub: 'FOUND OCT 16', b0: 25.15, b1: 27.5, dx: 110, dy: -70, color: '#ffb393' });
    }
    const t = b * BAR;
    const dcal = (calendarAt(b + 0.01) - calendarAt(b - 0.01)) / (0.02 * BAR);
    const inChase = (b > 0.25 && b < 1.6) || (b > 4.95 && b < 5.85) || (b > 15.3 && b < 15.9) || (b > 17.1 && b < 17.9) || (b > 19.15 && b < 19.9) || (b > 21.1 && b < 21.9) || (b > 22.9 && b < 23.9);
    return {
      b, camera: this.rig.cam, headPos, callouts,
      hudAlpha: 1,
      boot: smoothstep(0.02, 0.35, b) * (1 - smoothstep(35.4, 35.9, b)),
      chrome: 1 - envelope(b, 29.9, 35.6, 0.4, 0.3) * 0.85,
      towerAlpha: smoothstep(1.9, 2.1, b) * (1 - envelope(b, 29.9, 36.5, 0.4, 0.1)),
      revealLabels: envelope(b, 30.4, 35.3, 0.4, 0.5),
      reticle: inChase ? 0.8 : 0,
      yearsPerSec: Math.max(0, dcal),
    };
  }

  // ---------------------------------------------------------------- frame
  setTime(b, P) {
    const wb = warp(b);
    const cam = this.rig.apply(b, { shake: P.shake, punch: P.punch });
    const pixelScale = (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const headPos = headAt(wb);
    const ctx = { b, wb, camera: cam, headPos, hp: P, pixelScale, beat: P.beat, pieceGain: P.pieceGain };
    // world
    setUniforms(this.world.root, { uTime: b, uPixel: pixelScale });
    this.world.trail.material.uniforms.uTime.value = wb;
    this.world.update({ ...ctx, b: wb });
    for (const p of Object.values(this.pieces)) p.update(b, ctx);
    return cam;
  }

  // renders the full frame for musical time b into post.finalRT
  renderFinal(b, frameNo) {
    const t = b * BAR;
    const P = this.params(b, t);
    // motion blur sample count from camera angular + positional velocity
    const n = this.blurSamples(b, P);
    const shutter = 0.5 / FPS / BAR;       // 180° shutter, in bars
    let cam;
    const dbg0 = this.debug || {};
    const hdr = this.post.renderHDR(dbg0.noScene ? this.emptyScene || (this.emptyScene = new THREE.Scene()) : this.scene, this.rig.cam, dbg0.noBlur ? 1 : n, (sub) => { cam = this.setTime(b + sub * shutter, P); });
    if (n > 1) cam = this.setTime(b, P);   // HUD projections at the frame centre
    const dbg = this.debug || {};
    const bloom = dbg.noBloom ? hdr : this.post.bloom(hdr, P.bloomThreshold);
    const hs = this.hudState(b, P);
    if (!dbg.noHud) this.hud.draw(hs);
    this.post.composite(hdr, bloom, this.hud.tex, { ...P.fx, uFrame: frameNo });
    this.stats.samples = n;
  }

  blurSamples(b, P) {
    const dt = 0.5 / FPS / BAR;
    const a = this.rig.evaluate(b - dt / 2), c = this.rig.evaluate(b + dt / 2);
    const ang = a.q.angleTo(c.q);
    const pixelScale = (H / 2) / Math.tan(THREE.MathUtils.degToRad(a.fov) / 2);
    const head = headAt(warp(b));
    const d = Math.max(4, a.pos.distanceTo(head));
    const move = a.pos.distanceTo(c.pos) / d;
    const px = (ang + move * 0.6) * pixelScale + Math.abs(c.fov - a.fov) * 8;
    return Math.max(1, Math.min(7, Math.ceil(px / 7)));
  }

  render(t, frameNo = Math.round(t * FPS)) {
    const T0 = performance.now();
    let b = toBar(t);
    const L = LOOP_BARS;
    b = ((b % L) + L) % L;
    this.renderFinal(b, frameNo);
    // loop seam: crossfade the last quarter bar into the pre-roll of the opening
    const seamStart = L - 0.25;
    if (b > seamStart) {
      const w = smoothstep(seamStart, L, b);
      this.copyFinal(this.seamRT);
      this.renderFinal(b - L, frameNo);
      this.mixFinal(this.seamRT, 1 - w);
    }
    this.stats.ms = performance.now() - T0;
    this.frame = frameNo;
  }

  copyFinal(dst) {
    if (!this.copyPass) {
      this.copyPass = this.makePass('uniform sampler2D tA; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tA, vUv); }', { tA: { value: null } });
    }
    this.copyPass.u.tA.value = this.post.finalRT.texture;
    this.copyPass.render(this.renderer, dst);
  }

  mixFinal(other, wOther) {
    if (!this.mixPassObj) {
      this.mixPassObj = this.makePass('uniform sampler2D tA; uniform sampler2D tB; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tB, vUv), texture2D(tA, vUv), uW); }', { tA: { value: null }, tB: { value: null }, uW: { value: 0 } });
      this.mixRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    }
    const u = this.mixPassObj.u;
    u.tA.value = other.texture; u.tB.value = this.post.finalRT.texture; u.uW.value = wOther;
    this.mixPassObj.render(this.renderer, this.mixRT);
    this.copyPass.u.tA.value = this.mixRT.texture;
    this.copyPass.render(this.renderer, this.post.finalRT);
  }

  makePass(fs, uniforms) {
    const mat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(mesh);
    const cam = new THREE.Camera();
    return { u: uniforms, render: (r, target) => { r.setRenderTarget(target); r.render(scene, cam); } };
  }

  present() { this.post.toScreen(this.frame); }
  readYUV() { return this.post.readYUV(this.frame); }
}
