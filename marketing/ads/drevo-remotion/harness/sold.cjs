// node harness/sold.cjs -> public/real/sold-<view>-<lang>.png
// The app's real Sold-tab components on sample buyers (harness/sold.jsx), phone size, clock fixed.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
const VIEWS = (process.env.VIEWS || 'coming,renewals,checklist,trade').split(',');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // The date box formats by the browser's own language: en-GB = 03/11/2027, as a Malaysian phone shows it.
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
  for (const lang of ['ms', 'en']) {
    for (const view of VIEWS) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'en-GB' });
      const p = await ctx.newPage();
      await p.clock.setFixedTime(new Date('2026-11-03T10:00:00+08:00'));
      p.on('pageerror', (e) => console.error(view, lang, 'page error', String(e)));
      await p.goto(`http://localhost:5199/sold.html?lng=${lang}&view=${view}`);
      await p.waitForFunction(() => window.SOLD_READY === true);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/sold-${view}-${lang}.png` });
      // Where things sit in that exact frame (CSS px of 390x844), for crops and the tap point.
      RECTS[`${view}-${lang}`] = await p.evaluate(() => {
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const btn = (re) => [...document.querySelectorAll('button')].find((b) => re.test(b.textContent.trim()));
        return {
          first: r(document.getElementById('root').firstElementChild.firstElementChild),
          aiman: r(document.getElementById('customer-c-aiman')), hafiz: r(document.getElementById('customer-c-hafiz')),
          remind: r(btn(/Ingatkan|Remind/)), message: r(btn(/^(Mesej|Message)$/)), date: r(document.querySelector('input[type=date]')),
        };
      });
      await ctx.close();
      console.log('ok', view, lang);
    }
  }
  if (VIEWS.length === 4) fs.writeFileSync('src/renewals/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
