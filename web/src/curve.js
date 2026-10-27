// The line.
//
// It is an honest chart drawn in world space. x is linear calendar time, and
// y is the cumulative count of landmark results, interpolated monotonically
// (PCHIP) through the milestones. Up close the camera always looks along it,
// so it reads as one straight line. Only when the camera pulls back at the end
// does it turn out to be flat for decades and then vertical in 2026.
//
// u is the "story position" in bars: where the head is on the line. For
// b >= 1 it equals b. Bars 0–1 are the rewind: the head runs back from today
// (u = 36) to 1950 (u = 1). That makes frame 0 identical to the last frame.
import * as THREE from 'three';
import { MILESTONES, decimalYear } from './data.js';
import { Pchip, clamp, ease } from './util.js';
import { N_BARS } from './config.js';

export const Y0 = 1950.17;      // Shannon, March 1950: the origin of the time axis
export const XS = 2.0;          // world units per calendar year
export const YS = 22;           // world units per landmark result
export const U_END = N_BARS;    // story position at the end (= at frame 0)

const years = MILESTONES.map((m) => decimalYear(...m.date));
export const MILESTONE_YEARS = years;
const spineY = new Pchip(years, MILESTONES.map((m) => m.n * YS));

export const xOfYear = (yr) => (yr - Y0) * XS;
export const yOfYear = (yr) => Math.max(0, spineY.at(Math.max(yr, Y0)));

// calendar time as a function of story position
const CAL_KNOTS = [
  [1, Y0],
  [1.5, 1951.0],
  [2, years[1]],             // Deep Blue
  [5.3, 1999.0],
  [6, years[2]],             // AlphaGo
  [9.2, 2017.6],
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
export const calendarAt = (u) => (u <= 1 ? Y0 : u >= 26 ? years[11] : cal.at(u));

// beyond ETH the head climbs on into the extrapolated future and comes to rest at u = 36
const EXT = new Pchip([26, 27, 30, 34, 35.5, 36], [0, 8, 19, 44, 57, 58.5]);

// musical position -> story position
export function storyAt(b) {
  if (b >= 1) return Math.min(b, U_END);
  if (b <= 0) return U_END;
  return U_END - (U_END - 1) * ease.inOutCubic(b);
}

function rawSpine(u, out) {
  if (u <= 26) {
    const yr = calendarAt(u);
    return out.set(xOfYear(yr), yOfYear(yr), 0);
  }
  const yr = years[11];
  return out.set(xOfYear(yr), yOfYear(yr) + EXT.at(Math.min(u, U_END)), 0);
}

// ---- precomputed tables (u from U_MIN to U_MAX at step DU)
const U_MIN = 0, U_MAX = N_BARS + 0.5;
const DU = 1 / 160;
const N = Math.round((U_MAX - U_MIN) / DU) + 1;
const raw = new Float32Array(N * 3);
const tan = new Float32Array(N * 3);

(function build() {
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    rawSpine(U_MIN + i * DU, v);
    raw[i * 3] = v.x; raw[i * 3 + 1] = v.y; raw[i * 3 + 2] = v.z;
  }
  // camera-grade tangent: direction of the gaussian-smoothed path. Where the
  // head is at rest (1950, and today) the last direction of travel is kept.
  const sigma = 0.3 / DU, R = Math.ceil(sigma * 3);
  const wts = []; let ws = 0;
  for (let k = -R; k <= R; k++) { const w = Math.exp(-0.5 * (k / sigma) ** 2); wts.push(w); ws += w; }
  const sm = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    let x = 0, y = 0;
    for (let k = -R; k <= R; k++) {
      const j = clamp(i + k, 0, N - 1) | 0;
      x += raw[j * 3] * wts[k + R]; y += raw[j * 3 + 1] * wts[k + R];
    }
    sm[i * 2] = x / ws; sm[i * 2 + 1] = y / ws;
  }
  let tx = 1, ty = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 3), c = Math.min(N - 1, i + 3);
    const dx = sm[c * 2] - sm[a * 2], dy = sm[c * 2 + 1] - sm[a * 2 + 1];
    const l = Math.hypot(dx, dy);
    if (l > 1e-4) { tx = dx / l; ty = dy / l; }
    tan[i * 3] = tx; tan[i * 3 + 1] = ty; tan[i * 3 + 2] = 0;
  }
})();

function sample(arr, u, out) {
  const f = clamp((u - U_MIN) / DU, 0, N - 1.0001);
  const i = Math.floor(f), t = f - i;
  return out.set(
    arr[i * 3] + (arr[i * 3 + 3] - arr[i * 3]) * t,
    arr[i * 3 + 1] + (arr[i * 3 + 4] - arr[i * 3 + 1]) * t,
    arr[i * 3 + 2] + (arr[i * 3 + 5] - arr[i * 3 + 2]) * t,
  );
}

export const spineAt = (u, out = new THREE.Vector3()) => sample(raw, u, out);
export const headAt = spineAt;
export const tangentAt = (u, out = new THREE.Vector3()) => sample(tan, u, out).normalize();
export const Z = new THREE.Vector3(0, 0, 1);

// Screen-aligned frame at story position u, for a camera on the +Z side looking
// along -Z: U (screen up) = direction of travel, R (screen right), F (toward camera).
export function frameAt(u) {
  const U = tangentAt(u);
  const F = Z.clone();
  const R = new THREE.Vector3().crossVectors(U, F);
  return { S: spineAt(u), U, R, F };
}

// a point given in a milestone's screen frame (x right, y up, z toward camera)
export function localPoint(u, x, y, z = 0) {
  const f = frameAt(u);
  return f.S.clone().addScaledVector(f.R, x).addScaledVector(f.U, y).addScaledVector(f.F, z);
}

export function frameMatrix(u, origin) {
  const f = frameAt(u);
  const m = new THREE.Matrix4().makeBasis(f.R, f.U, f.F);
  m.setPosition(origin || f.S);
  return m;
}

export function headSpeed(u) {
  const a = new THREE.Vector3(), c = new THREE.Vector3();
  spineAt(u - 0.02, a); spineAt(u + 0.02, c);
  return a.distanceTo(c) / 0.04;
}

// samples along the line for building its geometry (param = story position)
export function lineSamples(step = 1 / 240) {
  const out = [];
  for (let u = 1; u <= U_END + 1e-6; u += step) out.push({ u, p: spineAt(u) });
  return out;
}

export function spineOfYear(yr) {
  return new THREE.Vector3(xOfYear(yr), yOfYear(yr), 0);
}

// bar at which the calendar reaches a given year (for the date roll)
export function barOfYear(yr) {
  let lo = 1, hi = 26;
  if (yr <= calendarAt(lo)) return lo;
  if (yr >= calendarAt(hi)) return hi;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (calendarAt(m) < yr) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
