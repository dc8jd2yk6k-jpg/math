// Entry point. Two modes:
//   live player:  /web/?scale=0.5     (audio-synced; space, ←/→ bars, H hud, D debug)
//   capture:      /web/?capture=1     (window.__film API for render/render.mjs)
import { Film } from './film.js';
import { loadFonts } from './hud/fonts.js';
import { loadAudioData, FPS, FRAMES, BAR, W, H } from './time.js';

const q = new URLSearchParams(location.search);
const capture = q.has('capture');
const scale = Number(q.get('scale') || (capture ? 1 : 0.5));
const msaa = Number(q.get('msaa') ?? 4);
const canvas = document.getElementById('c');

async function boot() {
  await Promise.all([loadFonts(), loadAudioData()]);
  const w = Math.round(W * scale / 4) * 4, h = Math.round(H * scale / 4) * 4;
  const film = new Film(canvas, { width: w, height: h, msaa });
  if (capture) {
    window.__film = {
      ready: true, size: [w, h], frames: FRAMES, fps: FPS,
      renderFrame: (n) => film.renderFrame(n),
      readYUV: () => film.readYUV(),
      present: () => film.present(),
      debug: () => film.stats,
    };
    window.__filmObj = film;      // for profiling and tools
    return;
  }
  live(film);
}

function live(film) {
  const audio = new Audio('../assets/audio/soundtrack.wav');
  audio.loop = true;
  const ui = document.getElementById('ui');
  let paused = true, t = Number(q.get('t') || 0) * BAR, debug = false, last = performance.now();
  const start = document.createElement('div');
  start.id = 'start'; start.textContent = 'click to play';
  document.body.appendChild(start);
  start.onclick = () => { start.remove(); audio.currentTime = t; audio.play(); paused = false; };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { paused = !paused; if (paused) audio.pause(); else { audio.currentTime = t; audio.play(); } }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { t = Math.max(0, t + (e.code === 'ArrowRight' ? BAR : -BAR)); audio.currentTime = t; }
    if (e.code === 'KeyD') debug = !debug;
    if (e.code === 'KeyH') film.post.mComp.uniforms.uHud.value = 1 - film.post.mComp.uniforms.uHud.value;
  });
  const loop = (now) => {
    if (!paused) t = audio.currentTime; else t += 0;
    last = now;
    const frame = Math.round(t * FPS) % FRAMES;
    const st = film.renderFrame(frame);
    film.present();
    ui.textContent = debug ? `bar ${st.b.toFixed(2)}  frame ${frame}  blur ${st.samples}  ${st.ms} ms` : '';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot().catch((e) => { window.__filmError = String(e && e.stack || e); console.error(e); });
