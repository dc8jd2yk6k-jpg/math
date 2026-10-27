// The persistent world: starfield, camera-relative dust, the 3D coordinate
// space (time axis with year labels, count axis), the luminous trajectory,
// the head (comet), and the spine (the exponential, revealed at the end).
import * as THREE from 'three';
import { makeSegments, makeRibbon, makePoints, textPlane } from './gfx/glow.js';
import {
  trailSamples, spineOfYear, xOfYear, yOfYear, Y0, YS, MILESTONE_YEARS, headAt, spineAt,
} from './curve.js';
import { MILESTONES } from './data.js';
import { rng, keys, hexToRgb, envelope, smoothstep, clamp } from './util.js';
import { PALETTE, TEAM } from './config.js';
import { Gates, makeStreaks } from './gates.js';
import { tangentAt } from './curve.js';

const C = (hex, k = 1) => hexToRgb(hex).map((v) => v * k);

export function trailColorAt(b) {
  const stops = [
    { b: 0, v: C(PALETTE.ice, 1.0) }, { b: 5, v: C(PALETTE.ice, 1.0) },
    { b: 6.2, v: C(PALETTE.jade, 1.0) }, { b: 9.5, v: C(PALETTE.jade, 1.0) },
    { b: 10.5, v: C(PALETTE.silver, 1.0) }, { b: 13.6, v: C(PALETTE.silver, 1.0) },
    { b: 14.2, v: C(PALETTE.gold, 1.3) }, { b: 15.8, v: C(PALETTE.gold, 1.2) },
    { b: 16.5, v: C(PALETTE.purple, 1.3) }, { b: 21, v: C('#ff4fd8', 1.3) },
    { b: 25, v: C(PALETTE.hot, 1.5) }, { b: 26.2, v: [1.6, 1.5, 1.4] }, { b: 40, v: [1.6, 1.5, 1.4] },
  ];
  return keys(stops.map((s) => ({ ...s, e: 'inOutSine' })), b);
}

export class World {
  constructor() {
    this.root = new THREE.Group();
    this.buildStars();
    this.buildDust();
    this.buildAxes();
    this.buildTrail();
    this.buildHead();
    this.buildSpine();
    this.gates = new Gates();
    this.root.add(this.gates.root);
    this.streaks = makeStreaks();
    this.root.add(this.streaks);
  }

