// The overlay, drawn with Canvas2D each frame and composited in post:
// a three-line header (rolling date, typed title, caption), labels pinned to
// 3D points, the reveal's time axis and the end credit.
import * as THREE from 'three';
import { F } from './fonts.js';
import { hash1 } from '../time.js';

// tiny markup: x^{2} superscript, p_{c} subscript
function parseRich(text) {
  const out = [];
  const re = /([\^_])\{([^}]*)\}/g;
  let i = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > i) out.push({ t: text.slice(i, m.index), k: 0 });
    out.push({ t: m[2], k: m[1] === '^' ? 1 : -1 });
    i = re.lastIndex;
  }
  if (i < text.length) out.push({ t: text.slice(i), k: 0 });
  return out;
}

export class HUD {
  // The texture is updated in place: only the rectangle that changed since
  // the last frame is read back from the canvas and uploaded (a full 1080x1920
  // upload costs ~85 ms in software GL; the header alone is a fraction of that).
  constructor(w, h, renderer) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.s = w / 1080;
    this.renderer = renderer;
    this.tex = new THREE.DataTexture(new Uint8Array(w * h * 4), w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.flipY = false;
    this.tex.needsUpdate = true;
    renderer.initTexture(this.tex);
    this.dirty = null;
    this.prevDirty = null;
    this._v = new THREE.Vector3();
  }

  mark(x0, y0, x1, y1) {
    const d = this.dirty;
    if (!d) this.dirty = [x0, y0, x1, y1];
    else { d[0] = Math.min(d[0], x0); d[1] = Math.min(d[1], y0); d[2] = Math.max(d[2], x1); d[3] = Math.max(d[3], y1); }
  }

