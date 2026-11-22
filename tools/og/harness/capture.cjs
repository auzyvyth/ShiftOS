// Captures the real components (demo data) that the link-preview pictures are built from.
// Run from the repo root:
//   npx vite --config tools/og/harness/vite.config.mjs &
//   node tools/og/harness/capture.cjs && node tools/og/compose.mjs
const { chromium } = require('playwright');
const path = require('node:path');
const out = process.argv[2] || path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:5299/index.html'); await p.waitForTimeout(4000);
  await p.screenshot({ path: path.join(out, 'dms-overview.png'), clip: { x: 0, y: 205, width: 1100, height: 330 } });
  await p.goto('http://localhost:5299/cards.html'); await p.waitForTimeout(4000);
  for (const id of ['c1', 'c2', 'c3']) await p.locator(`#${id} > *`).first().screenshot({ path: path.join(out, `card-${id}.png`) });
  await b.close();
})();
