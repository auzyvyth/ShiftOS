// node render.cjs <ms|en> stills <t1,t2,...> <outdir>
// node render.cjs <ms|en> frames <outdir> [workers] [fps]
// node render.cjs <ms|en> events <out.json>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [, , lang, mode, a, b, c] = process.argv;
const page = (br) => br.newPage({ viewport: { width: 1080, height: 1920 } });
const url = 'file://' + path.join(__dirname, 'index.html') + `?static&lang=${lang}`;

async function open(br) {
  const p = await page(br);
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url);
  await p.waitForFunction(() => window.READY === true);
  if (errs.length) throw new Error(errs.join('\n'));
  return p;
}

(async () => {
  const br = await chromium.launch();
  if (mode === 'events') {
    const p = await open(br);
    const out = await p.evaluate(() => ({ dur: window.DUR, ev: window.EV }));
    fs.writeFileSync(a, JSON.stringify(out));
  } else if (mode === 'stills') {
    const p = await open(br);
    fs.mkdirSync(b, { recursive: true });
    for (const t of a.split(',').map(Number)) {
      await p.evaluate((tt) => window.render(tt), t);
      await p.screenshot({ path: path.join(b, `t${t.toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 90 });
    }
  } else {
    const out = a, workers = Number(b || 3), fps = Number(c || 30);
    fs.mkdirSync(out, { recursive: true });
    const dur = await (async () => { const p = await open(br); const d = await p.evaluate(() => window.DUR); await p.close(); return d; })();
    const n = Math.round(dur * fps);
    await Promise.all([...Array(workers)].map(async (_, w) => {
      const p = await open(br);
      for (let i = w; i < n; i += workers) {
        await p.evaluate((tt) => window.render(tt), i / fps);
        await p.screenshot({ path: path.join(out, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
      }
    }));
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
