// The director: owns the renderer, the world, the set pieces, the camera, the
// HUD and post, and turns a frame number into pixels. Everything is a pure
// function of the bar b, so frames render in any order and in parallel.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FPS, BAR, N_BARS, FRAMES, barOfFrame, wrap, clamp, smoothstep, feature, hitEnv, window_ } from './time.js';
import { S_OF, S_END, posAtS, P_OF, xOfYear } from './curve.js';
import { headSAt, activeMilestone, dateAt, WINDOWS, CREDIT } from './story.js';
import { MILESTONES } from './data.js';
import { Rig } from './camera.js';
import { shotKeys } from './shots.js';
import { Trail } from './world/trail.js';
import { Head } from './world/head.js';
import { Space } from './world/space.js';
import { Post } from './gfx/post.js';
import { HUD } from './hud/hud.js';
import { buildPieces } from './pieces/index.js';

const TITLE_RATE = 30;     // characters per second while typing

export class Film {
  constructor(canvas, { width = 1080, height = 1920, msaa = 4 } = {}) {
    this.W = width; this.H = height;
    this.res = new THREE.Vector2(width, height);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.setPixelRatio(1);
    r.setSize(width, height, false);
    r.autoClear = false;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.22;      // applies to every PBR material (material.envMapIntensity is ignored for scene.environment)

    this.fog = new THREE.Fog(0xb4c6dc, 40, 400);
    this.space = new Space();
    this.trail = new Trail();
    this.head = new Head();
    scene.add(this.space.root, this.trail.root, this.head.mesh);
    this.pieces = buildPieces(this);
    for (const p of this.pieces) scene.add(p.root);

    this.headAt = (b) => posAtS(headSAt(b));
    this.rig = new Rig(shotKeys(), this.headAt, { aspect: width / height });
    for (const p of this.pieces) if (p.cameraPath) this.rig.addPath(p.cameraPath);
    this.post = new Post(r, width, height, { msaa });
    this.hud = new HUD(width, height, r);
    this.prevVP = new THREE.Matrix4();
    this.stats = {};
  }

  // ---- look: exposure, flashes, bloom, CA, driven by cues and the music
  look(b) {
    const low = feature('low', b);
    const hit = hitEnv(b, { min: 0.8, decay: 9 });
    // short exposure kicks: ~0.1 bar, so they read as hits, not as a grey veil
    const flashAt = (b0, a, k = 1) => (wrap(b - b0) < 0.5 ? a * Math.exp(-wrap(b - b0) * 40 * k) * (1 - Math.exp(-wrap(b - b0) * 400)) : 0);
    const flash = Math.max(flashAt(2.0, 0.18), flashAt(26.0, 1.2, 0.6), flashAt(29.0, 0.9, 0.7), flashAt(31.5, 0.9, 0.8), flashAt(36.0, 0.14), flashAt(36.25, 0.14));
    const world = this.worldWeight(b);
    return {
      uExposure: 1.0 + 0.12 * hit, uBloom: 0.045 + 0.015 * low, uCA: 0.0025 + 0.004 * hit, uHudCA: 1.4 + 2.0 * hit,
      uGrain: 0.028, uVignette: 0.32 * (1 - world * 0.5), uFlash: flash, uFlashColor: [1, 0.98, 0.95], uFade: 1, uSat: 1, uLift: 0,
    };
  }

  worldWeight(b) {
    const p = this.pieces.find((q) => q.worldWeight);
    return p ? p.worldWeight(b) : 0;
  }

  // ---- everything that moves, at bar b (called per motion-blur sub-sample)
  setTime(b) {
    b = wrap(b);
    const headS = headSAt(b);
    const headPos = posAtS(headS);
    const punch = 2.2 * hitEnv(b, { min: 0.9, decay: 7 });
    const cam = this.rig.apply(b, { punch, ...(this.shakeAt ? this.shakeAt(b) : {}) });
    const world = this.worldWeight(b);
    const ctx = { b, headS, headPos, camera: cam, res: this.res, world, film: this };
    // inside the island world: daylight haze
    if (world > 0.001) {
      this.scene.fog = this.fog;
      this.fog.near = 70 + 600 * (1 - world) ** 2;
      this.fog.far = 300 + 3000 * (1 - world) ** 2;
    } else this.scene.fog = null;
    this.space.update({ camera: cam, prevVP: this.prevVP, res: this.res, world, streak: 1 });
    const distToHead = cam.position.distanceTo(headPos);
    this.trail.update({ headS, camera: cam, res: this.res, gain: 1, redLen: Math.max(3, distToHead * 0.14) });
    const headGain = this.headGain ? this.headGain(b) : 1;
    this.head.update({ pos: headPos, res: this.res, px: 44 * (1 + 0.18 * feature('low', b)) + 30 * hitEnv(b, { min: 1.2, decay: 5 }), gain: headGain });
    for (const p of this.pieces) p.update(b, ctx);
    this.ctx = ctx;
    return cam;
  }

