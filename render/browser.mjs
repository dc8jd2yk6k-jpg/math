// Shared headless-Chromium driver: start the static server, open the film in
// capture mode, render frames and pull packed YUV420 bytes out of the page.
import { createRequire } from 'node:module';
import { createServer } from './serve.mjs';

const require = createRequire(import.meta.url);

export async function startServer() {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port };
}

export async function openFilm(port, { scale = 1, msaa = 4, log = false } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
      '--js-flags=--max-old-space-size=6144', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (log || m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/web/index.html?capture=1&scale=${scale}&msaa=${msaa}`);
  await page.waitForFunction(() => (window.__film && window.__film.ready) || window.__filmError, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__filmError);
  if (err) throw new Error(err);
  const size = await page.evaluate(() => window.__film.size);
  return { browser, page, size, sizeStr: `${size[0]}x${size[1]}` };
}

export async function grabFrame(page, n) {
  const res = await page.evaluate((n) => {
    const st = window.__film.renderFrame(n);
    const y = window.__film.readYUV();
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < y.length; i += CH) s += String.fromCharCode.apply(null, y.subarray(i, i + CH));
    return { data: btoa(s), stats: st };
  }, n);
  return { buf: Buffer.from(res.data, 'base64'), stats: res.stats };
}
