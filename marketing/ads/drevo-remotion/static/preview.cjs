const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1320, height: 940 }, deviceScaleFactor: 2 });
  await p.goto(`file://${__dirname}/calc-preview.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const bad = await p.evaluate(() => [...document.querySelectorAll('.stage')].map((s) => { const c = s.querySelector('.card'); return [s.className, c.scrollHeight - c.clientHeight]; }));
  console.log('card overflow px', JSON.stringify(bad));
  await p.locator('.phone').screenshot({ path: `${__dirname}/../final/calc-preview-phone.png` });
  await p.locator('.desk').screenshot({ path: `${__dirname}/../final/calc-preview-desk.png` });
  await b.close();
})();
