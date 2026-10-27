// Entry point: live player (audio-synced, scrubbable) and the deterministic
// capture API used by render/render.mjs.
import { Film } from './film.js';
import { W, H, FPS, FRAMES, DURATION, BAR } from './config.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');

async function loadFonts() {
  const faces = [
    ['Inter', 'Inter.ttf', { weight: '100 900' }],
    ['JetBrains Mono', 'JetBrainsMono.ttf', { weight: '100 900' }],
    ['STIX Two Text', 'STIXTwoText-Italic.ttf', { style: 'italic', weight: '400 700' }],
    ['STIX Two Text', 'STIXTwoText.ttf', { weight: '400 700' }],
  ];
  await Promise.all(faces.map(async ([fam, file, desc]) => {
    const f = new FontFace(fam, `url(../assets/fonts/${file})`, desc);
    await f.load();
    document.fonts.add(f);
  }));
}

async function main() {
  await loadFonts();
  const features = await fetch('../assets/audio/features.json').then((r) => r.json()).catch(() => null);
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const film = new Film(canvas, features);
  window.__film = {
    ready: true, frames: FRAMES, fps: FPS,
    // capture: render frame n, return a Uint8Array of packed YUV420 (BT.709 limited)
    renderFrame(n) { film.render(n / FPS, n); return film.stats; },
    readYUV() { return film.readYUV(); },
    present() { film.present(); },
    stats: () => film.stats,
    size: [W, H],
    setDebug(d) { film.debug = d; },
  };
  if (CAPTURE) return;

  // ---- live player
  const audio = new Audio('../assets/audio/soundtrack.wav');
  audio.loop = true;
  audio.preload = 'auto';
  const ui = document.getElementById('ui');
  const bar = document.getElementById('scrub');
  const label = document.getElementById('time');
  let scrubT = Number(params.get('t') || 0);
  let playing = false;
  const fpsEl = document.getElementById('fps');
  let last = performance.now(), acc = 0, n = 0;

  function frame() {
    const t = playing ? audio.currentTime : scrubT;
    film.render(t);
    film.present();
    bar.value = String((t / DURATION) * 1000);
    label.textContent = `${t.toFixed(2)} s · bar ${(t / BAR).toFixed(2)} · blur×${film.stats.samples}`;
    const now = performance.now(); acc += now - last; last = now; n++;
    if (acc > 500) { fpsEl.textContent = `${(1000 * n / acc).toFixed(0)} fps`; acc = 0; n = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const toggle = async () => {
    if (playing) { audio.pause(); scrubT = audio.currentTime; playing = false; }
    else { audio.currentTime = scrubT; await audio.play(); playing = true; }
    document.getElementById('play').textContent = playing ? '❚❚' : '▶';
  };
  document.getElementById('play').onclick = toggle;
  canvas.onclick = toggle;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') { scrubT = Math.min(DURATION, (playing ? audio.currentTime : scrubT) + BAR); if (playing) audio.currentTime = scrubT; }
    if (e.code === 'ArrowLeft') { scrubT = Math.max(0, (playing ? audio.currentTime : scrubT) - BAR); if (playing) audio.currentTime = scrubT; }
    if (e.code === 'KeyH') ui.classList.toggle('hidden');
  });
  bar.oninput = () => { scrubT = (Number(bar.value) / 1000) * DURATION; if (playing) audio.currentTime = scrubT; };
}

main().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66">${e.stack}</pre>`); window.__filmError = String(e.stack || e); });
