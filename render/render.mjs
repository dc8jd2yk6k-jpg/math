// Deterministic film render: N headless Chromium workers pull chunks of
// frames, stream packed YUV420 into ffmpeg/x264, then the chunks are
// concatenated losslessly and muxed with the soundtrack.
//
// usage: node render/render.mjs [--scale 1] [--step 1] [--workers 2] [--crf 14]
//          [--frames a:b] [--name delta-t] [--force] [--no-audio]
//   --step 2 renders every other frame and encodes at 30 fps (previews)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { startServer, openFilm, grabFrame } from './browser.mjs';
import { ROOT } from './serve.mjs';

const args = {};
process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true; });
const FRAMES = 5498, FPS = 60;
const scale = Number(args.scale || 1), step = Number(args.step || 1), workers = Number(args.workers || 2);
const crf = String(args.crf || (scale < 1 ? 20 : 14));
const fps = FPS / step;
const name = args.name || `delta-t_${Math.round(1080 * scale)}x${Math.round(1920 * scale)}_${fps}fps`;
const WORK = path.join(ROOT, '.render', name);
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const CHUNK = Math.round(240 / step) * step;
const [fa, fb] = (args.frames ? String(args.frames) : `0:${FRAMES - 1}`).split(':').map(Number);

const chunks = [];
for (let s = 0; s < FRAMES; s += CHUNK) {
  const e = Math.min(FRAMES - 1, s + CHUNK - 1);
  if (e < fa || s > fb) continue;
  const file = path.join(WORK, `chunk_${String(s).padStart(5, '0')}.mp4`);
  if (!args.force && fs.existsSync(file) && fs.statSync(file).size > 0) continue;
  chunks.push({ s, e, file });
}
const total = chunks.reduce((a, c) => a + Math.ceil((c.e - c.s + 1) / step), 0);
console.log(`${name}: ${chunks.length} chunks, ${total} frames, ${workers} workers`);

function encoder(file, size) {
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', size, '-r', String(fps),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-i', '-',
    '-c:v', 'libx264', '-preset', scale < 1 ? 'medium' : 'slow', '-crf', crf, '-tune', 'film', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', `keyint=${2 * fps}:min-keyint=1:aq-mode=3`, '-colorspace', 'bt709', '-color_primaries', 'bt709',
    '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', file + '.part.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
}

const t0 = Date.now();
let done = 0;
const { server, port } = await startServer();
async function worker(id) {
  const { browser, page, sizeStr } = await openFilm(port, { scale });
  while (chunks.length) {
    const c = chunks.shift();
    const enc = encoder(c.file, sizeStr);
    const closed = new Promise((r) => enc.on('close', r));
    for (let n = c.s; n <= c.e; n += step) {
      const { buf } = await grabFrame(page, n);
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      if (++done % 20 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`[w${id}] ${done}/${total}  ${(done / el).toFixed(2)} fps  eta ${((total - done) / (done / el) / 60).toFixed(1)} min`);
      }
    }
    enc.stdin.end();
    if ((await closed) !== 0) throw new Error(`ffmpeg failed on chunk ${c.s}`);
    fs.renameSync(c.file + '.part.mp4', c.file);
  }
  await browser.close();
}
await Promise.all(Array.from({ length: Math.min(workers, Math.max(1, chunks.length)) }, (_, i) => worker(i)));
server.close();

const all = fs.readdirSync(WORK).filter((f) => /^chunk_\d+\.mp4$/.test(f)).sort();
if (args.frames || all.length !== Math.ceil(FRAMES / CHUNK)) { console.log(`have ${all.length} chunks; not muxing`); process.exit(0); }
const list = path.join(WORK, 'list.txt');
fs.writeFileSync(list, all.map((f) => `file '${path.join(WORK, f)}'`).join('\n'));
const video = path.join(WORK, 'video.mp4');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video], { stdio: 'inherit' });
const final = path.join(OUT, `${name}.mp4`);
const audio = path.join(ROOT, 'assets/audio/soundtrack.wav');
const mux = args['no-audio'] || !fs.existsSync(audio)
  ? ['-i', video, '-c', 'copy']
  : ['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000'];
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...mux, '-movflags', '+faststart', '-metadata', 'title=Δt → 0', final], { stdio: 'inherit' });
if (r.status === 0) console.log(`wrote ${final} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
