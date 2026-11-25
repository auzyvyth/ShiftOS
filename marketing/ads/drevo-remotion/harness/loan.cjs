// node harness/loan.cjs -> public/real/loan-<shot>-<lang>.png (phone 390x844 @3x)
// check: the credit questions answered by tapping the real buttons; fix / bring: the two result tabs;
// share: the buyer's loan page. Labels are found by text, both languages.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real';
const RECTS = {};
const box = async (loc) => { const b = await loc.boundingBox(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; };
const tap = async (p, re, key, lang) => { const b = p.locator('button', { hasText: re }).first(); if (key) (RECTS[lang] ||= {})[key] = await box(b); await b.click(); await p.waitForTimeout(150); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8' } });
  for (const lang of ['ms', 'en']) {
    for (const view of ['check', 'result', 'share']) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'en-GB', hasTouch: true, isMobile: true });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.error(view, lang, 'page error', String(e)));
      await p.goto(`http://localhost:5199/loan.html?lng=${lang}&view=${view}`);
      await p.waitForFunction(() => window.LOAN_READY === true);
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
      if (view === 'check') {
        await tap(p, lang === 'ms' ? /^Sekali dua/ : /^Once or twice/, 'late', lang);
        await tap(p, lang === 'ms' ? /^Belum/ : /^Not yet/, 'ccris', lang);
        await p.screenshot({ path: `${OUT}/loan-check-${lang}.png` });
      } else if (view === 'result') {
        await p.screenshot({ path: `${OUT}/loan-fix-${lang}.png` });
        RECTS[lang].fixList = await box(p.locator('text=' + (lang === 'ms' ? 'Lewat sekali dua' : 'Late once or twice')).first().locator('xpath=../../..'));
        RECTS[lang].monthly = await box(p.locator('text=' + (lang === 'ms' ? 'Bulanan, lebih kurang' : 'Monthly, about')).first().locator('xpath=..'));
        await tap(p, lang === 'ms' ? /^Dokumen dibawa/ : /^What to bring/, 'bringTab', lang);
        await p.waitForTimeout(300);
        await p.screenshot({ path: `${OUT}/loan-bring-${lang}.png` });
        RECTS[lang].send = await box(p.locator('button', { hasText: lang === 'ms' ? /WhatsApp/ : /WhatsApp/ }).first());
      } else {
        await p.screenshot({ path: `${OUT}/loan-share-${lang}.png`, fullPage: true });
        RECTS[lang].shareH = await p.evaluate(() => document.documentElement.scrollHeight);
        RECTS[lang].needed = await box(p.locator('text=Still needed from you').first().locator('xpath=..'));
        RECTS[lang].banks = await box(p.locator('text=Where your application stands').first().locator('xpath=..'));
      }
      await ctx.close(); console.log('ok', view, lang);
    }
  }
  fs.writeFileSync('src/loan/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
