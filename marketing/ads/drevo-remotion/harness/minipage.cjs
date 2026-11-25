// node harness/minipage.cjs -> public/real/mini-{page,bar,budget}-<lang>.png (phone 390 wide @3x) + src/mini/rects.json
// page: the whole Premium page (every photo loaded first, the fixed bottom bar hidden); bar: that bar alone,
// laid over the page in the ad; budget: the budget finder opened with a typed budget, as one phone screen.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real'; const R = {};
const box = async (l) => { const b = await l.boundingBox(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; };
(async () => {
  fs.mkdirSync('src/mini', { recursive: true });
  const b = await chromium.launch();
  for (const lang of ['ms', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.error('page error', String(e)));
    await p.goto(`http://localhost:5199/minipage.html?lng=${lang}`); await p.waitForFunction(() => window.MINI_READY === true);
    await p.evaluate(() => document.fonts.ready);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 400) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(120); }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(800);
    const r = (R[lang] = { H });
    const bar = p.locator('.ap-sticky').first();
    await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(400);
    if (await bar.count()) { r.bar = await box(bar); await bar.screenshot({ path: `${OUT}/mini-bar-${lang}.png` }); }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
    await p.addStyleTag({ content: '.ap-sticky{display:none!important}' });
    const at = async (sel) => { const l = p.locator(sel).first(); if (!(await l.count())) return null; const b2 = await box(l); return b2 && { ...b2, y: b2.y + (await p.evaluate(() => window.scrollY)) }; };
    r.card = await at('.ap-left, .ap-card');
    r.wa = await at('a:has-text("WhatsApp Aiman")');
    r.budget = await at('.bf-head');
    r.cars = await at('text=/^(Cars for sale|Kereta dijual)/');
    r.firstCar = await at('a:has-text("2025 Toyota GR86")');
    r.about = await at('text=/^(About me|Tentang saya)$/');
    r.why = await at('text=/^(Why buy from me|Kenapa beli dengan saya)$/');
    r.H = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: `${OUT}/mini-page-${lang}.png`, fullPage: true });
    // budget finder: open it, type a monthly budget, one phone screen with the bar back on
    await p.addStyleTag({ content: '.ap-sticky{display:flex!important}' });
    await p.locator('.bf-head').first().click(); await p.waitForTimeout(300);
    await p.locator('.bf-head').first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
    await p.waitForTimeout(300);
    const input = p.locator('input[inputmode=numeric]').first();
    await input.fill('4700'); await input.blur(); await p.waitForTimeout(500);
    r.budgetScroll = await p.evaluate(() => window.scrollY);
    r.budgetPanel = await box(p.locator('.bf-head').first().locator('xpath=..'));
    await p.screenshot({ path: `${OUT}/mini-budget-${lang}.png` });
    await ctx.close(); console.log('ok', lang, JSON.stringify(r));
  }
  fs.writeFileSync('src/mini/rects.json', JSON.stringify(R, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