  blurSamples(b) {
    const db = 0.5 / FPS / BAR;          // 180-degree shutter
    const sp = this.rig.speed(b, db);
    // a pure function of b: the fov comes from the pose at b, not from the camera's last state
    const fov = this.rig.pose(b).fov;
    const px = (sp.ang + sp.lin / Math.max(5, sp.dist) * 0.6) * (this.H / 2) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    return Math.max(1, Math.min(8, Math.ceil(px / 5)));
  }

  header(b, frame) {
    b = wrap(b);
    const m = activeMilestone(b);
    const inCredit = b >= CREDIT[0] && b < CREDIT[1];
    const date = dateAt(b);
    // digits that changed in the last ~0.12 s scramble
    const past = [dateAt(b - 0.03), dateAt(b - 0.06)];
    const changed = [...date].map((ch, i) => /\d/.test(ch) && past.some((p) => p.length !== date.length || p[i] !== ch));
    const last = changed.lastIndexOf(true);
    const scramble = changed.map((c, i) => c && i === last);
    let title = '', titleChars = 0, caption = '', captionAlpha = 0, cursor = false;
    if (m || inCredit) {
      const [a, z] = inCredit ? CREDIT : WINDOWS[m.id];
      title = inCredit ? 'Δt → 0' : m.title;
      caption = inCredit ? 'Every frame rendered in real time, from code written by Claude.' : m.caption;
      const n = [...title.replace(/[\^_]\{([^}]*)\}/g, '$1')].length;
      const tIn = (b - a - 0.03) * BAR * TITLE_RATE;
      const del = 0.1;
      const tOut = (z - b) / del * n;
      titleChars = Math.max(0, Math.min(n, Math.floor(tIn), Math.ceil(tOut)));
      cursor = tIn > 0 && tIn < n + 6 && Math.floor(b * 16) % 2 === 0 && tOut > n;
      const typed = a + 0.03 + n / TITLE_RATE / BAR;
      captionAlpha = smoothstep(typed, typed + 0.12, b) * (1 - smoothstep(z - 0.1, z, b));
    }
    const alpha = smoothstep(0.3, 0.55, b) * (1 - smoothstep(38.45, 38.7, b));
    return { date, scramble, title, titleChars, caption, captionAlpha, cursor, alpha, world: this.worldWeight(b) };
  }

  labels(b) {
    const out = [];
    for (const p of this.pieces) if (p.root.visible || p.alwaysLabels) out.push(...p.labels(b, this.ctx));
    // small lab names beside the milestone dots on the line, when the camera is close
    const ctx = this.ctx;
    const w = wrap(b);
    if (!(w > 38.4 && w < 41.6)) {
      for (const m of MILESTONES) {
        if (m.id === 'shannon' || ctx.headS < S_OF[m.id] + 40) continue;
        const d = ctx.camera.position.distanceTo(P_OF[m.id]);
        const a = smoothstep(260, 140, d) * (1 - ctx.world);
        if (a > 0.01) out.push({ p: P_OF[m.id], text: m.lab, style: 'label', size: 17, dx: 14, dy: 6, alpha: a * 0.8, color: 'rgba(214,216,226,1)' });
      }
    }
    return out;
  }

  axis(b) {
    b = wrap(b);
    const alpha = smoothstep(38.95, 39.35, b) * (1 - smoothstep(40.55, 40.85, b));
    if (alpha <= 0) return null;
    const y = -40;
    const tick = (yr, red = false) => ({ p: new THREE.Vector3(xOfYear(yr), y, 0), text: String(yr), red });
    return { alpha, from: new THREE.Vector3(xOfYear(1950), y, 0), to: new THREE.Vector3(xOfYear(2026.9), y, 0),
      ticks: [tick(1950), tick(1970), tick(1990), tick(2010), tick(2026, true)] };
  }

  renderFrame(frame) {
    const T0 = performance.now();
    const b = barOfFrame(frame);
    const n = this.blurSamples(b);
    const shutter = 0.5 / FPS / BAR;
    // previous-frame view-projection for dust streaks
    const cprev = this.rig.apply(b - 1 / FPS / BAR);
    this.prevVP.multiplyMatrices(cprev.projectionMatrix, cprev.matrixWorldInverse);
    const aa = this.needAA ? this.needAA(b) : false;
    const hdr = this.post.renderHDR(this.scene, this.rig.cam, n, (u) => this.setTime(b + (u - 0.5) * shutter), aa);
    if (n > 1) this.setTime(b);
    const bloom = this.post.bloom(hdr);
    this.hud.draw({ b, frame, camera: this.rig.cam, header: this.header(b, frame), labels: this.labels(b), axis: this.axis ? this.axis(b) : null });
    this.post.composite(hdr, bloom, this.hud.tex, { ...this.look(b), uFrame: frame % 1000 }, this.post.ldr);
    this.stats = { frame, b: +b.toFixed(3), samples: n, ms: Math.round(performance.now() - T0) };
    return this.stats;
  }

  present() { this.post.toScreen(); }
  readYUV() { return this.post.readYUV(); }
}

export { FRAMES, FPS };
