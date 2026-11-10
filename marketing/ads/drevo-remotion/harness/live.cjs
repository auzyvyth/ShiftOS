// node harness/live.cjs -> public/real/live-<view>-<lang>.png + src/live/rects.json
// The app's real Live presenter on a Proton line-up (harness/main.jsx?set=proton), phone size.
// free-* views are the FREE (Lite) presenter; viewer is Premium's Budget > Viewer.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
  const rects = (p) => p.evaluate(() => {
    const r = (sel, n = 0) => { const el = document.querySelectorAll(sel)[n]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { big: r('.lp-big'), tens: r('.lp-tens'), ten9: r('.lp-ten', 0), chips: r('.lp-chips'), brk: r('.lp-brkwrap'), reb: r('tr.lp-r-reb'), ncd: r('.lp-ncd'), cta: r('.lp-cta'), card: r('.lp-fit'), rv: r('.lp-rv') || r('.lp-reveal') };
  });
  for (const lang of ['ms', 'en']) {
    const open = async (q) => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'en-GB' });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.error(lang, q, 'page error', String(e)));
      await p.goto(`http://localhost:5199/?lang=${lang}&set=proton${q}`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(900);
      return [ctx, p];
    };
    const snap = async (p, view) => { await p.waitForTimeout(1300); await p.screenshot({ path: `${OUT}/live-${view}-${lang}.png` }); RECTS[`${view}-${lang}`] = await rects(p); console.log('ok', view, lang); };

    let [ctx, p] = await open('&basic=1');
    await snap(p, 'free');
    await p.locator('.lp-ten').first().click();                       // 9 years
    await snap(p, 'free9');
    await p.locator('tr.lp-r-reb.lp-tap').click(); await p.keyboard.type('1000'); await p.keyboard.press('Enter');
    await p.locator('.lp-ncd button').nth(4).click();                 // 45%
    await snap(p, 'rebate');
    await ctx.close();

    [ctx, p] = await open('');
    await p.locator('.lp-top .lp-seg button').nth(1).click();         // Budget
    await p.locator('.lp-bkind button').nth(1).click();               // take-home pay
    await p.locator('.lp-bview button').nth(1).click();               // Viewer
    await p.locator('.lp-rv-name').fill('@aiman');
    await p.locator('.lp-money input').first().fill('3000');
    await snap(p, 'viewer');
    await ctx.close();
  }
  fs.mkdirSync('src/live', { recursive: true });
  fs.writeFileSync('src/live/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