  upload() {
    const a = this.dirty, b = this.prevDirty;
    this.prevDirty = a;
    this.dirty = null;
    const u = a && b ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : a || b;
    if (!u) return;
    const W = this.canvas.width, H = this.canvas.height;
    const x0 = Math.max(0, Math.floor(u[0]) - 6), y0 = Math.max(0, Math.floor(u[1]) - 6);
    const x1 = Math.min(W, Math.ceil(u[2]) + 6), y1 = Math.min(H, Math.ceil(u[3]) + 6);
    if (x1 <= x0 || y1 <= y0) return;
    const img = this.ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const r = this.renderer, gl = r.getContext();
    const glTex = r.properties.get(this.tex).__webglTexture;
    r.state.bindTexture(gl.TEXTURE_2D, glTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  }

  // draw rich text; returns width. align: 'left' | 'center' | 'right'
  rich(text, x, y, fontFn, px, align = 'left', fill = '#fff', maxChars = Infinity) {
    const ctx = this.ctx;
    const runs = parseRich(text);
    let left = maxChars;
    const parts = [];
    for (const r of runs) {
      if (left <= 0) break;
      const t = [...r.t].slice(0, left).join('');
      left -= [...r.t].length;
      const size = r.k ? px * 0.68 : px;
      ctx.font = fontFn(size);
      parts.push({ t, k: r.k, size, w: ctx.measureText(t).width });
    }
    const total = parts.reduce((a, p) => a + p.w, 0);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    this.mark(cx - 4, y - px * 1.25, cx + total + 4, y + px * 0.45);
    ctx.fillStyle = fill;
    ctx.textAlign = 'left';
    for (const p of parts) {
      ctx.font = fontFn(p.size);
      ctx.fillText(p.t, cx, y - (p.k > 0 ? px * 0.38 : p.k < 0 ? -px * 0.18 : 0));
      cx += p.w;
    }
    return total;
  }

  project(p, camera) {
    const v = this._v.copy(p).applyMatrix4(camera.matrixWorldInverse);
    if (v.z > -camera.near) return null;
    v.applyMatrix4(camera.projectionMatrix);
    return { x: (v.x * 0.5 + 0.5) * this.canvas.width, y: (-v.y * 0.5 + 0.5) * this.canvas.height, depth: -this._v.z };
  }

  draw(st) {
    const { ctx, s } = this;
    const W = this.canvas.width;
    if (this.prevDirty) { const d = this.prevDirty; ctx.clearRect(d[0] - 8, d[1] - 8, d[2] - d[0] + 16, d[3] - d[1] + 16); }
    ctx.textBaseline = 'alphabetic';

    // ---- labels pinned in 3D
    for (const L of st.labels) {
      if (L.alpha <= 0.003) continue;
      const q = L.screen ? { x: L.screen[0] * W, y: L.screen[1] * this.canvas.height } : this.project(L.p, st.camera);
      if (!q) continue;
      ctx.globalAlpha = Math.min(1, L.alpha);
      ctx.letterSpacing = '0px';
      const px = (L.size || 22) * s;
      const fn = F[L.style || 'label'];
      if (L.box) {   // a little ■ or ✓ marker before the text
        ctx.fillStyle = L.color || '#fff';
      }
      this.rich(L.text, q.x + (L.dx || 0) * s, q.y + (L.dy || 0) * s, fn, px, L.align || 'left', L.color || 'rgba(240,242,248,1)', L.chars ?? Infinity);
    }
    ctx.globalAlpha = 1;

    // ---- reveal axis
    if (st.axis && st.axis.alpha > 0.003) {
      const A = st.axis;
      const a0 = this.project(A.from, st.camera), a1 = this.project(A.to, st.camera);
      if (a0 && a1) {
        ctx.globalAlpha = A.alpha * 0.55;
        ctx.strokeStyle = 'rgba(230,232,240,1)';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
        this.mark(Math.min(a0.x, a1.x) - 3, Math.min(a0.y, a1.y) - 3, Math.max(a0.x, a1.x) + 3, Math.max(a0.y, a1.y) + 3);
      }
      for (const t of A.ticks) {
        const q = this.project(t.p, st.camera);
        if (!q) continue;
        ctx.globalAlpha = A.alpha;
        ctx.letterSpacing = `${1 * s}px`;
        this.rich(t.text, q.x, q.y + 34 * s, F.mono, 24 * s, 'center', t.red ? '#ff4a3d' : 'rgba(220,222,232,0.9)');
        ctx.fillStyle = 'rgba(230,232,240,0.8)';
        ctx.fillRect(q.x - 0.75 * s, q.y - 5 * s, 1.5 * s, 10 * s);
        this.mark(q.x - 4, q.y - 8 * s, q.x + 4, q.y + 8 * s);
      }
      ctx.globalAlpha = 1;
    }

    // ---- header
    const H = st.header;
    if (H && H.world > 0.003) {     // a soft shade behind the header over the daylight sky
      const g = ctx.createLinearGradient(0, 0, 0, 600 * s);
      g.addColorStop(0, `rgba(10,14,22,${0.55 * H.world})`);
      g.addColorStop(0.6, `rgba(10,14,22,${0.38 * H.world})`);
      g.addColorStop(1, 'rgba(10,14,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 600 * s);
      this.mark(0, 0, W, 600 * s);
    }
    if (H && H.alpha > 0.003) {
      ctx.globalAlpha = H.alpha;
      // date: changed digits scramble while they roll
      ctx.letterSpacing = `${5 * s}px`;
      const px = 86 * s;
      ctx.font = F.date(px);
      const text = H.date;
      const chars = [...text];
      const cw = ctx.measureText('0').width + 5 * s;
      let x = W / 2 - (chars.length * cw - 5 * s) / 2;
      for (let i = 0; i < chars.length; i++) {
        let ch = chars[i];
        const sc = H.scramble && H.scramble[i];
        ctx.fillStyle = 'rgba(236,238,245,0.96)';
        if (sc) {
          const r = hash1(st.frame * 13.7 + i * 91.1);
          ch = r < 0.18 ? '▮' : String(Math.floor(r * 10));
          ctx.fillStyle = 'rgba(236,238,245,0.72)';
        }
        ctx.letterSpacing = '0px';
        ctx.font = ch === '▮' ? F.mathUp(px * 0.8) : F.date(px);
        ctx.fillText(ch, x, 275 * s);
        this.mark(x - 4, 275 * s - px, x + cw + 4, 275 * s + px * 0.3);
        x += cw;
      }
      // title, typed on
      if (H.title && H.titleChars > 0) {
        ctx.letterSpacing = `${1.5 * s}px`;
        const w = this.rich(H.title, W / 2, 378 * s, F.title, 54 * s, 'center', 'rgba(244,245,250,0.98)', H.titleChars);
        if (H.cursor) {
          ctx.fillStyle = 'rgba(244,245,250,0.85)';
          ctx.fillRect(W / 2 + w / 2 + 6 * s, 336 * s, 24 * s, 48 * s);
          this.mark(W / 2 + w / 2, 330 * s, W / 2 + w / 2 + 36 * s, 390 * s);
        }
      }
      // caption
      if (H.caption && H.captionAlpha > 0.003) {
        ctx.globalAlpha = H.alpha * H.captionAlpha;
        ctx.letterSpacing = `${0.3 * s}px`;
        this.rich(H.caption, W / 2, 446 * s, F.caption, 29 * s, 'center', 'rgba(196,198,210,0.92)');
      }
      ctx.globalAlpha = 1;
      ctx.letterSpacing = '0px';
    }
    this.upload();
  }

  measure(text, font, spacing = 0) {
    const ctx = this.ctx;
    ctx.save(); ctx.font = font; ctx.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }
}