  buildStars() {
    const r = rng(11);
    const pts = [];
    for (let i = 0; i < 2600; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const d = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)).multiplyScalar(2600);
      const temp = r();
      const col = temp < 0.2 ? [0.7, 0.8, 1.0] : temp > 0.9 ? [1.0, 0.85, 0.7] : [0.9, 0.92, 1.0];
      const m = Math.pow(r(), 6) * 2.2 + 0.18;
      pts.push({ p: d, color: col.map((c) => c * m), size: 3 + 5 * r(), motion: [r() * 6.28, 0.5 + r() * 2, 0, 0] });
    }
    this.stars = makePoints(pts, {
      minPx: 1.4, maxPx: 3.2,
      displace: { body: 'alpha = 0.75 + 0.25 * sin(uTime * motion.y + motion.x);' },
    });
    this.stars.renderOrder = -10;
    this.root.add(this.stars);
  }

  buildDust() {
    // camera-relative particles in a wrapping box: parallax + speed cue
    const r = rng(5);
    const pts = [];
    for (let i = 0; i < 2200; i++) {
      pts.push({ p: new THREE.Vector3(r(), r(), r()), color: [0.55, 0.7, 0.9], size: 0.05 + r() * 0.07, motion: [r(), r(), 0, 0] });
    }
    this.dust = makePoints(pts, {
      minPx: 1.2, maxPx: 6,
      uniforms: { uCam: { value: new THREE.Vector3() }, uBox: { value: 60 }, uDustGain: { value: 1 } },
      displace: {
        header: 'uniform vec3 uCam; uniform float uBox; uniform float uDustGain;',
        body: `
          vec3 q = position * uBox;
          P = uCam + mod(q - uCam + uBox * 0.5, uBox) - uBox * 0.5;
          float dd = length(P - uCam) / (uBox * 0.5);
          alpha = uDustGain * smoothstep(1.0, 0.55, dd) * smoothstep(0.02, 0.12, dd) * (0.5 + 0.5 * motion.x);
        `,
      },
    });
    this.root.add(this.dust);
  }

  buildAxes() {
    // floor plane of the time axis (y = -16), with grid and year labels
    this.axes = new THREE.Group();
    const segs = [];
    const FLOOR = -16;
    this.floorY = FLOOR;
    const x0 = xOfYear(1950), x1 = xOfYear(2027.2);
    const gridCol = [0.16, 0.3, 0.45];
    for (let yr = 1950; yr <= 2026; yr += 5) {
      const x = xOfYear(yr);
      const major = yr % 10 === 0;
      segs.push({ a: new THREE.Vector3(x, FLOOR, -70), b: new THREE.Vector3(x, FLOOR, 70), color: gridCol.map((c) => c * (major ? 1.4 : 0.7)), width: major ? 0.22 : 0.12, alpha: 1 });
    }
    for (let z = -70; z <= 70; z += 17.5) {
      segs.push({ a: new THREE.Vector3(x0, FLOOR, z), b: new THREE.Vector3(x1, FLOOR, z), color: gridCol.map((c) => c * (z === 0 ? 1.8 : 0.6)), width: z === 0 ? 0.3 : 0.12, alpha: 1 });
    }
    this.floorGrid = makeSegments(segs, { minPx: 1.0, core: 0.4 });
    this.axes.add(this.floorGrid);

    this.yearLabels = new THREE.Group();
    for (let yr = 1950; yr <= 2020; yr += 10) {
      const t = textPlane(String(yr), 3.4, [0.35, 0.6, 0.85], { font: 'title', px: 120 });
      t.position.set(xOfYear(yr) + 0.8, FLOOR + 0.05, 9);
      t.rotation.x = -Math.PI / 2;
      t.geometry.translate(t.geometry.parameters.width / 2, 0, 0);
      this.yearLabels.add(t);
    }
    const t26 = textPlane('2026', 3.4, [0.9, 0.5, 1.0], { font: 'title', px: 120 });
    t26.position.set(xOfYear(2026) + 0.8, FLOOR + 0.05, 9); t26.rotation.x = -Math.PI / 2;
    t26.geometry.translate(t26.geometry.parameters.width / 2, 0, 0);
    this.yearLabels.add(t26);
    this.axes.add(this.yearLabels);

    // vertical count axis at the 2026 wall (tick per landmark)
    const vseg = [];
    const xw = xOfYear(2026.9) + 12;
    vseg.push({ a: new THREE.Vector3(xw, FLOOR, 0), b: new THREE.Vector3(xw, 12 * YS + 40, 0), color: [0.3, 0.45, 0.7], width: 0.3 });
    for (let n = 1; n <= 11; n++) {
      vseg.push({ a: new THREE.Vector3(xw - 2.5, n * YS, 0), b: new THREE.Vector3(xw + 2.5, n * YS, 0), color: [0.4, 0.6, 0.9], width: 0.25 });
    }
    // time axis line along the chart baseline
    vseg.push({ a: new THREE.Vector3(x0, FLOOR, 0), b: new THREE.Vector3(x1 + 14, FLOOR, 0), color: [0.35, 0.55, 0.85], width: 0.35 });
    this.countAxis = makeSegments(vseg, { minPx: 1.2, core: 0.6 });
    this.axes.add(this.countAxis);
    this.countAxisX = xw;
    this.root.add(this.axes);
  }

  buildTrail() {
    const S = trailSamples(1 / 220);
    const pts = S.map((s) => ({
      p: s.p, param: s.b, color: trailColorAt(s.b),
      w: s.b < 10 ? 1.0 : s.b < 16 ? 0.75 : s.b < 26 ? 0.55 : 0.6,
    }));
    this.trail = makeRibbon(pts, { width: 0.6, minPx: 2.2, tail: 7, hot: 0.35 });
    this.root.add(this.trail);
  }

  buildHead() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uGain: { value: 1 }, uStreak: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uGain; uniform float uStreak; uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 q = vUv;
          float r = length(q);
          float core = exp(-r * r * 900.0) * 6.0;
          float halo = exp(-r * r * 60.0) * 1.2 + exp(-r * 9.0) * 0.35;
          float streak = exp(-abs(q.y) * 140.0) * exp(-abs(q.x) * 2.6) * 1.4 * uStreak;
          float vstreak = exp(-abs(q.x) * 220.0) * exp(-abs(q.y) * 7.0) * 0.35 * uStreak;
          float ang = atan(q.y, q.x);
          float rays = pow(abs(cos(ang * 3.0 + uTime * 0.2)), 40.0) * exp(-r * 5.0) * 0.25;
          vec3 c = uColor * (halo + streak + vstreak + rays) + vec3(1.0, 0.98, 0.95) * core;
          gl_FragColor = vec4(c * uGain * smoothstep(1.0, 0.7, r), 1.0);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.head = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.head.frustumCulled = false;
    this.head.renderOrder = 10;
    this.root.add(this.head);
  }

  buildSpine() {
    // the exponential itself: drawn from data, revealed at the end
    const pts = [];
    const yEnd = MILESTONE_YEARS[MILESTONE_YEARS.length - 1];
    const N = 1600;
    for (let i = 0; i <= N; i++) {
      // sample uniformly in arc length-ish: dense where the curve is steep
      const u = i / N;
      const yr = Y0 + (yEnd - Y0) * (1 - Math.pow(1 - u, 3));
      pts.push({ p: spineOfYear(yr), param: u, color: [1.0, 0.95, 0.9], w: 1 });
    }
    this.spine = makeRibbon(pts, { width: 0.7, minPx: 2.2 });
    this.spine.material.uniforms.uGain.value = 0;
    this.root.add(this.spine);

    // dashed extrapolation above "today"
    const top = spineOfYear(yEnd);
    const dash = [];
    for (let k = 0; k < 26; k++) {
      dash.push({ a: new THREE.Vector3(top.x, top.y + 6 + k * 9, 0), b: new THREE.Vector3(top.x, top.y + 10 + k * 9, 0), color: [1, 0.9, 0.85], width: 0.7, alpha: Math.exp(-k * 0.09) });
    }
    this.extrap = makeSegments(dash, { minPx: 2, core: 1 });
    this.extrap.material.uniforms.uGain.value = 0;
    this.root.add(this.extrap);

    // milestone stations (points on the spine) for the reveal
    this.stations = makePoints(MILESTONES.slice(1).map((m, i) => ({
      p: spineOfYear(MILESTONE_YEARS[i + 1]), color: hexToRgb(TEAM[m.team].color).map((c) => c * 2.5), size: 2.4,
    })), { minPx: 6, maxPx: 22 });
    this.stations.material.uniforms.uGain.value = 0;
    this.root.add(this.stations);
  }

  update(ctx) {
    const { b, camera, headPos, hp } = ctx;
    this.dust.material.uniforms.uCam.value.copy(camera.position);
    // head billboard
    this.head.position.copy(headPos);
    this.head.quaternion.copy(camera.quaternion);
    const dist = camera.position.distanceTo(headPos);
    const px = hp.headPx;                      // desired on-screen size in px
    const s = (px / ctx.pixelScale) * dist;    // world size giving that pixel size
    this.head.scale.setScalar(s);
    this.head.material.uniforms.uGain.value = hp.headGain;
    this.head.material.uniforms.uColor.value.setRGB(...hp.headColor);
    this.head.material.uniforms.uStreak.value = hp.streak;
    this.head.material.uniforms.uTime.value = b;

    const tu = this.trail.material.uniforms;
    tu.uHead.value = b;
    tu.uTail.value = hp.trailTail;
    tu.uGain.value = hp.trailGain;
    tu.uWidth.value = hp.trailWidth;

    this.spine.material.uniforms.uGain.value = hp.spineGain;
    this.spine.material.uniforms.uWidth.value = hp.spineWidth;
    this.extrap.material.uniforms.uGain.value = hp.spineGain * 0.8;
    this.stations.material.uniforms.uGain.value = hp.stationGain;
    this.floorGrid.material.uniforms.uGain.value = hp.gridGain;
    this.yearLabels.children.forEach((m) => { m.material.uniforms.uGain.value = hp.gridGain * 0.7; });
    this.countAxis.material.uniforms.uGain.value = hp.axisGain;
    this.stars.material.uniforms.uGain.value = hp.starGain;
    this.gates.update(ctx.b, ctx.b, hp.gateGain, ctx.pixelScale);
    const su = this.streaks.material.uniforms;
    su.uCam.value.copy(camera.position);
    su.uDir.value.copy(tangentAt(ctx.b));
    su.uLen.value = hp.streakLen;
    su.uGain.value = hp.streakGain;
    su.uPixel.value = ctx.pixelScale;
    su.uColor.value.setRGB(...hp.headColor.map((c) => c * 0.6 + 0.2));
    this.dust.material.uniforms.uDustGain.value = hp.dustGain;
  }
}
