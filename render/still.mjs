// Render single frames to PNG.
// usage: node render/still.mjs <outdir> [--scale 0.5] <spec...>
//   spec: b12.5 (bar), t30 (seconds), 1234 (frame number)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer, openFilm, grabFrame } from './browser.mjs';

const argv = process.argv.slice(2);
let scale = 0.5;
const i = argv.indexOf('--scale');
if (i >= 0) { scale = Number(argv[i + 1]); argv.splice(i, 2); }
const [out, ...specs] = argv;
fs.mkdirSync(out, { recursive: true });
const FPS = 60, BAR = 5498 / 60 / 42;
const frameOf = (s) => s.startsWith('b') ? Math.round(Number(s.slice(1)) * BAR * FPS) : s.startsWith('t') ? Math.round(Number(s.slice(1)) * FPS) : Number(s);
const { server, port } = await startServer();
const { browser, page, sizeStr } = await openFilm(port, { scale });
for (const s of specs) {
  const n = frameOf(s);
  const { buf, stats } = await grabFrame(page, n);
  const file = path.join(out, `${s}.png`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', sizeStr, '-color_range', 'tv', '-colorspace', 'bt709', '-i', '-', '-vf', 'scale=in_range=tv:in_color_matrix=bt709:out_range=pc', '-frames:v', '1', file], { input: buf });
  console.log(file, JSON.stringify(stats));
}
await browser.close();
server.close();
