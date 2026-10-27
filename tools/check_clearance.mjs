// The line must never pass through anything solid. Samples the whole curve and
// reports the minimum clearance to every solid set-piece volume in
// web/src/layout.js (SOLIDS). Line-art pieces, the Lean card plane and the
// island are threaded by the line on purpose and are not solids here.
// usage: node tools/check_clearance.mjs
import { SAMPLES, N_SAMPLES } from '../web/src/curve.js';
import { SOLIDS } from '../web/src/layout.js';

const MIN_CLEARANCE = 0.5;
const dist = (p, b) => {
  const dx = Math.max(b.min.x - p[0], 0, p[0] - b.max.x);
  const dy = Math.max(b.min.y - p[1], 0, p[1] - b.max.y);
  const dz = Math.max(b.min.z - p[2], 0, p[2] - b.max.z);
  return Math.hypot(dx, dy, dz);
};
let ok = true;
for (const b of SOLIDS) {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < N_SAMPLES; i++) {
    const d = dist([SAMPLES.x[i], SAMPLES.y[i], 0], b);
    if (d < best.d) best = { d, s: SAMPLES.s[i] };
  }
  const pass = best.d >= MIN_CLEARANCE;
  ok &&= pass;
  console.log(`${b.name.padEnd(14)} min clearance ${best.d.toFixed(2)} at s=${best.s.toFixed(1)}  ${pass ? 'OK' : 'LINE PASSES THROUGH'}`);
}
console.log(ok ? 'CLEARANCE OK' : 'CLEARANCE FAILED');
process.exit(ok ? 0 : 1);
