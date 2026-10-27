// The director: owns renderer, world, set pieces, camera, HUD and post, and
// turns a time t into a frame. Everything is a pure function of t, so frames
// render in any order, in parallel, deterministically. The film loops exactly:
// bar 36 and bar 0 are the same frame (the head at the top of the curve).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, H, FPS, BAR, LOOP_BARS, toBar } from './config.js';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { Post } from './gfx/post.js';
import { HUD } from './hud/hud.js';
import { Shannon, ETH } from './pieces/eth.js';
import { Chess } from './pieces/chess.js';
import { Go } from './pieces/go.js';
import { LeanCard, Geometry } from './pieces/imo.js';
import { Erdos, Jacobian, Percolation, Navier, Papers, YangMills } from './pieces/frontier.js';
import { headAt, storyAt, frameAt, xOfYear, spineAt, U_END } from './curve.js';
import { clamp, smoothstep, envelope, fract } from './util.js';

export class Film {
  constructor(canvas, features) {
    this.features = features;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.autoClear = false;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    this.key = new THREE.DirectionalLight(0xfff4e8, 1.7);
    this.scene.add(this.key, this.key.target);

    this.world = new World();
    this.scene.add(this.world.root);
    this.pieces = {
      shannon: new Shannon(), chess: new Chess(), go: new Go(), lean: new LeanCard(), geometry: new Geometry(),
      erdos: new Erdos(), jacobian: new Jacobian(), percolation: new Percolation(), navier: new Navier(),
      papers: new Papers(), yangmills: new YangMills(), eth: new ETH(),
    };
    for (const p of Object.values(this.pieces)) this.scene.add(p.root);
    const top = spineAt(U_END);
    this.chartCenter = new THREE.Vector3(xOfYear(1990), (this.world.axisY + top.y) / 2 - 2, 0);
    this.rig = new CameraRig(this.pieces, this.chartCenter);
    this.post = new Post(r, W, H);
    this.hud = new HUD();
    this.frame = 0;
    this.stats = {};
  }

  feature(name, t) {
    const arr = this.features && this.features[name];
    if (!arr) return 0;
    const x = ((t * FPS) % arr.length + arr.length) % arr.length;
    const i = Math.floor(x), k = x - i;
    return arr[i] * (1 - k) + arr[(i + 1) % arr.length] * k;
  }

  params(b, t) {
    const beat = Math.exp(-fract(b * 4) * 7);
    const low = this.feature('low', t);
    const reveal = envelope(b, 30.3, 35.3, 0.8, 0.6);
    const lift = (b0, a, k) => (b >= b0 ? a * (1 - Math.exp(-(b - b0) * 40)) * Math.exp(-(b - b0) * k) : 0);
    const hit = Math.max(lift(0, 0.25, 6), lift(14, 0.35, 5), lift(26, 0.55, 4), lift(30, 0.25, 4), lift(8, 0.2, 6), lift(22.88, 0.4, 8));
    return {
      beat,
      headPx: 46 + 10 * beat + 30 * hit,
      headGain: 1.0,
      lineGain: 1.0,
      lineWidthPx: 2.6 + reveal * 0.4,
      redLen: 0.33,
      starGain: 1.0,
      dustGain: 1 - 0.6 * reveal,
      revealGain: reveal,
      fx: {
        uExposure: 1.0 + 0.4 * hit, uBloom: 0.5 + 0.12 * low, uCA: 0, uGlitch: 0, uGlitchSeed: 0, uGrain: 0.02,
        uVignette: 0.3, uFlash: 0, uFlashColor: [1, 1, 1], uHudAlpha: 1, uHudGlitch: 0, uFade: 1, uScan: 0, uSat: 1,
      },
      bloomThreshold: 0.9,
    };
  }

  // camera + every animated element for musical time b
  setTime(b, P) {
    const u = storyAt(b);
    const cam = this.rig.apply(b, {});
    const pixelScale = (H / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const headPos = headAt(u);
    const ctx = { b, u, camera: cam, headPos, hp: P, pixelScale, beat: P.beat };
    this.world.update(ctx);
    this.world.line.material.uniforms.uHeadPos.value.copy(headPos);
    this.world.line.material.uniforms.uRedLen.value = P.redLen * cam.position.distanceTo(headPos);
    for (const p of Object.values(this.pieces)) p.update(b, ctx);
    // key light follows whichever realistic board is on screen
    const board = this.pieces.chess.root.visible ? this.pieces.chess : this.pieces.go.root.visible ? this.pieces.go : null;
    if (board) {
      const f = frameAt(b < 5.8 ? 3.0 : 7.0);
      this.key.target.position.copy(board.lightTarget);
      this.key.position.copy(board.lightTarget).addScaledVector(f.U, 34).addScaledVector(f.F, 30).addScaledVector(f.R, -18);
      this.key.intensity = 1.7;
    } else this.key.intensity = 0;
    return cam;
  }

  blurSamples(b) {
    const dt = 0.5 / FPS / BAR;
    const a = this.rig.evaluate(b - dt / 2), c = this.rig.evaluate(b + dt / 2);
    const pixelScale = (H / 2) / Math.tan(THREE.MathUtils.degToRad(a.fov) / 2);
    const head = headAt(storyAt(b));
    const move = a.pos.distanceTo(c.pos) / Math.max(4, a.pos.distanceTo(head));
    const px = (a.q.angleTo(c.q) + move * 0.5) * pixelScale;
    return Math.max(1, Math.min(6, Math.ceil(px / 6)));
  }

  renderFinal(b, frameNo) {
    const t = b * BAR;
    const P = this.params(b, t);
    const n = this.blurSamples(b);
    const shutter = 0.5 / FPS / BAR;
    const hdr = this.post.renderHDR(this.scene, this.rig.cam, n, (sub) => { this.setTime(b + sub * shutter, P); });
    if (n > 1) this.setTime(b, P);
    const bloom = this.post.bloom(hdr, P.bloomThreshold);
    const labels = [];
    for (const p of Object.values(this.pieces)) if (p.root.visible) for (const L of p.labels) if (b >= L.b0 && b <= L.b1) labels.push(L);
    this.hud.draw({ b, frame: frameNo, camera: this.rig.cam, labels, dateAlpha: 1, revealGain: P.revealGain, axisY: this.world.axisY });
    this.post.composite(hdr, bloom, this.hud.tex, { ...P.fx, uFrame: frameNo });
    this.stats.samples = n;
  }

  render(t, frameNo = Math.round(t * FPS)) {
    const T0 = performance.now();
    const b = ((toBar(t) % LOOP_BARS) + LOOP_BARS) % LOOP_BARS;
    this.renderFinal(Math.min(b, 36), frameNo);
    this.stats.ms = performance.now() - T0;
    this.frame = frameNo;
  }

  present() { this.post.toScreen(this.frame); }
  readYUV() { return this.post.readYUV(this.frame); }
}
