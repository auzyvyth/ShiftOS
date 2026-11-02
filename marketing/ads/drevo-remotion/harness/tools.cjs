// node harness/tools.cjs  -> public/real/: loan-poster-<lang>.jpg, motion-<lang>.mp4, gr86-cutout.png
// Every file is produced by the app's own code (renderLoanPoster, drawMotionFrame, cutOutBackground).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const OUT = 'public/real';
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', (e) => console.error('page error', String(e)));
  await p.goto('http://localhost:5199/tools.html');
  await p.waitForFunction(() => window.TOOLS_READY === true);
  for (const lang of ['ms', 'en']) {
    save(path.join(OUT, `loan-poster-${lang}.jpg`), await p.evaluate((l) => window.loanPoster(l), lang));
    const len = await p.evaluate((l) => window.motionSetup(l, 'calc'), lang);
    const dir = path.join(OUT, `.motion-${lang}`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const n = Math.round(len * 30);
    for (let i = 0; i < n; i++) save(path.join(dir, String(i).padStart(5, '0') + '.jpg'), await p.evaluate((t) => window.motionFrame(t), i / 30));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', path.join(OUT, `motion-${lang}.mp4`)]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(lang, 'posters done', len + 's');
  }
  const t0 = Date.now();
  save(path.join(OUT, 'gr86-cutout.png'), await p.evaluate(() => window.cutout(), null));
  console.log('cutout', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
