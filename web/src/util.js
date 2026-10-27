// Small deterministic math toolkit.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);

export const ease = {
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inQuart: (t) => t * t * t * t,
  inOutQuart: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// window: 0 before a, rises over [a, a+fi], holds, falls over [b-fo, b]
export function envelope(x, a, b, fi = 0.25, fo = 0.25) {
  if (x <= a || x >= b) return 0;
  return Math.min(fi > 0 ? smoothstep(a, a + fi, x) : 1, fo > 0 ? 1 - smoothstep(b - fo, b, x) : 1);
}

// beat-locked decaying pulse: 1 at each multiple of `period` (in bars), decays with k
export function pulse(b, period = 0.25, k = 10, offset = 0) {
  const p = fract((b - offset) / period) * period;
  return Math.exp(-k * p);
}

// Seeded PRNG (mulberry32)
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i + seed * 57.0) * 2 - 1, hash1(i + 1 + seed * 57.0) * 2 - 1, u);
}

export function fbm1(x, seed = 0) {
  return 0.6 * noise1(x, seed) + 0.3 * noise1(x * 2.13, seed + 1) + 0.1 * noise1(x * 4.37, seed + 2);
}

// Monotone cubic Hermite interpolation (Fritsch–Carlson) — no overshoot
export class Pchip {
  constructor(xs, ys) {
    const n = xs.length;
    this.xs = xs; this.ys = ys;
    const d = new Array(n - 1);
    const h = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    const m = new Array(n);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    this.m = m; this.h = h;
  }
  at(x) {
    const { xs, ys, m, h } = this;
    const n = xs.length;
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid; }
    const t = (x - xs[lo]) / h[lo];
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo]
      + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h[lo] * m[lo + 1];
  }
}

// piecewise keyframes [{b, v, e}] -> eased value; e names the easing into that key
export function keys(list, b) {
  if (b <= list[0].b) return list[0].v;
  for (let i = 1; i < list.length; i++) {
    const k = list[i];
    if (b <= k.b) {
      const p = list[i - 1];
      const t = (b - p.b) / (k.b - p.b);
      const f = ease[k.e || 'inOutCubic'](t);
      return typeof p.v === 'number' ? lerp(p.v, k.v, f) : p.v.map((x, j) => lerp(x, k.v[j], f));
    }
  }
  return list[list.length - 1].v;
}

export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
