// Deterministic film render: N headless Chromium workers pull 4-second chunks
// from a queue, stream packed YUV420 frames into ffmpeg (H.264 chunks), then
// the chunks are concatenated losslessly and muxed with the soundtrack.
//
// usage: node render/render.mjs [--out dist] [--work .render] [--workers 3]
//                               [--frames a:b] [--force] [--crf 14]
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { startServer, openFilm, grabFrame } from './browser.mjs';
import { ROOT } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const FRAMES = 4713, FPS = 60, CHUNK = 240;
const OUT = path.resolve(args.out || path.join(ROOT, 'dist'));
const WORK = path.resolve(args.work || path.join(ROOT, '.render'));
const WORKERS = Number(args.workers || 3);
const CRF = String(args.crf || 14);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const [fa, fb] = (args.frames ? String(args.frames) : `0:${FRAMES - 1}`).split(':').map(Number);
const chunks = [];
for (let s = 0; s < FRAMES; s += CHUNK) {
  const e = Math.min(FRAMES - 1, s + CHUNK - 1);
  if (e < fa || s > fb) continue;
  const file = path.join(WORK, `chunk_${String(s).padStart(5, '0')}.mp4`);
  if (!args.force && !args.frames && fs.existsSync(file) && fs.statSync(file).size > 0) continue;
  chunks.push({ s, e, file });
}
console.log(`render: ${chunks.length} chunk(s) of ${CHUNK} frames, ${WORKERS} workers, crf ${CRF}`);

function encoder(file) {
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', '1920x1080', '-r', String(FPS),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-tune', 'film', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-x264-params', 'keyint=120:min-keyint=1:aq-mode=3', '-colorspace', 'bt709', '-color_primaries', 'bt709',
    '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', file + '.part.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
}

const t0 = Date.now();
let done = 0;
const total = chunks.reduce((a, c) => a + (c.e - c.s + 1), 0);
const { server, port } = await startServer();

async function worker(id) {
  const { browser, page } = await openFilm(port);
  while (chunks.length) {
    const c = chunks.shift();
    const enc = encoder(c.file);
    const closed = new Promise((r) => enc.on('close', r));
    for (let n = c.s; n <= c.e; n++) {
      const { buf } = await grabFrame(page, n);
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      done++;
      if (done % 30 === 0) {
        const el = (Date.now() - t0) / 1000;
        const eta = (total - done) / (done / el);
        console.log(`[w${id}] ${done}/${total} frames  ${(done / el).toFixed(2)} fps  eta ${(eta / 60).toFixed(1)} min`);
      }
    }
    enc.stdin.end();
    const code = await closed;
    if (code !== 0) throw new Error(`ffmpeg failed on chunk ${c.s}`);
    fs.renameSync(c.file + '.part.mp4', c.file);
    console.log(`[w${id}] chunk ${c.s}-${c.e} done`);
  }
  await browser.close();
}

await Promise.all(Array.from({ length: Math.min(WORKERS, Math.max(1, chunks.length)) }, (_, i) => worker(i)));
server.close();

// concat + mux
const all = fs.readdirSync(WORK).filter((f) => /^chunk_\d+\.mp4$/.test(f)).sort();
const expected = Math.ceil(FRAMES / CHUNK);
if (all.length !== expected) { console.log(`have ${all.length}/${expected} chunks; not muxing yet`); process.exit(0); }
const list = path.join(WORK, 'list.txt');
fs.writeFileSync(list, all.map((f) => `file '${path.join(WORK, f)}'`).join('\n'));
const video = path.join(WORK, 'video.mp4');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video], { stdio: 'inherit' });
const audio = path.join(ROOT, 'assets/audio/soundtrack.wav');
const final = path.join(OUT, 'delta-t-to-zero_1080p60.mp4');
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart',
  '-metadata', 'title=Δt → 0', '-metadata', 'comment=One take. Linear time. AI × mathematics, 1950–2026.', final], { stdio: 'inherit' });
if (r.status === 0) console.log(`wrote ${final} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
