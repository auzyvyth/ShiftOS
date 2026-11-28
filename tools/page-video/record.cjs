// Records a seller page scrolling from the top to the footer, at DESKTOP size, for the
// /for-salesmen "scroll through a real Premium page" video (PageVideo.jsx).
// Usage:
//   npm run build && npx vite preview --port 4173      (the local build reads the LIVE database)
//   node tools/page-video/record.cjs <emptyDir> frames [speed px/s] [path]
//     default path: /s/premiummotors?brand=perodua  (probe = 5 stills instead of frames)
//   ffmpeg -framerate 30 -i <dir>/f%05d.png -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -crf 26 -movflags +faststart out.mp4
// Save as public/for-salesmen/premium-page-scroll-vN.mp4 (+ .jpg still) with a NEW N and update PageVideo.jsx.
// Real data only: the page, its cars and photos come from the live database and storage, so the
// environment must allow drevo's Supabase host + wsrv.nl. Uses the session proxy when one is set.
const { chromium } = require('playwright');
const OUT = process.argv[2]; const MODE = process.argv[3] || 'frames';
const SPEED = Number(process.argv[4] || 420);
const PATH = process.argv[5] || '/s/premiummotors?brand=perodua';
(async () => {
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  const proxy = px ? (() => { const u = new URL(px); return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password), bypass: 'localhost,127.0.0.1' }; })() : undefined;
  const b = await chromium.launch({ proxy });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  // No cookie banner, no analytics: this is a recording, not a visit.
  await ctx.addInitScript(() => { try { localStorage.setItem('xdrive_cookie_consent', JSON.stringify({ v: 1, analytics: false, preferences: false, ts: Date.now() })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:4173' + PATH, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.addStyleTag({ content: '::-webkit-scrollbar{display:none} html{scrollbar-width:none}' });
  // Load every lazy section and photo once, then back to the top.
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 500) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(250); }
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1500); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
  const total = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  console.log('page height', H, 'scroll distance', total);
  if (MODE === 'probe') { for (const [i, y] of [0, 0.25, 0.5, 0.75, 1].entries()) { await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(total * y)); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/probe-${i}.png` }); } await b.close(); return; }
  const FPS = 30, HOLD = 1.5;
  const move = Math.ceil((total / SPEED) * FPS), hold = Math.round(HOLD * FPS);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // soft start and stop
  let n = 0; const shot = async () => { await p.screenshot({ path: `${OUT}/f${String(n++).padStart(5, '0')}.png` }); };
  for (let i = 0; i < hold; i++) await shot();
  for (let i = 1; i <= move; i++) {
    const t = i / move; const y = total * (0.85 * t + 0.15 * ease(t)); // mostly constant speed, eased ends
    await p.evaluate((yy) => window.scrollTo(0, yy), Math.round(y)); await shot();
  }
  for (let i = 0; i < hold; i++) await shot();
  console.log('frames', n, 'seconds', (n / FPS).toFixed(1));
  await b.close();
})();
