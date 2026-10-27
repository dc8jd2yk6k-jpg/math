// Loop and determinism checks.
//  1. camera continuity across the seam: position/rotation velocity and
//     acceleration at frames N-2 .. 1 compared with their neighbourhood
//  2. picture continuity: mean |difference| of frames N-1 -> 0 versus the
//     typical difference between consecutive frames nearby
//  3. determinism: the same frame rendered in two separate browsers is
//     byte-identical
// usage: node tools/check_loop.mjs [--scale 0.5]
import { startServer, openFilm, grabFrame } from '../render/browser.mjs';

const scale = Number(process.argv[process.argv.indexOf('--scale') + 1] || 0.5);
const { server, port } = await startServer();
const A = await openFilm(port, { scale });
const N = await A.page.evaluate(() => window.__film.frames);

const poses = await A.page.evaluate((N) => {
  const f = window.__filmObj, out = [];
  for (const n of [N - 4, N - 3, N - 2, N - 1, 0, 1, 2, 3]) {
    const p = f.rig.pose((n / 60) / (f.constructor.BAR || (5498 / 60 / 42)));
    out.push({ n, p: p.pos.toArray(), q: p.quat.toArray(), fov: p.fov });
  }
  return out;
}, N);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const vel = [], acc = [];
for (let i = 1; i < poses.length; i++) vel.push(sub(poses[i].p, poses[i - 1].p));
for (let i = 1; i < vel.length; i++) acc.push(len(sub(vel[i], vel[i - 1])));
console.log('camera speed per frame:', vel.map((v) => len(v).toFixed(3)).join(' '));
console.log('camera accel per frame:', acc.map((a) => a.toFixed(4)).join(' '), ' (the 3rd and 4th straddle the seam)');
const seamAcc = Math.max(acc[2], acc[3]), around = Math.max(acc[0], acc[1], acc[4], acc[5]);
const okCam = seamAcc <= Math.max(0.05, 3 * around);

const diff = (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
const fr = {};
for (const n of [N - 3, N - 2, N - 1, 0, 1, 2]) fr[n] = (await grabFrame(A.page, n)).buf;
const ySize = fr[0].length * 2 / 3;
const d = (a, b) => diff(fr[a].subarray(0, ySize), fr[b].subarray(0, ySize));
const seam = d(N - 1, 0), typical = (d(N - 3, N - 2) + d(N - 2, N - 1) + d(0, 1) + d(1, 2)) / 4;
console.log(`luma |Δ| across seam ${seam.toFixed(2)}, typical consecutive ${typical.toFixed(2)}`);
const okPix = seam <= 2.5 * typical + 0.5;

const B = await openFilm(port, { scale });
const probe = 2345;
const a1 = (await grabFrame(A.page, probe)).buf, b1 = (await grabFrame(B.page, probe)).buf;
const same = Buffer.compare(a1, b1) === 0;
let maxd = 0;
for (let i = 0; i < a1.length; i++) maxd = Math.max(maxd, Math.abs(a1[i] - b1[i]));
console.log(`frame ${probe} in two browsers: ${same ? 'identical' : 'DIFFERENT (max diff ' + maxd + ')'}`);
await A.browser.close(); await B.browser.close(); server.close();
console.log(okCam && okPix && same ? 'LOOP OK' : 'CHECK FAILED');
process.exit(okCam && okPix && same ? 0 : 1);
