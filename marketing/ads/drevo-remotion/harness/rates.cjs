// node harness/rates.cjs -> public/real/rate-<step>-<lang>.png + src/rates/rects.json
// The "6.44% vs 3.5%" daily post (briefs/rates.md): the REAL presenter, one car, the seller's rate typed
// the wrong way, then the right way. Phone size (390x844, 3x), positions saved in the same run.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
const r = (el) => el.evaluate((n) => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
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
    const shot = async (name) => { await p.clock.runFor(200); await p.screenshot({ path: `${OUT}/rate-${name}-${lang}.png` }); };
    const big = async () => (await p.clock.runFor(3000), await p.locator('.lp-big').first().innerText()).replace(/\s+/g, ' ');
    const rateCell = () => p.locator('tr.lp-r-rate td').last();
    const adjust = async (fn) => {
      await p.locator('button[data-adjust-open]').first().click(); await p.clock.runFor(400);
      await fn(); await p.clock.runFor(400);
    };
    const closeAdj = async () => { await p.locator('button.lp-adjclose').click(); await p.clock.runFor(400); };
    // 1. the brochure number typed as if it were EIR: the app flags it
    await adjust(async () => { await p.locator('#lp-rate-other, .lp-adjust input[type=number]').first().fill('3.5'); });
    await closeAdj();
    R.warn = await r(p.locator('.lp-warn').first()); R.big1 = await r(p.locator('.lp-big').first()); R.rate1 = await r(rateCell());
    R.m_wrong = await big(); await shot('wrong');
    // 2. Switch to flat (the warning's own button): the real monthly
    await p.locator('.lp-warn button').first().click();
    R.big2 = await r(p.locator('.lp-big').first()); R.rate2 = await r(rateCell());
    R.m_flat = await big(); R.rate_flat = await rateCell().innerText(); await shot('flat');
    // 3. Adjust > Financing on flat: every tenure worked out as EIR
    await adjust(async () => {});
    R.hint = await r(p.locator('.lp-adjust .lp-hint').first()); R.adjrate = await r(p.locator('.lp-adjust .lp-rate').first());
    R.hint_text = await p.locator('.lp-adjust .lp-hint').first().innerText(); await shot('adjflat');
    // 4. the bank's EIR typed as EIR: the same monthly
    await p.locator('.lp-adjust .lp-seg button', { hasText: 'EIR' }).first().click();
    await p.locator('.lp-adjust input[type=number]').first().fill('6.44');
    await closeAdj();
    R.big4 = await r(p.locator('.lp-big').first()); R.rate4 = await r(rateCell());
    R.m_eir = await big(); R.rate_eir = await rateCell().innerText(); await shot('eir');
    // 5. what the rate means (the info button beside it)
    await p.locator('button.lp-info').first().hover();
    R.tip = await r(p.locator('.lp-tip').first()); R.info = await r(p.locator('button.lp-info').first()); await shot('info');
    RECTS[lang] = R;
    console.log(lang, JSON.stringify({ wrong: R.m_wrong, flat: R.m_flat, eir: R.m_eir, rf: R.rate_flat, re: R.rate_eir, hint: R.hint_text }));
    await ctx.close();
  }
  fs.mkdirSync('src/rates', { recursive: true });
  fs.writeFileSync('src/rates/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
