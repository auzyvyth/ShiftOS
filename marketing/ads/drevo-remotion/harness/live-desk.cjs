// node harness/live-desk.cjs -> public/real/desk-<view>-<lang>.png + src/live/desk-rects.json
// The real Live presenter at DESKTOP size (the layout sellers film on a monitor), Proton line-up.
// free / free9 / rebate are the FREE presenter; viewer is Premium's Budget > Viewer. The picture is
// the stage only; rects are in CSS px from the stage's top-left corner.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } });
  for (const lang of ['ms', 'en']) {
    const open = async (q) => {
      const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2, locale: 'en-GB' });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.error(lang, q, 'page error', String(e)));
      await p.goto(`http://localhost:5199/?lang=${lang}&set=proton${q}`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(900);
      return [ctx, p];
    };
    const snap = async (p, view) => {
      await p.waitForTimeout(1300);
      const st = await p.evaluate(() => { const b = document.querySelector('.lp-stage').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
      await p.screenshot({ path: `${OUT}/desk-${view}-${lang}.png`, clip: { x: st.x, y: st.y, width: st.w, height: st.h } });
      RECTS[`${view}-${lang}`] = await p.evaluate((o) => {
        const r = (sel, n = 0) => { const el = document.querySelectorAll(sel)[n]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x - o.x, y: b.y - o.y, w: b.width, h: b.height }; };
        return { stage: { w: o.w, h: o.h }, big: r('.lp-big'), tens: r('.lp-tens'), ten9: r('.lp-ten', 0), chips: r('.lp-chips'), brk: r('.lp-brkwrap'), reb: r('tr.lp-r-reb'), ncd: r('.lp-ncd'), cta: r('.lp-cta'), rv: r('.lp-rv') };
      }, st);
      console.log('ok', view, lang, Math.round(st.w), Math.round(st.h));
    };
    let [ctx, p] = await open('&basic=1');
    await snap(p, 'free');
    await p.locator('.lp-ten').first().click();
    await snap(p, 'free9');
    await p.locator('tr.lp-r-reb.lp-tap').click(); await p.keyboard.type('1000'); await p.keyboard.press('Enter');
    await snap(p, 'rebate1');                                         // rebate typed, NCD still 0%
    await p.locator('.lp-ncd button').nth(4).click();                 // 45%
    await snap(p, 'rebate');
    await ctx.close();
    [ctx, p] = await open('');
    await p.locator('.lp-top .lp-seg button').nth(1).click();
    await p.locator('.lp-bkind button').nth(1).click();
    await p.locator('.lp-bview button').nth(1).click();
    await p.locator('.lp-rv-name').fill('@aiman');
    await snap(p, 'viewer0');                                         // name typed, pay still empty
    await p.locator('.lp-money input').first().fill('3000');
    await snap(p, 'viewer');
    await p.locator('.lp-bview button').nth(0).click();               // List: every car by budget
    await snap(p, 'budget');
    await ctx.close();
  }
  fs.writeFileSync('src/live/desk-rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
