const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const lang of ['ms', 'en']) for (const v of ['a', 'b']) {
    await p.goto(`file://${__dirname}/live-calc.html?lang=${lang}&v=${v}`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const over = await p.evaluate(() => [...document.querySelectorAll('.tick,h1,.price')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 30)));
    if (over.length) console.log(lang, v, 'OVERFLOW', over);
    await p.screenshot({ path: `${__dirname}/../final/live-calc-${v}-${lang}.jpg`, type: 'jpeg', quality: 92 });
  }
  await b.close();
})();
