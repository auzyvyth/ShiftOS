// Drevo Skits, three.js test: renders three/scene.html frame by frame -> MP4 with a silent track.
// Run: THREE_DIR=<folder holding three.module.js> NODE_PATH=$(npm root -g) node marketing/skits/three/render.mjs
// (three is not an app dependency: install it anywhere, `npm i three`, and point THREE_DIR at node_modules/three/build)
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const SKITS = fileURLToPath(new URL('../', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const THREE_DIR = process.env.THREE_DIR;
if (!THREE_DIR) throw new Error('set THREE_DIR');
const OUT = `${SKITS}preview/three-test`;
const MAP = { '/three/': THREE_DIR + '/', '/assets/drevo-logo.svg': `${ROOT}public/drevo-logo.svg`, '/assets/': `${SKITS}assets/`, '/': `${SKITS}three/` };
const TYPES = { js: 'text/javascript', html: 'text/html', svg: 'image/svg+xml', png: 'image/png' };

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0] === '/' ? '/scene.html' : req.url.split('?')[0];
  const prefix = Object.keys(MAP).find((p) => url.startsWith(p));
  const file = MAP[prefix].endsWith('/') ? MAP[prefix] + url.slice(prefix.length) : MAP[prefix];
  try { res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] || 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
const frames = await page.evaluate(() => window.FRAMES);
for (let f = 0; f < frames; f++) {
  await page.evaluate((n) => window.frame(n), f);
  await page.screenshot({ path: `${OUT}/f${String(f).padStart(4, '0')}.png` });
}
await browser.close(); server.close();
const mp4 = `${SKITS}preview/three-test.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${OUT}/f%04d.png`,
  '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-crf', '20', '-c:a', 'aac', mp4]);
console.log('wrote', mp4, frames, 'frames');
