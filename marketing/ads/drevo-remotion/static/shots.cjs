// Real LivePresenter, free (`basic`) mode, phone size. Needs the harness on :5199.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--lang=en-GB'] });
  for (const lang of ['ms', 'en']) {
    const p = await b.newPage({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 3 });
    await p.goto(`http://localhost:5199/?lang=${lang}&basic=1`);
    await p.waitForTimeout(3500);
    await p.locator('button.lp-chip', { hasText: /^10%$/ }).click();
    await p.locator('button.lp-ten').nth(0).click();
    await p.mouse.move(195, 700); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${__dirname}/shots/phone-${lang}.png` });
    await p.close();
  }
  await b.close();
})();
