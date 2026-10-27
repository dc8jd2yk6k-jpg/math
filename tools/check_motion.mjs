// Camera motion report: samples the real camera (paths and orbit keys) at every
// frame of the film, in the page, and reports
//   - perceived speed: rotation + parallax of the focus, in degrees per frame
//   - jerk: frame-to-frame change of that speed (hitches show up here)
//   - fov steps, one-frame motion-blur sample blips
//   - frames where the camera is inside or within 0.6 of solid geometry
//     (island voxels, board volumes)
// usage: node tools/check_motion.mjs [--from 0] [--to 42] [--top 20] [--csv out.csv]
import fs from 'node:fs';
import { startServer, openFilm } from '../render/browser.mjs';

const args = { from: 0, to: 42, top: 20, csv: '' };
const argv = process.argv.slice(2);
argv.forEach((a, i) => { if (a.startsWith('--')) args[a.slice(2)] = a === '--csv' ? argv[i + 1] : Number(argv[i + 1]); });

const { server, port } = await startServer();
const { browser, page } = await openFilm(port, { scale: 0.1, msaa: 0 });
const rows = await page.evaluate(({ from, to }) => {
  const film = window.__filmObj;
  const { FPS, BAR } = { FPS: 60, BAR: 5498 / 60 / 42 };
  const isl = film.pieces.find((p) => p.id === 'percolation');
  const { occ, I } = isl.isl;
  const O = isl.origin;
  const NX = 88, NY = 44, NZ = 88;
  const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < NX && y < NY && z < NZ && occ[I(x, y, z)] !== 0;
  // distance from p to the nearest solid voxel (searched within 2 voxels), 9 if none
  const voxelClear = (p) => {
    const fx = p.x - O.x, fy = p.y - O.y, fz = p.z - O.z;
    if (fx < -3 || fy < -3 || fz < -3 || fx > NX + 3 || fy > NY + 3 || fz > NZ + 3) return 9;
    let best = 9;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
    for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x0 + dx, Y = y0 + dy, Z = z0 + dz;
      if (!solid(X, Y, Z)) continue;
      const ex = Math.max(X - fx, 0, fx - X - 1), ey = Math.max(Y - fy, 0, fy - Y - 1), ez = Math.max(Z - fz, 0, fz - Z - 1);
      best = Math.min(best, Math.hypot(ex, ey, ez));
    }
    return best;
  };
  const solids = film.solids || [];
  const out = [];
  const f0 = Math.round(from * BAR * FPS), f1 = Math.min(5497, Math.round(to * BAR * FPS));
  let prev = null;
  for (let n = f0; n <= f1; n++) {
    const b = n / FPS / BAR;
    const p = film.rig.pose(b);
    const d = Math.max(1e-3, p.pos.distanceTo(p.focus));
    let ang = 0, par = 0;
    if (prev) {
      ang = p.quat.angleTo(prev.quat) * 180 / Math.PI;
      par = Math.atan(p.pos.distanceTo(prev.pos) / d) * 180 / Math.PI;
    }
    let boxClear = 9;
    for (const s of solids) {
      const ex = Math.max(s.min.x - p.pos.x, 0, p.pos.x - s.max.x), ey = Math.max(s.min.y - p.pos.y, 0, p.pos.y - s.max.y), ez = Math.max(s.min.z - p.pos.z, 0, p.pos.z - s.max.z);
      boxClear = Math.min(boxClear, Math.hypot(ex, ey, ez));
    }
    out.push({ n, b, speed: ang + par, fov: p.fov, clear: Math.min(voxelClear(p.pos), boxClear), samples: film.blurSamples(b),
      pos: [p.pos.x, p.pos.y, p.pos.z] });
    prev = p;
  }
  return out;
}, { from: args.from, to: args.to });
await browser.close();
server.close();

const fmt = (r) => `frame ${String(r.n).padStart(4)}  t ${(r.n / 60).toFixed(2).padStart(6)}s  bar ${r.b.toFixed(3).padStart(6)}`;
for (let i = 1; i < rows.length; i++) rows[i].jerk = Math.abs(rows[i].speed - rows[i - 1].speed);
rows[0].jerk = 0;
// speed per 0.5 s window
console.log('window        max speed  max jerk  min clear  fov range');
for (let t = rows[0].n / 60; t < rows[rows.length - 1].n / 60; t += 0.5) {
  const w = rows.filter((r) => r.n / 60 >= t && r.n / 60 < t + 0.5);
  if (!w.length) continue;
  const mx = (k) => Math.max(...w.map((r) => r[k]));
  const mn = (k) => Math.min(...w.map((r) => r[k]));
  const flag = mx('jerk') > 1.0 ? '  <- jerk' : '';
  const cflag = mn('clear') < 0.6 ? '  <- CLIP' : '';
  console.log(`${t.toFixed(1).padStart(5)}-${(t + 0.5).toFixed(1).padEnd(6)} ${mx('speed').toFixed(2).padStart(9)} ${mx('jerk').toFixed(2).padStart(9)} ${mn('clear').toFixed(2).padStart(9)}   ${mn('fov').toFixed(1)}-${mx('fov').toFixed(1)}${flag}${cflag}`);
}
console.log(`\ntop ${args.top} jerks (deg/frame change in perceived speed):`);
for (const r of [...rows].sort((a, b) => b.jerk - a.jerk).slice(0, args.top)) console.log(`  ${fmt(r)}  speed ${r.speed.toFixed(2)}  jerk ${r.jerk.toFixed(2)}`);
const fovSteps = rows.slice(1).filter((r, i) => Math.abs(r.fov - rows[i].fov) > 0.6);
console.log(`\nfov steps > 0.6 deg/frame: ${fovSteps.length}`);
fovSteps.slice(0, 10).forEach((r) => console.log(`  ${fmt(r)}  fov ${r.fov.toFixed(2)}`));
const blips = rows.filter((r, i) => i > 0 && i < rows.length - 1 && r.samples !== rows[i - 1].samples && rows[i + 1].samples === rows[i - 1].samples);
console.log(`motion-blur sample blips: ${blips.length}`);
const clips = rows.filter((r) => r.clear < 0.6);
console.log(`frames with the camera within 0.6 of solid geometry: ${clips.length}`);
clips.slice(0, 10).forEach((r) => console.log(`  ${fmt(r)}  clear ${r.clear.toFixed(2)}  pos ${r.pos.map((v) => v.toFixed(1)).join(', ')}`));
if (args.csv) fs.writeFileSync(args.csv, 'frame,bar,speed,jerk,fov,clear,samples\n' + rows.map((r) => [r.n, r.b.toFixed(4), r.speed.toFixed(4), r.jerk.toFixed(4), r.fov.toFixed(3), r.clear.toFixed(3), r.samples].join(',')).join('\n'));
process.exit(clips.length ? 1 : 0);
