// node harness/dash.cjs -> public/real/dash-<lang>.png + src/dash/rects.json
// The real Premium Dashboard tab on a sample seller (harness/dash.jsx), desktop width, clock fixed.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'public/real'; const RECTS = {};
(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync('src/dash', { recursive: true });
  const b = await chromium.launch({ args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8' } });
  for (const lang of ['ms', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 4, locale: 'en-GB' });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
    p.on('pageerror', (e) => console.error(lang, 'page error', String(e)));
    p.on('console', (m) => m.type() === 'error' && console.error(lang, 'console', m.text().slice(0, 200)));
    await p.goto(`http://localhost:5199/dash.html?lng=${lang}`);
    await p.waitForFunction(() => window.DASH_READY === true, null, { timeout: 20000 });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
    const el = await p.$('#dash');
    await el.screenshot({ path: `${OUT}/dash-${lang}.png` });
    RECTS[lang] = await p.evaluate(() => {
      const root = document.getElementById('dash').getBoundingClientRect();
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.x - root.x, y: b.y - root.y, w: b.width, h: b.height }; };
      const out = { size: { w: root.width, h: root.height }, sections: [], tiles: [] };
      document.querySelectorAll('#dash section, #dash button').forEach((s) => {
        const h = s.querySelector('h2'); if (s.tagName === 'SECTION') out.sections.push({ title: (h ? h.textContent : s.textContent).trim().slice(0, 40), ...r(s) });
      });
      const st = document.querySelector('.pd-stats'); if (st) [...st.children].forEach((c) => out.tiles.push({ title: c.textContent.trim().slice(0, 40), ...r(c) }));
      return out;
    });
    await ctx.close(); console.log('ok', lang);
  }
  fs.writeFileSync('src/dash/rects.json', JSON.stringify(RECTS, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
