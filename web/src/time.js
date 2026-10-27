// Musical time. Everything in the film is a pure function of b, the position
// in output bars (0 <= b < 42). One bar = 2.1818 s at 110 BPM. The film is a
// circle: bar 42 is bar 0.

export const W = 1080;
export const H = 1920;
export const FPS = 60;
export const N_BARS = 42;
export const FRAMES = 5498;                 // round(42 bars * 60 fps); the audio is exactly this long
export const DURATION = FRAMES / FPS;       // 91.633 s
export const BAR = DURATION / N_BARS;       // 2.18175 s (110.004 BPM: 3 ms over the whole film)
export const BEAT = BAR / 4;

export const barOfFrame = (n) => (((n / FPS) / BAR) % N_BARS + N_BARS) % N_BARS;
export const wrap = (b) => ((b % N_BARS) + N_BARS) % N_BARS;
// signed distance from a to b around the circle, in (-21, 21]
export const circDelta = (b, a) => { let d = wrap(b - a); return d > N_BARS / 2 ? d - N_BARS : d; };

// ---- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

// 0 -> 1 between bars a and b with an easing
export const ramp = (b, a, z, e = ease.inOutCubic) => e(invLerp(a, z, b));
// 0 outside [a, z], 1 inside, with fades of length fi / fo
export const window_ = (b, a, z, fi = 0.25, fo = 0.25) => smoothstep(a - fi, a, b) * (1 - smoothstep(z, z + fo, b));

// ---- deterministic randomness
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- monotone cubic (Fritsch–Carlson) interpolation: C1, never overshoots
export class Pchip {
  constructor(xs, ys) {
    const n = xs.length;
    this.x = Float64Array.from(xs);
    this.y = Float64Array.from(ys);
    const h = new Float64Array(n - 1), d = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    const m = new Float64Array(n);
    if (n === 2) { m[0] = m[1] = d[0]; }
    else {
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else {
          const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
          m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
        }
      }
      const end = (h0, h1, d0, d1) => {
        let v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
        if (Math.sign(v) !== Math.sign(d0)) v = 0;
        else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > Math.abs(3 * d0)) v = 3 * d0;
        return v;
      };
      m[0] = end(h[0], h[1], d[0], d[1]);
      m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
    }
    this.m = m;
  }
  seg(x) {
    const xs = this.x;
    let lo = 0, hi = xs.length - 2;
    if (x <= xs[0]) return 0;
    if (x >= xs[hi + 1]) return hi;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid - 1; }
    return lo;
  }
  at(x) {
    const xs = this.x, n = xs.length;
    if (x <= xs[0]) return this.y[0] + this.m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return this.y[n - 1] + this.m[n - 1] * (x - xs[n - 1]);
    const i = this.seg(x), h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * this.y[i] + (t3 - 2 * t2 + t) * h * this.m[i]
      + (-2 * t3 + 3 * t2) * this.y[i + 1] + (t3 - t2) * h * this.m[i + 1];
  }
}

// A keyframe track over bars that is periodic over the loop: keys are copied
// one loop before and after so the interpolation is C1 across the seam.
export function loopTrack(keys) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  const xs = [], ys = [];
  for (const [b, v] of k) if (b - N_BARS > -6) { xs.push(b - N_BARS); ys.push(v); }
  for (const [b, v] of k) { xs.push(b); ys.push(v); }
  for (const [b, v] of k) if (b + N_BARS < N_BARS + 6) { xs.push(b + N_BARS); ys.push(v); }
  const p = new Pchip(xs, ys);
  return (b) => p.at(b);
}

// ---- audio-derived data (assets/audio/*.json, built by audio/build.py)
export const audio = { features: null, cues: null };

export async function loadAudioData(base = '../assets/audio/') {
  const get = async (f) => { try { const r = await fetch(base + f); return r.ok ? r.json() : null; } catch { return null; } };
  [audio.features, audio.cues] = await Promise.all([get('features.json'), get('cues.json')]);
  return audio;
}

export function feature(name, b) {
  const a = audio.features && audio.features[name];
  if (!a) return 0;
  const x = wrap(b) / N_BARS * a.length;
  const i = Math.floor(x), k = x - i;
  return a[i % a.length] * (1 - k) + a[(i + 1) % a.length] * k;
}

// envelope of detected musical hits: sum of s * attack/decay pulses (bars)
export function hitEnv(b, { min = 0.6, decay = 10, attack = 120, from = -1, to = 99 } = {}) {
  const hits = audio.cues ? audio.cues.hits : [];
  let v = 0;
  for (const h of hits) {
    if (h.s < min || h.bar < from || h.bar > to) continue;
    const d = circDelta(b, h.bar);
    if (d < -0.05 || d > 1) continue;
    v += h.s * (1 - Math.exp(-Math.max(0, d) * attack)) * Math.exp(-Math.max(0, d) * decay);
  }
  return v;
}
