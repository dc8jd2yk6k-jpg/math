// Tiny rich-text typesetter for Canvas2D: supports ^{sup} and _{sub}.
export const FONTS = {
  inter: (s, w = 400) => `${w} ${s}px "Inter"`,
  mono: (s, w = 500) => `${w} ${s}px "JetBrains Mono"`,
  math: (s) => `italic 400 ${s}px "STIX Two Text"`,
  mathr: (s) => `400 ${s}px "STIX Two Text"`,
};

export function parseRich(str) {
  const runs = [];
  let i = 0, buf = '';
  while (i < str.length) {
    const c = str[i];
    if ((c === '^' || c === '_') && str[i + 1] === '{') {
      if (buf) { runs.push({ t: buf, k: 0 }); buf = ''; }
      const end = str.indexOf('}', i + 2);
      runs.push({ t: str.slice(i + 2, end), k: c === '^' ? 1 : -1 });
      i = end + 1;
    } else { buf += c; i++; }
  }
  if (buf) runs.push({ t: buf, k: 0 });
  return runs;
}

export function measureRich(ctx, str, fontFn, size, tracking = 0) {
  let w = 0;
  for (const r of parseRich(str)) {
    const s = r.k ? size * 0.62 : size;
    ctx.font = fontFn(s);
    w += ctx.measureText(r.t).width + tracking * r.t.length;
  }
  return w;
}

// draws at (x, y) with textBaseline = alphabetic; returns advance width.
// maxChars: typewriter reveal (counts visible characters)
export function drawRich(ctx, str, x, y, fontFn, size, opts = {}) {
  const tracking = opts.tracking || 0;
  let cx = x;
  let left = opts.maxChars ?? Infinity;
  for (const r of parseRich(str)) {
    if (left <= 0) break;
    const s = r.k ? size * 0.62 : size;
    ctx.font = fontFn(s);
    const dy = r.k === 1 ? -size * 0.38 : r.k === -1 ? size * 0.18 : 0;
    const txt = r.t.slice(0, Math.max(0, Math.floor(left)));
    left -= r.t.length;
    if (tracking && 'letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(txt, cx, y + dy);
    cx += ctx.measureText(txt).width + (('letterSpacing' in ctx) ? 0 : tracking * txt.length);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  return cx - x;
}

export function richLength(str) {
  return parseRich(str).reduce((a, r) => a + r.t.length, 0);
}
