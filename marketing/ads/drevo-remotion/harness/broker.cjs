// node harness/broker.cjs -> public/real/broker-<shot>.png (phone 390x844 @3x) + src/broker/rects.json
// The UI is English in the app, so one set of shots serves both cuts.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real'; const R = {};
const box = async (l) => { const b = await l.boundingBox(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; };
(async () => {
  fs.mkdirSync('src/broker', { recursive: true });
  const b = await chromium.launch();
  const open = async (view) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.error('page error', String(e)));
    await p.goto(`http://localhost:5199/broker.html?view=${view}`); await p.waitForFunction(() => window.BROKER_READY === true);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500); return [ctx, p];
  };
  let [ctx, p] = await open('cars');
  await p.screenshot({ path: `${OUT}/broker-stock.png` });
  R.first = await box(p.locator('text=2023 Land Rover Defender 90 P300').first().locator('xpath=../../..'));
  R.earn = await box(p.locator('text=You earn RM 500').first());
  const add = p.locator('button', { hasText: 'Add to my page' }).first(); R.add = await box(add);
  await add.click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/broker-added.png` });
  const reg = p.locator('button', { hasText: 'Register a buyer' }).first(); R.register = await box(reg);
  await reg.click(); await p.waitForTimeout(400);
  await p.locator('input[placeholder="As on their IC"]').fill('Hafiz Rahman');
  await p.locator('input[type=tel]').first().fill('100000005');
  await p.locator('input[type=checkbox]').first().check();
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/broker-sheet.png` });
  const sub = p.locator('button', { hasText: 'Register buyer' }).first(); R.submit = await box(sub);
  await sub.click(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/broker-held.png` });
  R.heldMsg = await box(p.locator('text=is held for you').first().locator('xpath=..'));
  await ctx.close();
  [ctx, p] = await open('buyers');
  await p.locator('button', { hasText: /^My buyers/ }).first().click(); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/broker-buyers.png` });
  R.buyer = await box(p.locator('text=Hafiz Rahman').first().locator('xpath=../../..'));
  await ctx.close();
  fs.writeFileSync('src/broker/rects.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
