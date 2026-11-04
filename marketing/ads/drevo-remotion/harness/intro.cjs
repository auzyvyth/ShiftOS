// node harness/intro.cjs -> public/real/intro-<view>-<lang>.png + src/intro/rects.json
// Real app components on sample data (harness/intro.jsx). Phone size (390x844, 3x), clock fixed, element
// positions saved in the same run.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
const r = (el) => el && el.evaluate((n) => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
  for (const lang of ['ms', 'en']) {
    for (const view of ['contact', 'report', 'sources']) {
      const phone = true;   // phone size: a crop scaled ~2.6x stays readable (DESIGN.md section 7)
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: phone ? 3 : 2, locale: 'en-GB' });
      const p = await ctx.newPage();
      await p.clock.install({ time: new Date('2026-11-04T21:00:00+08:00') });
      p.on('pageerror', (e) => console.error(view, lang, 'page error', String(e)));
      await p.goto(`http://localhost:5199/intro.html?lang=${lang}&lng=${lang}&view=${view}`);
      await p.clock.runFor(1500);
      await p.waitForFunction(() => window.INTRO_READY === true);
      await p.evaluate(() => document.fonts.ready);
      const rect = {};
      if (view === 'contact') {
        await p.clock.runFor(400);
        await p.screenshot({ path: `${OUT}/intro-contact-off-${lang}.png` });   // as the live starts: no number
        await p.locator('button.lp-iconbtn[aria-pressed]').first().click();
        await p.clock.runFor(600);
        rect.banner = await r(p.locator('.lp-contact').first());
        rect.button = await r(p.locator('button.lp-iconbtn[aria-pressed]').first());
      }
      if (view === 'report') {
        await p.clock.runFor(31 * 60 * 1000);           // a 31-minute live
        await p.locator(`button[aria-label="${lang === 'en' ? 'Exit live presentation' : 'Keluar dari paparan live'}"]`).click();
        await p.locator('button.lp-confirm-end').click();
        await p.clock.runFor(800);
        await p.waitForSelector('.lp-tiles');
        rect.tiles = await r(p.locator('.lp-tiles'));
        rect.title = await r(p.locator('.lp-report h2'));
        rect.note = await r(p.locator('.lp-report .lp-note').first());
      }
      if (view === 'sources') rect.card = await r(p.locator('#card'));
      await p.clock.runFor(400);
      await p.screenshot({ path: `${OUT}/intro-${view}-${lang}.png` });
      RECTS[`${view}-${lang}`] = rect;
      await ctx.close();
      console.log('ok', view, lang, JSON.stringify(rect));
    }
  }
  fs.mkdirSync('src/intro', { recursive: true });
  fs.writeFileSync('src/intro/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
