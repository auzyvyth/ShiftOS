// Usage: node render.mjs out.mp4            -> full video (silent; mux audio after)
//        node render.mjs --stills 1.2,5.9   -> PNG stills into ./stills
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const FPS = 30;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto('file://' + path.join(dir, 'index.html'));
await page.evaluate(() => window.READY);
const stage = await page.$('#stage');

if (args[0] === '--stills') {
  mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const t of args[1].split(',').map(Number)) {
    await page.evaluate((x) => window.render(x), t);
    await stage.screenshot({ path: path.join(dir, 'stills', `t${t.toFixed(2)}.png`) });
  }
} else {
  const out = args[0] || path.join(dir, 'out', 'video.mp4');
  mkdirSync(path.dirname(out), { recursive: true });
  const ev = await page.evaluate(() => window.EVENTS());
  writeFileSync(path.join(path.dirname(out), 'events.json'), JSON.stringify(ev));
  const frames = Math.round(ev.duration * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.render(x), f / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
