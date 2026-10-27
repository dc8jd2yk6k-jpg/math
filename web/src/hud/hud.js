// The reference's typography, and nothing else: a three-line header (date that
// rolls and scrambles, bold title, one grey caption), small italic labels next
// to objects, and the year axis during the reveal.
import * as THREE from 'three';
import { W, H, PALETTE } from '../config.js';
import { MILESTONES } from '../data.js';
import { FONTS, drawRich, measureRich, richLength } from './text.js';
import { clamp, smoothstep, envelope, hash1 } from '../util.js';
import { calendarAt, storyAt, xOfYear } from '../curve.js';

const CX = W / 2;
const Y_DATE = 228, Y_TITLE = 302, Y_CAPTION = 352;
const BOLD = (s) => FONTS.inter(s, 700);
const CAP = (s) => FONTS.inter(s, 400);

function yearToYMD(yr) {
  const y = Math.floor(yr);
  const d = new Date(Date.UTC(y, 0, 1) + (yr - y) * (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}
const pad = (n) => String(n).padStart(2, '0');
function fmt(yr, kind) {
  const [y, m, d] = yearToYMD(yr);
  return kind === 'y' ? `${y}` : kind === 'm' ? `${y}.${pad(m)}` : `${y}.${pad(m)}.${pad(d)}`;
}
const kindOf = (s) => (s.length === 4 ? 'y' : s.length === 7 ? 'm' : 'd');

// date string for musical position b (before scramble)
export function dateAt(b) {
  if (b >= 29.95 || b <= 0) return '2026.10.27';
  if (b >= 25.05 && b < 29.95) return '2026.10.16';   // ETH: both labs found it on Oct 16
  const u = storyAt(b);
  if (b < 1) {   // rewind: roll back through the calendar at the granularity of the era
    const yr = calendarAt(u);
    return fmt(yr, yr > 2026.6 ? 'd' : yr > 2024.4 ? 'm' : 'y');
  }
  let i = 0;
  for (let k = 0; k < MILESTONES.length; k++) if (MILESTONES[k].bar <= u + 1e-6) i = k;
  const m = MILESTONES[i], n = MILESTONES[i + 1];
  if (!n) return m.head.date;
  const transit = Math.min(0.5, (n.bar - m.bar) * 0.35);
  if (u < n.bar - transit) return m.head.date;
  return fmt(calendarAt(u), kindOf(n.head.date));
}

export class HUD {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.premultiplyAlpha = true;
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
  }

  project(p, cam) {
    const v = p.clone().project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H };
  }

  draw(s) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    this.header(s);
    this.labels(s);
    this.years(s);
    ctx.globalAlpha = 1;
    this.tex.needsUpdate = true;
  }

  header(s) {
    const ctx = this.ctx, b = s.b;
    // date: digits that changed in the last few frames show scrambled glyphs
    const now = dateAt(b), before = dateAt(b - 0.07);
    let last = -1;
    for (let i = 0; i < now.length; i++) if (/\d/.test(now[i]) && now[i] !== before[i]) last = i;
    const shown = last < 0 ? now : now.slice(0, last) + String(Math.floor(hash1(s.frame * 13.7 + last * 7.1) * 10)) + now.slice(last + 1);
    ctx.globalAlpha = s.dateAlpha;
    ctx.font = FONTS.mono(66, 300);
    ctx.fillStyle = '#e9ebef';
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillText(shown, CX, Y_DATE);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';

    // title + caption of the active milestone (or the reveal)
    const items = MILESTONES.map((m, i) => {
      const n = MILESTONES[i + 1];
      const start = m.id === 'eth' ? 25.05 : m.bar;
      const end = m.id === 'eth' ? 29.75 : n.id === 'eth' ? 24.95 : n.bar - 0.1;
      return { b0: start, b1: end, title: m.head.title, caption: m.head.caption };
    });
    items.push({ b0: 30.6, b1: 34.9, title: 'Δt → 0', caption: 'Every result above, on a linear time axis.' });
    for (const it of items) {
      if (b < it.b0 || b > it.b1) continue;
      const out = 1 - smoothstep(it.b1 - 0.12, it.b1, b);
      const kt = smoothstep(it.b0, it.b0 + 0.1, b) * out;
      const kc = smoothstep(it.b0 + 0.08, it.b0 + 0.22, b) * out;
      const rise = (1 - smoothstep(it.b0, it.b0 + 0.14, b)) * 14;
      ctx.globalAlpha = kt;
      ctx.fillStyle = '#ffffff';
      const tw = measureRich(ctx, it.title, BOLD, 46);
      drawRich(ctx, it.title, CX - tw / 2, Y_TITLE + rise, BOLD, 46);
      ctx.globalAlpha = kc;
      ctx.fillStyle = '#8f949d';
      const cw = measureRich(ctx, it.caption, CAP, 26);
      drawRich(ctx, it.caption, CX - cw / 2, Y_CAPTION + rise * 0.6, CAP, 26);
    }
  }

  labels(s) {
    const ctx = this.ctx, b = s.b;
    for (const L of s.labels) {
      const k = envelope(b, L.b0, L.b1, 0.1, 0.12);
      if (k <= 0) continue;
      const p = this.project(L.p, s.camera);
      if (!p) continue;
      const size = L.size || 28;
      const font = L.italic ? FONTS.math : L.mono ? (x) => FONTS.mono(x, 400) : (x) => FONTS.inter(x, 500);
      let text = L.text;
      if (L.type) text = text.slice(0, Math.ceil(richLength(text) * clamp((b - L.b0) / (0.25 * L.type))));
      ctx.globalAlpha = k * 0.92;
      ctx.fillStyle = '#d8dce4';
      const w = measureRich(ctx, L.text, font, size);
      let x = p.x + (L.dx || 0), y = p.y + (L.dy || 0);
      if (L.center) x -= w / 2;
      else if (L.right) x -= w;
      drawRich(ctx, text, x, y + size * 0.35, font, size);
    }
  }

  years(s) {
    const ctx = this.ctx;
    const k = s.revealGain;
    if (k <= 0.001) return;
    ctx.font = FONTS.mono(28, 400);
    ctx.textAlign = 'center';
    for (const yr of [1950, 1970, 1990, 2010, 2026]) {
      const p = this.project(new THREE.Vector3(xOfYear(yr), s.axisY - 6, 0), s.camera);
      if (!p) continue;
      ctx.globalAlpha = k;
      ctx.fillStyle = yr === 2026 ? PALETTE.head : '#9aa0a8';
      ctx.fillText(String(yr), p.x, p.y + 10);
    }
    ctx.textAlign = 'left';
  }
}
