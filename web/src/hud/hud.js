// Broadcast-telemetry HUD (F1 graphics language: sector bars, timing tower,
// gaps, purple = fastest). Drawn with Canvas2D every frame, composited in the
// post shader with its own glitch/chromatic split.
import * as THREE from 'three';
import { W, H, BAR, TEAM, PALETTE } from '../config.js';
import { MILESTONES, BY_ID, fmtGap, fmtDate } from '../data.js';
import { FONTS, drawRich, measureRich, richLength } from './text.js';
import { clamp, smoothstep, ease, envelope, fract, lerp, invLerp, hash1 } from '../util.js';
import { calendarAt, spineOfYear, MILESTONE_YEARS } from '../curve.js';

const M = 64;            // side margin
const TOP = 52;
const PURPLE = PALETTE.purple, GREEN = PALETTE.green, YELLOW = PALETTE.yellow;

function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

function yearToDate(yr) {
  const y = Math.floor(yr);
  const start = Date.UTC(y, 0, 1), end = Date.UTC(y + 1, 0, 1);
  const d = new Date(start + (yr - y) * (end - start));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function compressionLabel(yearsPerSec) {
  const days = yearsPerSec * 365.25;
  if (yearsPerSec >= 1.5) return `1 s ≈ ${yearsPerSec.toFixed(1)} YEARS`;
  if (days >= 45) return `1 s ≈ ${(days / 30.44).toFixed(1)} MONTHS`;
  if (days >= 1.5) return `1 s ≈ ${days.toFixed(1)} DAYS`;
  return `1 s ≈ ${(days * 24).toFixed(1)} HOURS`;
}

// fastest-so-far flags (purple) for the timing tower
(function markFastest() {
  let best = Infinity;
  for (const m of MILESTONES) {
    if (m.gapDays === null) continue;
    m.fastest = m.gapDays < best;
    if (m.fastest) best = m.gapDays;
  }
})();

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

  // project a world point to HUD pixels; returns null if behind the camera
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
    const b = s.b;
    const a = s.hudAlpha;
    if (a <= 0.001) { this.tex.needsUpdate = true; return; }
    ctx.globalAlpha = 1;

    this.callouts(s);
    this.brand(s);
    this.sectors(s);
    this.dateTicker(s);
    this.tower(s);
    this.rateChart(s);
    this.cards(s);
    this.centerTitles(s);
    this.revealLabels(s);
    this.reticle(s);
    this.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- brand
  brand(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.boot;
    if (k <= 0) return;
    ctx.globalAlpha = k * s.chrome;
    ctx.fillStyle = '#fff';
    drawRich(ctx, 'Δt → 0', M, TOP + 24, FONTS.black, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(M + 128, TOP - 2, 1.5, 32);
    ctx.font = FONTS.mono(12);
    ctx.fillStyle = 'rgba(220,230,255,0.75)';
    ctx.fillText('AI × MATHEMATICS', M + 142, TOP + 9);
    ctx.fillStyle = 'rgba(220,230,255,0.45)';
    ctx.fillText('ONE TAKE · LINEAR TIME', M + 142, TOP + 26);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- sector bar
  sectors(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.boot * s.chrome;
    if (k <= 0) return;
    const segs = [
      { name: 'S1 · BOARD GAMES', b0: 0, b1: 10 },
      { name: 'S2 · OLYMPIAD', b0: 10, b1: 16 },
      { name: 'S3 · FRONTIER', b0: 16, b1: 26 },
    ];
    const total = 690, gap = 8, sw = (total - gap * 2) / 3;
    const x0 = W / 2 - total / 2, y = TOP + 18;
    ctx.globalAlpha = k;
    segs.forEach((g, i) => {
      const x = x0 + i * (sw + gap);
      const p = clamp((b - g.b0) / (g.b1 - g.b0));
      const done = b >= g.b1;
      const allPurple = b >= 26;
      let col = done ? GREEN : YELLOW;
      if (i === 2 && done) col = PURPLE;
      if (allPurple) col = PURPLE;
      const flash = done ? Math.exp(-(b - g.b1) * 6) : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, sw, 5);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, sw * (b < g.b0 ? 0 : p), 5);
      if (flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(x, y - 2, sw, 9); }
      ctx.font = FONTS.mono(12);
      const active = b >= g.b0 && b < g.b1;
      ctx.fillStyle = active ? '#fff' : done ? rgba(col, 0.9) : 'rgba(255,255,255,0.4)';
      ctx.fillText(g.name, x, y - 10);
      if (active) {
        // beat tick
        const beat = Math.exp(-fract(b * 4) * 8);
        ctx.fillStyle = rgba(col, 0.4 + 0.6 * beat);
        ctx.fillRect(x + sw * p - 2, y - 4, 4, 13);
      }
    });
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- date ticker
  dateTicker(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.boot * s.chrome;
    if (k <= 0) return;
    const xr = W - M;
    ctx.globalAlpha = k;
    ctx.textAlign = 'right';
    ctx.font = FONTS.mono(12);
    ctx.fillStyle = 'rgba(220,230,255,0.55)';
    let tag = 'CALENDAR';
    let date;
    const replay = b >= 25.0 && b < 28.0;
    if (replay) {
      tag = '◀◀ REPLAY';
      date = BY_ID.eth.found;
    } else if (b >= 26) {
      date = BY_ID.eth.date;
    } else {
      date = yearToDate(calendarAt(b));
    }
    if (replay) {
      ctx.fillStyle = rgba(PALETTE.red, 0.6 + 0.4 * Math.round(fract(b * 2)));
    }
    ctx.fillText(tag, xr, TOP + 2);
    // velocity blur on the digits when calendar is racing
    const ypsNow = s.yearsPerSec;
    const str = fmtDate(date);
    ctx.font = FONTS.monob(44);
    const blur = clamp(Math.log10(1 + ypsNow * 365) / 4);
    if (!replay && b < 26 && blur > 0.2) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 * blur})`;
      for (const dy of [-10, -5, 5, 10]) ctx.fillText(str, xr, TOP + 46 + dy * blur);
    }
    ctx.fillStyle = replay ? '#ffdddd' : '#ffffff';
    ctx.fillText(str, xr, TOP + 46);
    // compression readout + last gap
    ctx.font = FONTS.mono(14);
    let line2 = b < 26 ? compressionLabel(ypsNow) : 'TODAY';
    if (replay) line2 = 'DISCOVERY DATE · BOTH LABS';
    ctx.fillStyle = 'rgba(220,230,255,0.7)';
    ctx.fillText(line2, xr, TOP + 70);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- timing tower
  tower(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.boot * s.chrome * s.towerAlpha;
    if (k <= 0) return;
    const xr = W - M, wdt = 330, x = xr - wdt;
    let y = 196;
    ctx.globalAlpha = k;
    ctx.font = FONTS.mono(11);
    ctx.fillStyle = 'rgba(220,230,255,0.5)';
    ctx.fillText('LANDMARK', x, y);
    ctx.textAlign = 'right';
    ctx.fillText('Δt  (GAP)', xr, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y + 7, wdt, 1);
    y += 14;
    const rowH = 29;
    const list = MILESTONES.slice(1);
    list.forEach((m, i) => {
      const t = b - m.bar;
      if (t < 0) return;
      const slide = ease.outExpo(clamp(t / 0.12));
      const ry = y + i * rowH;
      const rx = x + (1 - slide) * 80;
      ctx.globalAlpha = k * slide;
      const current = (i === list.length - 1 && t >= 0) || (list[i + 1] && b < list[i + 1].bar);
      const flash = Math.exp(-t * 7);
      if (current) { ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.25 * flash})`; ctx.fillRect(rx, ry, wdt, rowH - 3); }
      // position box
      ctx.fillStyle = current ? '#fff' : 'rgba(255,255,255,0.14)';
      ctx.fillRect(rx, ry, 30, rowH - 3);
      ctx.font = FONTS.monob(14);
      ctx.fillStyle = current ? '#000' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1).padStart(2, '0'), rx + 15, ry + 18);
      ctx.textAlign = 'left';
      // team stripe(s)
      const tc = TEAM[m.team].color;
      if (m.team2) {
        ctx.fillStyle = tc; ctx.fillRect(rx + 34, ry + 2, 4, (rowH - 7) / 2);
        ctx.fillStyle = TEAM[m.team2].color; ctx.fillRect(rx + 34, ry + 2 + (rowH - 7) / 2, 4, (rowH - 7) / 2);
      } else { ctx.fillStyle = tc; ctx.fillRect(rx + 34, ry + 2, 4, rowH - 7); }
      ctx.font = FONTS.bold(17);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.short, rx + 46, ry + 19);
      // gap
      ctx.textAlign = 'right';
      ctx.font = FONTS.monob(15);
      const gap = m.id === 'eth' ? 'DEAD HEAT' : fmtGap(m.gapDays);
      ctx.fillStyle = m.fastest ? PURPLE : '#ffe9a8';
      ctx.fillText(gap, rx + wdt - 8, ry + 19);
      ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- rate chart (log)
  rateChart(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.boot * s.chrome * s.towerAlpha;
    if (k <= 0 || b < 2) return;
    const xr = W - M, wd = 330, ht = 112, x = xr - wd, y1 = H - 58;
    ctx.globalAlpha = k;
    ctx.font = FONTS.mono(11);
    ctx.fillStyle = 'rgba(220,230,255,0.5)';
    ctx.fillText('BREAKTHROUGHS PER YEAR · LOG', x, y1 - ht - 12);
    // gridlines: 0.01 .. 100
    const lo = -2, hi = 2;
    const Y = (v) => y1 - (clamp((Math.log10(v) - lo) / (hi - lo))) * ht;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let e = lo; e <= hi; e++) {
      ctx.fillRect(x, Y(10 ** e), wd, 1);
      ctx.font = FONTS.mono(9); ctx.fillStyle = 'rgba(220,230,255,0.4)';
      ctx.fillText(e >= 0 ? String(10 ** e) : `1/${10 ** -e}`, x - 28 + (e >= 0 ? 6 : 0), Y(10 ** e) + 3);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
    }
    const list = MILESTONES.slice(1);
    const bw = wd / list.length;
    list.forEach((m, i) => {
      const t = b - m.bar;
      if (t < 0) return;
      const g = ease.outCubic(clamp(t / 0.25));
      const rate = m.id === 'eth' ? 1e9 : 365.25 / Math.max(m.gapDays, 0.5);
      const yTop = m.id === 'eth' ? y1 - ht - 30 : Y(rate);
      const h = (y1 - yTop) * g;
      ctx.fillStyle = m.fastest ? PURPLE : 'rgba(255,233,168,0.9)';
      if (m.id === 'eth') ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + i * bw + 3, y1 - h, bw - 6, h);
      if (m.id === 'eth' && g > 0.9) {
        ctx.font = FONTS.monob(14); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('∞', x + i * bw + bw / 2, y1 - ht - 34);
        ctx.textAlign = 'left';
      }
    });
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y1, wd, 1);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- milestone cards
  cards(s) {
    const b = s.b;
    for (let i = 0; i < MILESTONES.length; i++) {
      const m = MILESTONES[i];
      const next = MILESTONES[i + 1];
      const start = m.bar + (m.prelude ? 0.15 : 0.02);
      let end = next ? next.bar - 0.04 : 30;
      if (m.id === 'deepblue') end = 4.75;
      if (m.id === 'alphago') end = 9.7;
      if (m.id === 'imo24') end = 13.92;
      if (m.id === 'eth') end = 29.7;
      if (m.id === 'shannon') end = 1.9;
      if (b < start || b > end) continue;
      this.card(m, b - start, end - b, s, i);
    }
  }

  card(m, t, left, s, idx) {
    const ctx = this.ctx;
    const c = m.card;
    const outK = clamp(left / 0.1);          // exit wipe
    const x = M, base = H - 70;
    const tc = TEAM[m.team].color;
    const short = m.bar >= 22 && m.bar < 26;   // 1-bar cards are faster
    const sp = short ? 1.6 : 1;
    // geometry (bottom-up)
    let y = base;
    const lines = [];
    if (c.status) { lines.push({ kind: 'status', y }); y -= 34; }
    if (c.constraints) { lines.push({ kind: 'constraints', y }); y -= 44; }
    if (c.chips) { lines.push({ kind: 'chips', y }); y -= 46; }
    if (c.formula) { lines.push({ kind: 'formula', y }); y -= 48; }
    lines.push({ kind: 'sub', y }); y -= 40;
    const titleSize = m.prelude ? 40 : m.id === 'eth' ? 64 : 58;
    lines.push({ kind: 'title', y }); y -= titleSize + 8;
    lines.push({ kind: 'kicker', y });

    ctx.save();
    const wipeIn = ease.outExpo(clamp(t * sp / 0.16));
    const clipW = 1500 * wipeIn * outK;
    ctx.beginPath(); ctx.rect(x - 20, y - 40, clipW, base - y + 80); ctx.clip();

    // backing gradient for legibility
    const grd = ctx.createLinearGradient(0, y - 40, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.35, 'rgba(0,4,10,0.35)'); grd.addColorStop(1, 'rgba(0,4,10,0.55)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y - 40, 1400, H - y + 40);

    for (const L of lines) {
      if (L.kind === 'kicker') {
        const k = clamp(t * sp / 0.08);
        ctx.globalAlpha = k;
        ctx.fillStyle = tc; ctx.fillRect(x, L.y - 18, 6, 24);
        if (m.team2) { ctx.fillStyle = TEAM[m.team2].color; ctx.fillRect(x, L.y - 6, 6, 12); }
        ctx.font = FONTS.bold(19);
        ctx.fillStyle = '#fff';
        const team = m.team2 ? `${TEAM[m.team].name}  ×  ${TEAM[m.team2].name}` : TEAM[m.team].name;
        const kick = c.kicker || team;
        drawRich(ctx, kick, x + 18, L.y, FONTS.bold, 19, { tracking: 3 });
        if (!c.kicker) {
          const kw = measureRich(ctx, kick, FONTS.bold, 19, 3);
          ctx.font = FONTS.mono(18);
          ctx.fillStyle = 'rgba(220,230,255,0.75)';
          const dl = m.found ? `FOUND ${fmtDate(m.found)}` : fmtDate(m.date);
          ctx.fillText(`${dl}   №${String(idx).padStart(2, '0')}`, x + 18 + kw + 26, L.y);
        }
      } else if (L.kind === 'title') {
        ctx.globalAlpha = 1;
        // glitchy reveal: slices offset for the first few frames
        const g = clamp(1 - t * sp / 0.12);
        ctx.fillStyle = '#fff';
        ctx.font = FONTS.black(titleSize);
        if (g > 0.01) {
          for (let k2 = 0; k2 < 3; k2++) {
            const off = (hash1(Math.floor(t * 60) + k2 * 13) - 0.5) * 40 * g;
            ctx.fillStyle = k2 === 0 ? `rgba(255,60,80,${0.7 * g})` : k2 === 1 ? `rgba(60,200,255,${0.7 * g})` : '#fff';
            drawRich(ctx, c.title, x + off, L.y, FONTS.black, titleSize, { tracking: 1 });
          }
        } else drawRich(ctx, c.title, x, L.y, FONTS.black, titleSize, { tracking: 1 });
      } else if (L.kind === 'sub') {
        const n = richLength(c.sub);
        const chars = clamp((t * sp - 0.1) / 0.3) * n;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(225,235,255,0.92)';
        drawRich(ctx, c.sub, x, L.y, FONTS.reg, 25, { maxChars: chars });
      } else if (L.kind === 'formula') {
        const k = clamp((t * sp - 0.18) / 0.15);
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffffff';
        drawRich(ctx, c.formula, x, L.y, FONTS.math, 36);
      } else if (L.kind === 'chips') {
        let cx = x;
        c.chips.forEach((chip, j) => {
          const k = ease.outBack(clamp((t * sp - 0.2 - j * 0.06) / 0.12));
          if (k <= 0) return;
          ctx.globalAlpha = clamp(k);
          const wch = measureRich(ctx, chip, FONTS.monob, 16) + 24;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.5, L.y - 25.5, wch, 34);
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(cx, L.y - 26, wch, 34);
          ctx.fillStyle = '#fff';
          drawRich(ctx, chip, cx + 12, L.y - 3, FONTS.monob, 16);
          cx += wch + 12;
        });
      } else if (L.kind === 'constraints') {
        let cx = x;
        c.constraints.forEach((txt, j) => {
          const k = clamp((t * sp - 0.45 - j * 0.12) / 0.1);
          if (k <= 0) return;
          const blink = 0.75 + 0.25 * Math.round(fract(s.b * 2));
          ctx.globalAlpha = k * blink;
          ctx.font = FONTS.monob(15);
          const label = `⚠ CONSTRAINT · ${txt}`;
          const wch = ctx.measureText(label).width + 24;
          ctx.fillStyle = 'rgba(255,50,50,0.16)'; ctx.fillRect(cx, L.y - 27, wch, 36);
          ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, L.y - 26, wch - 2, 34);
          ctx.fillStyle = '#ff8a8a';
          ctx.fillText(label, cx + 12, L.y - 3);
          cx += wch + 12;
        });
      } else if (L.kind === 'status') {
        const k = clamp((t * sp - 0.3) / 0.12);
        ctx.globalAlpha = k;
        const blink = Math.round(fract(s.b * 4)) ? 1 : 0.25;
        ctx.fillStyle = rgba('#ffb84a', blink);
        ctx.beginPath(); ctx.arc(x + 6, L.y - 5, 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = FONTS.mono(15);
        ctx.fillStyle = 'rgba(255,200,120,0.95)';
        ctx.fillText(`STATUS · ${c.status}`, x + 20, L.y);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- center titles
  centerTitles(s) {
    const ctx = this.ctx, b = s.b;
    const show = (txt, b0, b1, size, color, y, opts = {}) => {
      const k = envelope(b, b0, b1, opts.fi ?? 0.12, opts.fo ?? 0.2);
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.fillStyle = color;
      const font = opts.font || FONTS.black;
      const w = measureRich(ctx, txt, font, size, opts.tracking || 0);
      const scale = 1 + (opts.zoom || 0) * (b - b0);
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.scale(scale, scale);
      drawRich(ctx, txt, -w / 2, 0, font, size, { tracking: opts.tracking || 0 });
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    show('SECTOR 2', 9.9, 10.9, 22, YELLOW, H / 2 - 110, { font: FONTS.monob, tracking: 8 });
    show('OLYMPIAD', 9.95, 10.9, 92, '#ffffff', H / 2 - 30, { tracking: 6, zoom: 0.03 });
    show('SECTOR 3', 15.95, 16.95, 22, PURPLE, H / 2 - 110, { font: FONTS.monob, tracking: 8 });
    show('FRONTIER RESEARCH', 16.0, 16.95, 92, '#ffffff', H / 2 - 30, { tracking: 6, zoom: 0.03 });
    show('MONTHS → WEEKS → DAYS', 21.0, 21.9, 24, 'rgba(255,255,255,0.85)', 168, { font: FONTS.monob, tracking: 8 });

    // ETH: the exponential falls
    if (b >= 25.0 && b < 30) {
      const k1 = envelope(b, 25.0, 26.0, 0.1, 0.02);
      if (k1 > 0) {
        ctx.globalAlpha = k1;
        ctx.font = FONTS.monob(26); ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
        ctx.fillText('TWO LABS · ONE CONJECTURE', W / 2, 170);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.textAlign = 'left';
      }
      const k = envelope(b, 26.0, 29.6, 0.03, 0.3);
      if (k > 0) {
        ctx.globalAlpha = k;
        const size = 300;
        ctx.font = FONTS.black(size);
        const w = ctx.measureText('ETH').width;
        const cx = W / 2, cy = H / 2 + 40;
        const punch = 1 + 0.08 * Math.exp(-(b - 26) * 8);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(punch, punch);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center';
        ctx.fillText('ETH', 0, 0);
        // strike-through
        const sk = ease.outExpo(clamp((b - 26.25) / 0.25));
        ctx.fillStyle = PALETTE.red;
        ctx.fillRect(-w / 2 - 30, -size * 0.33, (w + 60) * sk, 18);
        ctx.font = FONTS.monob(22);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('EXPONENTIAL TIME HYPOTHESIS · 1999', 0, -size * 0.8);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        const k3 = clamp((b - 26.5) / 0.2);
        ctx.globalAlpha = k * k3;
        ctx.font = FONTS.math(54);
        ctx.fillStyle = '#fff';
        ctx.fillText('', 0, 0);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }
    // REVEAL title
    const kr = envelope(b, 30.4, 35.6, 0.5, 0.5);
    if (kr > 0) {
      ctx.globalAlpha = kr;
      ctx.fillStyle = '#fff';
      const txt = 'Δt → 0';
      ctx.font = FONTS.black(132);
      ctx.fillText(txt, M, 250);
      ctx.font = FONTS.reg(28);
      ctx.fillStyle = 'rgba(225,235,255,0.9)';
      const k2 = clamp((b - 31.0) / 0.5);
      ctx.globalAlpha = kr * k2;
      ctx.fillText('Every landmark above, plotted on a linear time axis.', M + 6, 300);
      ctx.fillText('Decades, then years, then days apart.', M + 6, 338);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- reveal: chart labels
  revealLabels(s) {
    const ctx = this.ctx, b = s.b, cam = s.camera;
    const k = s.revealLabels;
    if (k <= 0.001) return;
    const list = MILESTONES.slice(1);
    const pts = list.map((m, i) => this.project(spineOfYear(MILESTONE_YEARS[i + 1]), cam));
    // results from 2024 on sit on the near-vertical wall: lay them out in a
    // column to its right, pushed apart so they never overlap
    const wallX = Math.max(...pts.filter(Boolean).map((p) => p.x));
    const col = [];
    list.forEach((m, i) => { if (i >= 2 && pts[i]) col.push({ i, y: pts[i].y }); });
    col.sort((a, c) => c.y - a.y);                 // bottom (oldest) first
    const GAP = 27;
    for (let j = 1; j < col.length; j++) col[j].y = Math.min(col[j].y, col[j - 1].y - GAP);
    const ly = new Map(col.map((c) => [c.i, c.y]));
    list.forEach((m, i) => {
      const p = pts[i];
      if (!p) return;
      const kk = k * clamp((b - 30.6 - i * 0.12) / 0.3);
      if (kk <= 0) return;
      ctx.globalAlpha = kk;
      const tc = TEAM[m.team].color;
      const inCol = ly.has(i);
      const lx = inCol ? wallX + 60 : p.x - 14;
      const yy = inCol ? ly.get(i) : p.y - 54;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      if (inCol) { ctx.lineTo(wallX + 30, yy - 5); ctx.lineTo(lx - 6, yy - 5); }
      else ctx.lineTo(lx + 4, yy + 6);
      ctx.stroke();
      ctx.fillStyle = tc; ctx.fillRect(lx, yy - 15, 4, 18);
      if (m.team2) { ctx.fillStyle = TEAM[m.team2].color; ctx.fillRect(lx, yy - 6, 4, 9); }
      ctx.font = FONTS.monob(13);
      ctx.fillStyle = 'rgba(220,230,255,0.8)';
      const dl = m.id === 'eth' ? '2026.10.16' : fmtDate(m.date);
      ctx.fillText(dl, lx + 10, yy - 1);
      ctx.font = FONTS.bold(17);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.short, lx + 104, yy);
      const nameW = ctx.measureText(m.short).width;
      ctx.font = FONTS.mono(12);
      ctx.fillStyle = m.fastest ? PURPLE : 'rgba(255,233,168,0.85)';
      const gap = m.id === 'eth' ? 'Δt = 0' : fmtGap(m.gapDays);
      ctx.fillText(gap, lx + 112 + nameW, yy);
    });
    // axis captions
    ctx.globalAlpha = k * 0.8;
    const o = this.project(spineOfYear(1950.2).setY(-16), cam);
    const e = this.project(spineOfYear(2026.9).setY(-16), cam);
    if (o && e) {
      ctx.font = FONTS.mono(13);
      ctx.fillStyle = 'rgba(200,220,255,0.8)';
      ctx.fillText('1950', o.x - 16, o.y + 26);
      ctx.fillText('LINEAR TIME →', (o.x + e.x) / 2 - 50, o.y + 26);
      ctx.fillText('NOW', e.x - 12, e.y + 26);
      ctx.save(); ctx.translate(o.x - 30, o.y - 120); ctx.rotate(-Math.PI / 2);
      ctx.fillText('LANDMARK RESULTS →', 0, 0); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- 3D-anchored callouts
  callouts(s) {
    const ctx = this.ctx, b = s.b, cam = s.camera;
    for (const c of s.callouts || []) {
      const k = envelope(b, c.b0, c.b1, 0.12, 0.15);
      if (k <= 0) continue;
      const p = this.project(c.p, cam);
      if (!p) continue;
      ctx.globalAlpha = k * (c.alpha ?? 1);
      const dx = c.dx ?? 60, dy = c.dy ?? -60;
      const lx = p.x + dx, ly = p.y + dy;
      ctx.strokeStyle = c.color || 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lx, ly); ctx.lineTo(lx + (dx >= 0 ? 18 : -18), ly); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = dx >= 0 ? 'left' : 'right';
      const tx = lx + (dx >= 0 ? 24 : -24);
      const fs = c.size || 21;
      ctx.font = FONTS.monob(fs);
      const n = c.text.length * clamp((b - c.b0) / 0.2);
      const txt = c.text.slice(0, Math.floor(n));
      const tw = Math.max(ctx.measureText(c.text).width, c.sub ? (ctx.font = FONTS.mono(15), ctx.measureText(c.sub).width) : 0);
      ctx.fillStyle = 'rgba(0,4,12,0.55)';
      ctx.fillRect(dx >= 0 ? tx - 8 : tx - tw - 8, ly - fs + 2, tw + 16, fs + (c.sub ? 30 : 12));
      ctx.font = FONTS.monob(fs);
      ctx.fillStyle = c.color || '#fff';
      ctx.fillText(txt, tx, ly + 5);
      if (c.sub) {
        ctx.font = FONTS.mono(15);
        ctx.fillStyle = 'rgba(220,230,255,0.8)';
        ctx.fillText(c.sub, tx, ly + 27);
      }
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- head reticle
  reticle(s) {
    const ctx = this.ctx, b = s.b;
    const k = s.reticle;
    if (k <= 0.01) return;
    const p = this.project(s.headPos, s.camera);
    if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
    const r = 30 + 6 * Math.exp(-fract(b) * 6);
    ctx.globalAlpha = k * 0.85;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    const L = 9;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(p.x + sx * r, p.y + sy * (r - L)); ctx.lineTo(p.x + sx * r, p.y + sy * r); ctx.lineTo(p.x + sx * (r - L), p.y + sy * r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
