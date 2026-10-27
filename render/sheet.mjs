// Contact sheet: one small frame per second (or per --every seconds), tiled.
// usage: node render/sheet.mjs out.png [--every 1] [--from 0] [--to 91.6] [--cols 8] [--scale 0.25]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { startServer, openFilm, grabFrame } from './browser.mjs';

const args = { every: 1, from: 0, to: 91.6, cols: 8, scale: 0.25 };
const argv = process.argv.slice(2);
const out = argv[0];
argv.slice(1).forEach((a, i, arr) => { if (a.startsWith('--')) args[a.slice(2)] = Number(arr[i + 1]); });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));
const { server, port } = await startServer();
const { browser, page, sizeStr } = await openFilm(port, { scale: args.scale, msaa: 0 });
let k = 0;
for (let t = args.from; t <= args.to + 1e-6; t += args.every) {
  const n = Math.min(5497, Math.round(t * 60));
  const { buf } = await grabFrame(page, n);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', sizeStr, '-i', '-', '-vf',
    `scale=in_range=tv:in_color_matrix=bt709:out_range=pc,drawtext=text='${t.toFixed(1)}s':x=4:y=4:fontsize=14:fontcolor=yellow:box=1:boxcolor=black`,
    '-frames:v', '1', path.join(tmp, `f_${String(k++).padStart(4, '0')}.png`)], { input: buf });
}
await browser.close();
server.close();
const rows = Math.ceil(k / args.cols);
spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, 'f_%04d.png'), '-vf', `tile=${args.cols}x${rows}:padding=2`, '-frames:v', '1', out], { stdio: 'inherit' });
console.log(`wrote ${out} (${k} frames)`);
