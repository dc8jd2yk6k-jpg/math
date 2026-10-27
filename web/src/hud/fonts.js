// Load the film's fonts (npm @fontsource packages) into the document so the
// Canvas2D HUD can use them. STIX Two Math is the fallback for every family:
// it carries the math glyphs (∂ ∇ ℂ ⌊ ■ ...) the others lack.
const FS = '../node_modules/@fontsource/';
const RANGES = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
};

const FACES = [
  ['JBM', 'jetbrains-mono', ['latin', 'latin-ext', 'greek'], [300, 700], 'normal'],
  ['Inter', 'inter', ['latin', 'latin-ext', 'greek'], [400, 500, 600], 'normal'],
  ['ISerif', 'instrument-serif', ['latin', 'latin-ext'], [400], 'italic'],
  ['STIXText', 'stix-two-text', ['latin', 'latin-ext', 'greek'], [400], 'italic'],
  ['STIXText', 'stix-two-text', ['latin', 'latin-ext', 'greek'], [400], 'normal'],
];

export async function loadFonts() {
  const all = [];
  for (const [family, pkg, subsets, weights, style] of FACES) {
    for (const sub of subsets) for (const w of weights) {
      const url = `${FS}${pkg}/files/${pkg}-${sub}-${w}-${style}.woff2`;
      all.push(new FontFace(family, `url(${url})`, { weight: String(w), style, unicodeRange: RANGES[sub] }));
    }
  }
  all.push(new FontFace('STIXMath', `url(${FS}stix-two-math/files/stix-two-math-latin-400-normal.woff2)`, { weight: '400' }));
  const loaded = await Promise.all(all.map((f) => f.load().catch(() => null)));
  for (const f of loaded) if (f) document.fonts.add(f);
  await document.fonts.ready;
  return loaded.filter(Boolean).length;
}

export const F = {
  date: (px) => `300 ${px}px JBM, STIXMath`,
  title: (px) => `700 ${px}px JBM, STIXMath`,
  caption: (px) => `400 ${px}px Inter, STIXMath`,
  label: (px) => `500 ${px}px Inter, STIXMath`,
  serif: (px) => `italic 400 ${px}px ISerif, STIXText, STIXMath`,
  math: (px) => `italic 400 ${px}px STIXText, STIXMath`,
  mathUp: (px) => `400 ${px}px STIXText, STIXMath`,
  mono: (px) => `300 ${px}px JBM, STIXMath`,
  monoBold: (px) => `700 ${px}px JBM, STIXMath`,
};
