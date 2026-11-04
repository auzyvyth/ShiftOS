// node harness/live.cjs -> public/real/live-<step>-<lang>.png + src/live/rects.json
// Extra Live presenter screens for the Live daily post (briefs/live.md): a rebate set in Adjust > Rebates,
// the Cars screen with it applied, and the Docs screen. Real component, sample cars, phone size 390x844 @3x.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
const r = (el) => el.evaluate((n) => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
(async () => {
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
  for (const lang of ['ms', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'en-GB' });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date('2026-11-04T21:00:00+08:00') });
    p.on('pageerror', (e) => console.error(lang, 'page error', String(e)));
    await p.goto(`http://localhost:5199/intro.html?lang=${lang}&lng=${lang}&view=contact`);
    await p.clock.runFor(1500);
    await p.waitForFunction(() => window.INTRO_READY === true);
    await p.evaluate(() => document.fonts.ready);
    const R = {};
    const shot = async (name) => { await p.clock.runFor(3000); await p.screenshot({ path: `${OUT}/live-${name}-${lang}.png` }); };
    await shot('before'); R.big0 = await r(p.locator('.lp-big').first()); R.m0 = await p.locator('.lp-big').first().innerText();
    // Adjust > Rebates: RM 5,000 on car #1
    await p.locator('button[data-adjust-open]').first().click(); await p.clock.runFor(400);
    await p.locator('.lp-adjtabs button').nth(1).click(); await p.clock.runFor(300);
    await p.locator('.lp-reb input').first().fill('5000'); await p.clock.runFor(300);
    R.reb = await r(p.locator('.lp-reb').first()); await shot('rebadj');
    await p.locator('button.lp-adjclose').click(); await p.clock.runFor(400);
    R.rebrow = await r(p.locator('tr.lp-r-reb').first()); R.big1 = await r(p.locator('.lp-big').first());
    R.m1 = await p.locator('.lp-big').first().innerText(); await shot('rebate');
    // Docs: what the bank asks the buyer for
    await p.locator('.lp-top button, button').filter({ hasText: lang === 'en' ? 'Docs' : 'Dokumen' }).first().click(); await p.clock.runFor(500);
    R.docs = await r(p.locator('.lp-docs').first()); await shot('docs');
    RECTS[lang] = R;
    console.log(lang, R.m0.replace(/\s+/g, ' '), '->', R.m1.replace(/\s+/g, ' '), JSON.stringify(R.rebrow), JSON.stringify(R.docs));
    await ctx.close();
  }
  fs.writeFileSync('src/live/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
