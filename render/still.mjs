// Render individual frames to PNG for review.
// usage: node render/still.mjs <outdir> <spec...>   spec: frame number, "t12.5" (seconds) or "b16" (bars)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer, openFilm, grabFrame } from './browser.mjs';

const [outDir, ...specs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const BAR = 240 / 110, FPS = 60;
const frames = specs.map((s) => s.startsWith('t') ? Math.round(parseFloat(s.slice(1)) * FPS) : s.startsWith('b') ? Math.round(parseFloat(s.slice(1)) * BAR * FPS) : parseInt(s, 10));
const { server, port } = await startServer();
const { browser, page, size } = await openFilm(port);
for (const n of frames) {
  const t0 = Date.now();
  const { buf, stats } = await grabFrame(page, n);
  const file = path.join(outDir, `f${String(n).padStart(5, '0')}.png`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', size, '-color_range', 'tv', '-colorspace', 'bt709', '-i', '-', '-vf', 'scale=in_range=tv:out_range=pc:in_color_matrix=bt709,format=rgb24', file], { input: buf });
  if (r.status) console.log(r.stderr.toString());
  console.log(`frame ${n} (b=${(n / FPS / BAR).toFixed(2)}) ${Date.now() - t0} ms, blur x${stats.samples}, gpu ${stats.ms.toFixed(0)} ms -> ${file}`);
}
await browser.close();
server.close();
