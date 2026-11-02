// Records the REAL LivePresenter (harness/index.html, served by `vite --config harness/vite.config.js`)
// while a script taps it, in real time, through Chrome's screencast.
//   node harness/record.cjs <take> <lang> <outDir>
// Writes <outDir>/<take>-<lang>.mp4 (30 fps, constant) and <outDir>/<take>-<lang>.clicks.json
// (time + stage coordinates of every tap, so the Remotion cursor lands on the real button).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , take = 'calc', lang = 'ms', outDir = 'public/takes'] = process.argv;
const W = 1124, H = 1000, DSF = 2, FPS = 30;
const T = lang === 'en'
  ? { cars: 'Cars', budget: 'Budget', none: 'None', pay: 'Take-home', yrs: (y) => `${y} YEARS`, monthly: 'Monthly budget' }
  : { cars: 'Kereta', budget: 'Bajet', none: 'Tiada', pay: 'Gaji bersih', yrs: (y) => `${y} TAHUN`, monthly: 'Bajet bulanan' };

// Each take: setup (not recorded) + timed steps (recorded). Times in seconds from record start.
const TAKES = {
  calc: {
    dur: 9.5,
    async setup(p) {
      await p.getByRole('button', { name: '1.5TD Flagship', exact: true }).click();
      await p.locator('tr.lp-r-reb').click();
      await p.keyboard.type('7000'); await p.keyboard.press('Enter');
      await p.getByRole('button', { name: T.none, exact: true }).click();
    },
    steps: [
      [1.0, (p) => p.getByRole('button', { name: '20%', exact: true })],
      [2.0, (p) => p.locator('button.lp-ten', { hasText: T.yrs(9) })],
      [4.0, (p) => p.getByRole('button', { name: '1.5TD Premium', exact: true })],
      [5.2, (p) => p.locator('button.lp-ten', { hasText: T.yrs(7) })],
      [6.4, (p) => p.getByRole('button', { name: '55%', exact: true })],
      [7.6, (p) => p.getByRole('button', { name: '10%', exact: true })],
    ],
  },
  budget: {
    dur: 9.0,
    async setup(p) { await p.getByRole('button', { name: T.budget, exact: true }).click(); },
    steps: [
      [0.8, (p) => p.locator('input').first(), '1100'],
      [4.2, (p) => p.getByRole('button', { name: T.pay, exact: true })],
      [4.9, (p) => p.locator('input').nth(0), '5000', true],
      [6.4, (p) => p.locator('input').nth(1), '800'],
    ],
  },
};

(async () => {
  const cfg = TAKES[take];
  fs.mkdirSync(outDir, { recursive: true });
  const frameDir = path.join(outDir, `.${take}-${lang}-frames`);
  fs.rmSync(frameDir, { recursive: true, force: true }); fs.mkdirSync(frameDir);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  await p.goto(`http://localhost:5199/?lang=${lang}`);
  await p.waitForSelector('.lp-desk');
  await p.waitForTimeout(1500);
  await cfg.setup(p);
  await p.mouse.move(W / 2, H + 50);
  await p.waitForTimeout(1200);

  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ ts: f.metadata.timestamp, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const clicks = [];
  for (const [at, get, text, clear] of cfg.steps) {
    const wait = at - (Date.now() / 1000 - t0);
    if (wait > 0) await p.waitForTimeout(wait * 1000);
    const el = get(p);
    const box = await el.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    clicks.push({ t: +(Date.now() / 1000 - t0).toFixed(3), x: x / W, y: y / H });
    await p.mouse.click(x, y);
    if (clear) await el.fill('');
    if (text) await p.keyboard.type(text, { delay: 90 });
  }
  const left = cfg.dur - (Date.now() / 1000 - t0);
  if (left > 0) await p.waitForTimeout(left * 1000);
  await cdp.send('Page.stopScreencast');
  await b.close();

  // Constant-rate video: frame k shows the newest screencast frame at or before k/FPS.
  const start = frames[0].ts;
  const n = Math.round(cfg.dur * FPS);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const tt = start + k / FPS;
    while (j + 1 < frames.length && frames[j + 1].ts <= tt) j++;
    fs.writeFileSync(path.join(frameDir, String(k).padStart(5, '0') + '.jpg'), Buffer.from(frames[j].data, 'base64'));
  }
  const out = path.join(outDir, `${take}-${lang}.mp4`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frameDir, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out]);
  // clicks are measured from record start; the screencast's first frame is the video's 0
  const offset = start - t0;
  fs.writeFileSync(path.join(outDir, `${take}-${lang}.clicks.json`), JSON.stringify({ w: W, h: H, clicks: clicks.map((c) => ({ ...c, t: +(c.t - offset).toFixed(3) })) }));
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(`${out}: ${frames.length} screencast frames -> ${n} video frames`);
})().catch((e) => { console.error(e); process.exit(1); });
