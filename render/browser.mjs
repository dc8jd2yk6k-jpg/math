// Shared headless-browser setup for still and video capture.
import { createRequire } from 'node:module';
import { createServer } from './serve.mjs';

const require = createRequire(import.meta.url);

export async function startServer() {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port };
}

export async function openFilm(port, { log = false } = {}) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=4096'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (log || m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/web/index.html?capture=1`);
  await page.waitForFunction(() => (window.__film && window.__film.ready) || window.__filmError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__filmError);
  if (err) throw new Error(err);
  const size = await page.evaluate(() => window.__film.size);
  return { browser, page, size: `${size[0]}x${size[1]}` };
}

// render frame n in the page and pull the packed YUV420 bytes out as a Buffer
export async function grabFrame(page, n) {
  const b64 = await page.evaluate((n) => {
    const st = window.__film.renderFrame(n);
    const y = window.__film.readYUV();
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < y.length; i += CH) s += String.fromCharCode.apply(null, y.subarray(i, i + CH));
    return { data: btoa(s), stats: st };
  }, n);
  return { buf: Buffer.from(b64.data, 'base64'), stats: b64.stats };
}
