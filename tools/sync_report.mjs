// Beat-sync report: every visual cue, where it sits on the bar grid, and the
// nearest musical onset detected in the edited soundtrack (assets/audio/cues.json).
// usage: node tools/sync_report.mjs
import fs from 'node:fs';
import { WINDOWS, CREDIT } from '../web/src/story.js';
import { BAR, FPS } from '../web/src/time.js';
import { moveBar } from '../web/src/pieces/go.js';

const cues = JSON.parse(fs.readFileSync(new URL('../assets/audio/cues.json', import.meta.url)));
const score = JSON.parse(fs.readFileSync(new URL('../web/score.json', import.meta.url)));
const hits = cues.hits;
const feats = JSON.parse(fs.readFileSync(new URL('../assets/audio/features.json', import.meta.url)));
// strongest spectral-flux peak within a sixteenth note of time t (the onset that the cue rides on)
function localOnset(t) {
  const f0 = Math.round(t * FPS), w = Math.round(BAR / 16 * FPS);
  let best = null;
  for (let k = -w; k <= w; k++) {
    const i = ((f0 + k) % feats.flux.length + feats.flux.length) % feats.flux.length;
    if (!best || feats.flux[i] > best.v) best = { k, v: feats.flux[i] };
  }
  return { ms: best.k * 1000 / FPS, v: best.v };
}
const events = [
  ...Object.entries(WINDOWS).map(([id, w]) => [`${id} enters`, w[0]]),
  ['credit', CREDIT[0]], ['Move 37', moveBar(36)], ['king tips', 5.0], ['Jacobian collision', 21.0], ['island drop', 26.0],
  ['N–S blow-up', 31.5], ['OpenAI reaches top', 36.0], ['Anthropic reaches top', 36.25], ['pull-back', 38.5], ['loop seam', 0],
  ...score.sfx.filter((s) => s[0] === 'whoosh').map((s) => [`whip`, s[1] + s[2]]),
];
console.log('event                    bar     time     grid      onset at cue (±1/16 bar)   nearest strong hit');
let worst = 0;
const onsetErr = [];
for (const [name, b] of events.sort((a, c) => a[1] - c[1])) {
  const t = b * BAR;
  const sixteenth = Math.round(b * 16) / 16;
  const gridMs = (b - sixteenth) * BAR * 1000;
  let best = null;
  for (const h of hits) { const d = (h.t - t) * 1000; if (!best || Math.abs(d) < Math.abs(best.d)) best = { d, s: h.s }; }
  const onGrid = Math.abs(gridMs) < 1000 / FPS;
  worst = Math.max(worst, Math.abs(gridMs));
  const lo = localOnset(t);
  onsetErr.push(Math.abs(lo.ms));
  console.log(`${name.padEnd(24)} ${b.toFixed(3).padStart(6)}  ${t.toFixed(3).padStart(7)}s  ${onGrid ? 'on 16th' : (gridMs.toFixed(0) + 'ms off')}   ${(lo.ms >= 0 ? '+' : '') + lo.ms.toFixed(0)} ms (flux ${lo.v.toFixed(2)})`.padEnd(78) + `${best ? `${best.d >= 0 ? '+' : ''}${best.d.toFixed(0)} ms (${best.s})` : '-'}`);
}
console.log(`\nworst offset from the sixteenth-note grid: ${worst.toFixed(1)} ms (one frame = ${(1000 / FPS).toFixed(1)} ms)`);
onsetErr.sort((a, c) => a - c);
console.log(`median distance from a cue to its onset: ${onsetErr[onsetErr.length >> 1].toFixed(0)} ms`);
