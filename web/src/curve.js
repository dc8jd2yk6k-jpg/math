// The line. One curve in world space, in the z = 0 plane:
//   x = linear calendar time (XS units per year from 1950)
//   y = stylized capability: monotone PCHIP through the milestone heights
// It is flat for decades and then a vertical wall in 2026: the hockey stick is
// in the data, because the milestones arrive faster and faster. Everything
// downstream addresses the curve by arc length s (world units).
import * as THREE from 'three';
import { MILESTONES } from './data.js';
import { Pchip, clamp } from './time.js';

export const XS = 10;                        // world units per year
export const Y0 = MILESTONES[0].year;        // Shannon, March 1950
export const Y_END = MILESTONES[MILESTONES.length - 1].year;
const yOfYear = new Pchip(MILESTONES.map((m) => m.year), MILESTONES.map((m) => m.y));

export const xOfYear = (yr) => (yr - 1950) * XS;
export const pointOfYear = (yr, out = new THREE.Vector3()) => out.set(xOfYear(yr), yOfYear.at(clamp(yr, Y0, Y_END)), 0);

// ---- adaptive sampling by arc length
const DS = 0.12;
const xs = [], ys = [], yrs = [], ss = [];
(function sample() {
  let yr = Y0, s = 0, px = xOfYear(yr), py = yOfYear.at(yr);
  xs.push(px); ys.push(py); yrs.push(yr); ss.push(0);
  while (yr < Y_END) {
    const h = 1e-6;
    const dy = (yOfYear.at(Math.min(Y_END, yr + h)) - yOfYear.at(Math.max(Y0, yr - h))) / (2 * h);
    const speed = Math.hypot(XS, dy);
    yr = Math.min(Y_END, yr + Math.min(0.05, DS / speed));
    const x = xOfYear(yr), y = yOfYear.at(yr);
    s += Math.hypot(x - px, y - py);
    xs.push(x); ys.push(y); yrs.push(yr); ss.push(s);
    px = x; py = y;
  }
})();
export const N_SAMPLES = ss.length;
export const S_END = ss[ss.length - 1];
export const SAMPLES = { x: Float32Array.from(xs), y: Float32Array.from(ys), year: Float64Array.from(yrs), s: Float32Array.from(ss) };

function idxOfS(s) {
  let lo = 0, hi = N_SAMPLES - 1;
  if (s <= 0) return 0;
  if (s >= S_END) return N_SAMPLES - 2;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] <= s) lo = m; else hi = m; }
  return lo;
}

export function posAtS(s, out = new THREE.Vector3()) {
  if (s > S_END) {          // beyond today: keep going straight up
    return out.set(xs[N_SAMPLES - 1], ys[N_SAMPLES - 1] + (s - S_END), 0);
  }
  if (s < 0) return out.set(xs[0] + s, ys[0], 0);
  const i = idxOfS(s), t = (s - ss[i]) / Math.max(1e-9, ss[i + 1] - ss[i]);
  return out.set(xs[i] + (xs[i + 1] - xs[i]) * t, ys[i] + (ys[i + 1] - ys[i]) * t, 0);
}

export function yearAtS(s) {
  if (s <= 0) return Y0;
  if (s >= S_END) return Y_END;
  const i = idxOfS(s), t = (s - ss[i]) / Math.max(1e-9, ss[i + 1] - ss[i]);
  return yrs[i] + (yrs[i + 1] - yrs[i]) * t;
}

export function sOfYear(yr) {
  if (yr <= Y0) return 0;
  if (yr >= Y_END) return S_END;
  let lo = 0, hi = N_SAMPLES - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (yrs[m] <= yr) lo = m; else hi = m; }
  const t = (yr - yrs[lo]) / Math.max(1e-12, yrs[lo + 1] - yrs[lo]);
  return ss[lo] + (ss[lo + 1] - ss[lo]) * t;
}

// unit tangent, averaged over +-w world units so it is smooth enough for cameras
export function tanAtS(s, w = 0.6, out = new THREE.Vector3()) {
  const a = posAtS(s - w, new THREE.Vector3()), b = posAtS(s + w, new THREE.Vector3());
  return out.subVectors(b, a).normalize();
}

// arc-length position of each milestone
export const S_OF = Object.fromEntries(MILESTONES.map((m) => [m.id, sOfYear(m.year)]));
export const P_OF = Object.fromEntries(MILESTONES.map((m) => [m.id, posAtS(S_OF[m.id])]));

// Local frame at a milestone: T along the line, N in the chart plane (to the
// left of travel), Z out of the chart plane. Pieces are built in this frame.
export function frameAtS(s) {
  const T = tanAtS(s, 2.0);
  const Z = new THREE.Vector3(0, 0, 1);
  const N = new THREE.Vector3().crossVectors(Z, T).normalize();
  return { O: posAtS(s), T, N, Z };
}

export function slopeDegAtS(s) {
  const t = tanAtS(s, 2.0);
  return Math.atan2(t.y, t.x) * 180 / Math.PI;
}
