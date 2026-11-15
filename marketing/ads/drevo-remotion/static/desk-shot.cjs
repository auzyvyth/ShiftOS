const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--lang=en-GB'] });
  const p = await b.newPage({ viewport: { width: 1124, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5199/?lang=ms');
  await p.waitForSelector('.lp-desk'); await p.waitForTimeout(3000);
  await p.locator('button.lp-chip', { hasText: /^10%$/ }).click();
  await p.mouse.move(562, 1040); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'final/calc-now-desktop.png' });
  await b.close();
})();
