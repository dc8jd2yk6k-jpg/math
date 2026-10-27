// The trajectory.
//
// SPINE: an honest chart drawn in world space. x is linear calendar time,
// y is the cumulative count of landmark results. Interpolated monotonically
// (PCHIP) through the milestones, it is flat for decades and then goes
// vertical in 2026: the exponential reveals itself only when seen whole.
//
// TRAIL: the luminous path the camera rides. It is a helix wound around the
// spine whose radius unfurls from the seed point, then tightens as the
// breakthroughs accelerate, and converges onto the spine at the ETH climax.
import * as THREE from 'three';
import { MILESTONES, decimalYear } from './data.js';
import { Pchip, keys, smoothstep, clamp } from './util.js';
import { N_BARS } from './config.js';

export const Y0 = 1950.17;      // Shannon, March 1950: the origin of the time axis
export const XS = 3.5;          // world units per calendar year
export const YS = 22;           // world units per landmark result

const years = MILESTONES.map((m) => decimalYear(...m.date));
export const MILESTONE_YEARS = years;
const spineY = new Pchip(years, MILESTONES.map((m) => m.n * YS));

export const xOfYear = (yr) => (yr - Y0) * XS;
export const yOfYear = (yr) => Math.max(0, spineY.at(Math.max(yr, Y0)));

// calendar time as a function of musical position (bars)
const CAL_KNOTS = [
  [0, Y0],
  [2, years[1]],             // Deep Blue
  [5, 1999.0],
  [6, years[2]],             // AlphaGo
  [8.5, 2017.8],
  [10, years[3]],            // IMO 2024
  [14, years[4]],            // IMO 2025
  [16, years[5]],            // Erdős
  [18, years[6]],            // Jacobian
  [20, years[7]],            // percolation
  [22, years[8]],            // Navier–Stokes
  [23, years[9]],            // 722 manuscripts
  [24, years[10]],           // Yang–Mills
  [26, years[11]],           // ETH (Oct 27, "today")
];
const cal = new Pchip(CAL_KNOTS.map((k) => k[0]), CAL_KNOTS.map((k) => k[1]));
export const calendarAt = (b) => (b <= 0 ? Y0 : b >= 26 ? years[11] : cal.at(b));

// beyond ETH the head keeps climbing into the (extrapolated) future
const EXT = new Pchip([26, 27, 30, 34, 36], [0, 9, 20, 46, 170]);

function rawSpine(b, out) {
  if (b <= 26) {
    const yr = calendarAt(b);
    return out.set(xOfYear(yr), yOfYear(yr), 0);
  }
  const yr = years[11];
  return out.set(xOfYear(yr), yOfYear(yr) + EXT.at(b), 0);
}

// helix radius and twist rate as functions of bars
const radiusAt = (b) => keys([
  { b: 0, v: 0 }, { b: 1.6, v: 9, e: 'outCubic' }, { b: 10, v: 7.5 }, { b: 14, v: 4.6 },
  { b: 16, v: 3.2 }, { b: 22, v: 1.25 }, { b: 25.4, v: 0.18 }, { b: 26, v: 0, e: 'outQuad' },
], b);
const twistAt = (b) => keys([   // turns per bar
  { b: 0, v: 0.32 }, { b: 10, v: 0.5 }, { b: 16, v: 0.95 }, { b: 22, v: 1.7 }, { b: 26, v: 2.6 },
  { b: 30, v: 1.0 },
], b);

// ---- precomputed tables (b from B_MIN to B_MAX at step DB)
export const B_MIN = -1, B_MAX = N_BARS + 1;
const DB = 1 / 160;
const N = Math.round((B_MAX - B_MIN) / DB) + 1;
const raw = new Float32Array(N * 3);
const sm = new Float32Array(N * 3);
const tan = new Float32Array(N * 3);
const nor = new Float32Array(N * 3);
const head = new Float32Array(N * 3);
const phase = new Float32Array(N);
const rad = new Float32Array(N);

(function build() {
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const b = B_MIN + i * DB;
    if (b < 0) {
      // before the seed: a short straight lead-in along +x (only used for the loop pre-roll)
      rawSpine(0, v); v.x += b * 6;
    } else rawSpine(b, v);
    raw[i * 3] = v.x; raw[i * 3 + 1] = v.y; raw[i * 3 + 2] = v.z;
  }
  // gaussian-smoothed spine (camera-grade: no curvature jumps at PCHIP knots)
  const sigma = 0.35 / DB, R = Math.ceil(sigma * 3);
  const wts = []; let ws = 0;
  for (let k = -R; k <= R; k++) { const w = Math.exp(-0.5 * (k / sigma) ** 2); wts.push(w); ws += w; }
  for (let i = 0; i < N; i++) {
    let x = 0, y = 0, z = 0;
    for (let k = -R; k <= R; k++) {
      const j = clamp(i + k, 0, N - 1) | 0;
      const w = wts[k + R];
      x += raw[j * 3] * w; y += raw[j * 3 + 1] * w; z += raw[j * 3 + 2] * w;
    }
    sm[i * 3] = x / ws; sm[i * 3 + 1] = y / ws; sm[i * 3 + 2] = z / ws;
  }
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 2), c = Math.min(N - 1, i + 2);
    let tx = sm[c * 3] - sm[a * 3], ty = sm[c * 3 + 1] - sm[a * 3 + 1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    if (i > 0 && l < 1e-6) { tx = tan[(i - 1) * 3]; ty = tan[(i - 1) * 3 + 1]; }
    tan[i * 3] = tx; tan[i * 3 + 1] = ty; tan[i * 3 + 2] = 0;
    nor[i * 3] = -ty; nor[i * 3 + 1] = tx; nor[i * 3 + 2] = 0;   // planar: N = Z × T
  }
  // helix
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const b = B_MIN + i * DB;
    ph += twistAt(Math.max(0, b)) * DB * Math.PI * 2;
    phase[i] = ph;
    const r = b < 0 ? 0 : radiusAt(b);
    rad[i] = r;
    const c = Math.cos(ph), s = Math.sin(ph);
    head[i * 3] = raw[i * 3] + r * nor[i * 3] * c;
    head[i * 3 + 1] = raw[i * 3 + 1] + r * nor[i * 3 + 1] * c;
    head[i * 3 + 2] = raw[i * 3 + 2] + r * s;
  }
})();

function sample(arr, b, out) {
  const f = clamp((b - B_MIN) / DB, 0, N - 1.0001);
  const i = Math.floor(f), t = f - i;
  return out.set(
    arr[i * 3] + (arr[i * 3 + 3] - arr[i * 3]) * t,
    arr[i * 3 + 1] + (arr[i * 3 + 4] - arr[i * 3 + 1]) * t,
    arr[i * 3 + 2] + (arr[i * 3 + 5] - arr[i * 3 + 2]) * t,
  );
}

export const spineAt = (b, out = new THREE.Vector3()) => sample(raw, b, out);
export const spineSmoothAt = (b, out = new THREE.Vector3()) => sample(sm, b, out);
export const tangentAt = (b, out = new THREE.Vector3()) => sample(tan, b, out).normalize();
export const normalAt = (b, out = new THREE.Vector3()) => sample(nor, b, out).normalize();
export const headAt = (b, out = new THREE.Vector3()) => sample(head, b, out);
export const radiusAtBar = radiusAt;
export function phaseAt(b) {
  const f = clamp((b - B_MIN) / DB, 0, N - 1.0001);
  const i = Math.floor(f);
  return phase[i] + (phase[i + 1] - phase[i]) * (f - i);
}
export const Z = new THREE.Vector3(0, 0, 1);

// speed of the head in world units per bar (for streaks, blur, FX)
export function headSpeed(b) {
  const a = new THREE.Vector3(), c = new THREE.Vector3();
  headAt(b - 0.02, a); headAt(b + 0.02, c);
  return a.distanceTo(c) / 0.04;
}

// samples for building the trail geometry
export function trailSamples(step = 1 / 200) {
  const out = [];
  const v = new THREE.Vector3();
  for (let b = 0; b <= N_BARS + 0.5; b += step) out.push({ b, p: headAt(b, v).clone() });
  return out;
}

export function spineSamples(b0, b1, step = 1 / 100) {
  const out = [];
  for (let b = b0; b <= b1; b += step) out.push(spineAt(b));
  return out;
}

// the spine as a function of calendar year (for the reveal chart)
export function spineOfYear(yr) {
  return new THREE.Vector3(xOfYear(yr), yOfYear(yr), 0);
}

// local frame at bar b: T (forward), N (up, in-plane), Z (side)
export function frameAt(b) {
  return { S: spineSmoothAt(b), T: tangentAt(b), N: normalAt(b), Z: Z.clone() };
}

export const MILESTONE_BARS = MILESTONES.map((m) => m.bar);
export function milestonePos(id) {
  const m = MILESTONES.find((x) => x.id === id);
  return headAt(m.bar);
}
export const smoothFade = smoothstep;
